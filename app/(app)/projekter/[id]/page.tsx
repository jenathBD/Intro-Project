import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CollapsibleTableGroup } from '@/components/collapsible-table-group';
import { FigureCells, FigureHeaderCells, isOverBudget } from '@/components/figure-cells';
import { PageHeader } from '@/components/page-header';
import { Stat } from '@/components/stat';
import { WorkPackageStatusBadge } from '@/components/work-package-status';
import { getCategories } from '@/lib/data/categories';
import { getEmployeeOptions, getTitles } from '@/lib/data/employees';
import { type Figures, getProjectDetail } from '@/lib/data/projects';
import { formatHours, formatKr, formatShortDate } from '@/lib/format';
import { ArchiveProjectButton, ProjectFormButton } from '../project-form';
import { RegisterTimeButton } from './register-time';
import { RemainingButton } from './remaining';
import { SpentHoursButton } from './time-entries';
import { WorkPackageFormButton } from './work-package-form';

// Konklusionen i én sætning (BD: overskrift og lede siger konklusionen, ikke emnet)
function conclusion(totals: Figures, workPackageCount: number) {
  if (workPackageCount === 0) return 'Projektet har ingen arbejdspakker endnu.';
  if (totals.estimateHours === 0) return 'Ingen af arbejdspakkerne har et estimat endnu.';
  if (totals.varianceHours > 0) return `Prognosen er ${formatHours(totals.varianceHours)} timer over estimatet.`;
  if (totals.varianceHours < 0) return `Prognosen er ${formatHours(-totals.varianceHours)} timer under estimatet.`;
  return 'Prognosen rammer estimatet.';
}

export default async function ProjectPage({ params, searchParams }: PageProps<'/projekter/[id]'>) {
  const { id } = await params;
  const { gruppering } = await searchParams;
  // Hentes samtidig: projektet, medarbejdere til "Registrér tid" og titler til redigering af prismodellen
  const [detail, { employees, currentEmployeeId }, titles, categoryOptions] = await Promise.all([
    getProjectDetail(id),
    getEmployeeOptions(),
    getTitles(),
    getCategories(),
  ]);
  // Ukendt id: vis not-found.tsx i stedet for en tom side
  if (!detail) notFound();
  const { project, workPackageCount, byCategory, byEpic, totals } = detail;
  // Med epics grupperes efter epic, medmindre ?gruppering=kategori er valgt (#50). Uden epics altid efter kategori.
  const hasEpics = project.epics.length > 0;
  const groupByEpic = hasEpics && gruppering !== 'kategori';
  const groups = groupByEpic ? byEpic : byCategory;
  const over = isOverBudget(totals);
  const canRegister = !project.archivedAt;
  // Fravær (fx Ferie) har ingen arbejdspakker; det lægges ind i allokeringen (#44)
  const canAddPackages = canRegister && project.kind !== 'absence';

  return (
    <>
      <Link href="/projekter" className="bd-meta">← Alle projekter</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow={project.customer} title={project.name} lede={conclusion(totals, workPackageCount)} />
        <div className="flex flex-wrap items-center gap-2">
          <ArchiveProjectButton projectId={project.id} archived={Boolean(project.archivedAt)} />
          {!project.archivedAt && <ProjectFormButton project={project} titles={titles} />}
        </div>
      </div>
      {project.archivedAt && (
        <p className="m-0">
          <span className="bd-badge">Arkiveret {formatShortDate(project.archivedAt)}</span>
        </p>
      )}

      <div className="bd-stats">
        <Stat label="Estimat" value={formatHours(totals.estimateHours)} unit="t" />
        <Stat
          label="Brugt"
          value={formatHours(totals.spentHours)}
          unit="t"
          note={project.kind === 'client' ? formatKr(totals.spentCost) : undefined}
        />
        <Stat label="Resterende" value={formatHours(totals.remainingHours)} unit="t" />
        <Stat
          label="Prognose"
          value={formatHours(totals.forecastHours)}
          unit="t"
          note={over ? 'Over estimat' : 'Inden for estimat'}
          tone={over ? 'bad' : 'good'}
        />
      </div>

      {canAddPackages && (
        <div className="flex justify-end">
          <WorkPackageFormButton projectId={project.id} categories={categoryOptions} epics={project.epics} employees={employees} />
        </div>
      )}

      {hasEpics && workPackageCount > 0 && (
        <p className="bd-meta m-0">
          Gruppér efter{' '}
          {groupByEpic ? <strong>epic</strong> : <Link href={`/projekter/${project.id}`}>epic</Link>}
          {' · '}
          {groupByEpic ? <Link href={`/projekter/${project.id}?gruppering=kategori`}>kategori</Link> : <strong>kategori</strong>}
        </p>
      )}

      {groups.length === 0 ? (
        <div className="bd-empty">
          <strong>{project.kind === 'absence' ? 'Fravær har ingen arbejdspakker' : 'Ingen arbejdspakker endnu'}</strong>
          {project.kind === 'absence'
            ? 'Fravær lægges ind i allokeringen: 1 dag = 0,2 FTE.'
            : canRegister
              ? 'Tilføj den første med "Tilføj arbejdspakke".'
              : 'Projektet er arkiveret.'}
        </div>
      ) : (
        <div className="bd-table-wrap">
          <table className="bd-table">
            <thead>
              <tr>
                <th>{groupByEpic ? 'Epic' : 'Kategori'} / arbejdspakke</th>
                <th>Status</th>
                <FigureHeaderCells />
                <th>Ansvarlig</th>
                <th><span className="sr-only">Handlinger</span></th>
              </tr>
            </thead>
            {/* Én <tbody> pr. kategori eller epic: overskriftsrække med subtotal og arbejdspakkerne under */}
            {groups.map((group) => (
              <CollapsibleTableGroup
                key={group.key}
                label={group.label}
                meta={group.workPackages.length}
                severity={isOverBudget(group.totals) ? 'blocker' : undefined}
                // Foldet sammen fra start: man ser kategoriernes subtotaler og folder ud efter behov
                defaultOpen={false}
                headerCells={
                  <>
                    <td><WorkPackageStatusBadge status={group.status} /></td>
                    <FigureCells figures={group.totals} />
                    <td />
                    <td />
                  </>
                }
              >
                {group.workPackages.map((wp) => (
                  <tr key={wp.id} data-sev={wp.estimated && isOverBudget(wp) ? 'blocker' : undefined}>
                    <td className="bd-tree-child">
                      {/* Klik på navnet for at redigere. Arkiverede projekter kan ikke ændres. */}
                      <div>
                        {canRegister ? (
                          <WorkPackageFormButton
                            projectId={project.id}
                            workPackage={wp}
                            categories={categoryOptions}
                            epics={project.epics}
                            employees={employees}
                          />
                        ) : (
                          wp.name
                        )}
                      </div>
                      <div className="bd-meta whitespace-nowrap">
                        {[
                          wp.githubNumber !== null && `#${wp.githubNumber}`,
                          // Den anden gruppering står som meta, så den ikke går tabt
                          groupByEpic ? wp.categoryName : wp.epicName,
                          (wp.startDate || wp.endDate) &&
                            `${wp.startDate ? formatShortDate(wp.startDate) : '…'} – ${wp.endDate ? formatShortDate(wp.endDate) : '…'}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </td>
                    <td><WorkPackageStatusBadge status={wp.status} /></td>
                    <FigureCells
                      figures={wp}
                      estimated={wp.estimated}
                      spent={<SpentHoursButton workPackageId={wp.id} workPackageName={wp.name} hours={wp.spentHours} />}
                      remaining={
                        <RemainingButton
                          workPackageId={wp.id}
                          workPackageName={wp.name}
                          hours={wp.remainingHours}
                          updatedAt={wp.remainingUpdatedAt}
                          canEdit={canRegister}
                        />
                      }
                    />
                    <td className="whitespace-nowrap">{wp.responsibleName ?? <span className="bd-meta">–</span>}</td>
                    <td className="text-right">
                      {canRegister && (
                        <RegisterTimeButton
                          workPackageId={wp.id}
                          workPackageName={wp.name}
                          employees={employees}
                          defaultEmployeeId={currentEmployeeId}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </CollapsibleTableGroup>
            ))}
            <tfoot>
              <tr>
                <td>I alt</td>
                <td />
                <FigureCells figures={totals} />
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
