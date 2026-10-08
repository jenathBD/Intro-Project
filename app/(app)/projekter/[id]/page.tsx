import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import type { WorkPackageStatus } from '@/app/generated/prisma/client';
import { CollapsibleTableGroup, CollapsibleTableSubgroup } from '@/components/collapsible-table-group';
import { FigureCells, FigureHeaderCells, isOverBudget } from '@/components/figure-cells';
import { PageHeader } from '@/components/page-header';
import { Stat } from '@/components/stat';
import { WorkPackageStatusBadge } from '@/components/work-package-status';
import { type CategoryOption, getCategories } from '@/lib/data/categories';
import { type EmployeeOption, getEmployeeOptions, getTitles } from '@/lib/data/employees';
import { type EpicOption, type Figures, getProjectDetail, type WorkPackageRow } from '@/lib/data/projects';
import { formatDateTime, formatHours, formatKr, formatShortDate } from '@/lib/format';
import type { GithubPullRequest } from '@/lib/github-sync';
import { ArchiveProjectButton, ProjectFormButton } from '../project-form';
import { CreateGithubIssueButton, GithubSyncButton } from './github-sync';
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

export default async function ProjectPage({ params }: PageProps<'/projekter/[id]'>) {
  const { id } = await params;
  // Hentes samtidig: projektet, medarbejdere til "Registrér tid" og titler til redigering af prismodellen
  const [detail, { employees, currentEmployeeId }, titles, categoryOptions] = await Promise.all([
    getProjectDetail(id),
    getEmployeeOptions(),
    getTitles(),
    getCategories(),
  ]);
  // Ukendt id: vis not-found.tsx i stedet for en tom side
  if (!detail) notFound();
  const { project, workPackageCount, categories, totals } = detail;
  const over = isOverBudget(totals);
  const canRegister = !project.archivedAt;
  // Fravær (fx Ferie) har ingen arbejdspakker; det lægges ind i allokeringen (#44)
  const canAddPackages = canRegister && project.kind !== 'absence';
  const rowProps = {
    projectId: project.id,
    githubRepo: project.githubRepo,
    canRegister,
    categoryOptions,
    epics: project.epics,
    employees,
    currentEmployeeId,
  };

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

      {(canAddPackages || project.githubRepo) && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* GitHub (#24): hvilket repo, hvornår der sidst er hentet, og knappen til at hente igen */}
          {project.githubRepo ? (
            <div className="flex flex-wrap items-center gap-3">
              {canRegister && <GithubSyncButton projectId={project.id} />}
              <span className="bd-meta">
                <a href={`https://github.com/${project.githubRepo}`} target="_blank" rel="noreferrer">{project.githubRepo}</a>
                {' · '}
                {project.githubSyncedAt ? `hentet ${formatDateTime(project.githubSyncedAt)}` : 'ikke hentet endnu'}
              </span>
            </div>
          ) : (
            <span />
          )}
          {canAddPackages && (
            <WorkPackageFormButton
              projectId={project.id}
              githubRepo={project.githubRepo}
              categories={categoryOptions}
              epics={project.epics}
              employees={employees}
            />
          )}
        </div>
      )}

      {categories.length === 0 ? (
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
                <th>Kategori / epic / arbejdspakke</th>
                <th>Status</th>
                <FigureHeaderCells />
                <th>Ansvarlig</th>
                <th><span className="sr-only">Handlinger</span></th>
              </tr>
            </thead>
            {/* Én <tbody> pr. kategori med subtotal. Derunder epics med deres pakker og til sidst pakkerne uden epic (#50). */}
            {categories.map((category) => (
              <CollapsibleTableGroup
                key={category.id}
                label={category.name}
                meta={category.workPackageCount}
                severity={isOverBudget(category.totals) ? 'blocker' : undefined}
                // Foldet sammen fra start: man ser kategoriernes subtotaler og folder ud efter behov
                defaultOpen={false}
                headerCells={<GroupCells status={category.status} totals={category.totals} />}
              >
                {category.epics.map((epic) => (
                  <CollapsibleTableSubgroup
                    key={epic.id}
                    label={epic.name}
                    meta={epic.workPackages.length}
                    severity={isOverBudget(epic.totals) ? 'blocker' : undefined}
                    headerCells={
                      <GroupCells
                        status={epic.status}
                        totals={epic.totals}
                        // Epicets issue, eller en knap til at oprette det, når epicet kun findes i dashboardet (#25)
                        actions={
                          epic.githubNumber !== null ? (
                            <GithubLink repo={project.githubRepo} path={`issues/${epic.githubNumber}`} label={`#${epic.githubNumber}`} state={null} />
                          ) : (
                            project.githubRepo && canRegister && <CreateGithubIssueButton kind="epic" id={epic.id} projectId={project.id} />
                          )
                        }
                      />
                    }
                  >
                    {epic.workPackages.map((wp) => (
                      <WorkPackageTableRow key={wp.id} wp={wp} level={2} {...rowProps} />
                    ))}
                  </CollapsibleTableSubgroup>
                ))}
                {category.withoutEpic.map((wp) => (
                  <WorkPackageTableRow key={wp.id} wp={wp} level={1} {...rowProps} />
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

// Status og subtotal i en kategori- eller epic-række. actions står i sidste kolonne.
function GroupCells({ status, totals, actions }: { status: WorkPackageStatus; totals: Figures; actions?: ReactNode }) {
  return (
    <>
      <td><WorkPackageStatusBadge status={status} /></td>
      <FigureCells figures={totals} />
      <td />
      <td className="text-right font-normal">{actions}</td>
    </>
  );
}

type RowProps = {
  projectId: string;
  githubRepo: string | null;
  canRegister: boolean;
  categoryOptions: CategoryOption[];
  epics: EpicOption[];
  employees: EmployeeOption[];
  currentEmployeeId: string | null;
};

// Én arbejdspakke. level 1 = direkte under kategorien, level 2 = under et epic.
function WorkPackageTableRow({
  wp,
  level,
  projectId,
  githubRepo,
  canRegister,
  categoryOptions,
  epics,
  employees,
  currentEmployeeId,
}: RowProps & { wp: WorkPackageRow; level: 1 | 2 }) {
  return (
    <tr data-sev={isOverBudget(wp) ? 'blocker' : undefined}>
      <td className={level === 2 ? 'bd-tree-child bd-tree-child--2' : 'bd-tree-child'}>
        {/* Klik på navnet for at redigere. Arkiverede projekter kan ikke ændres. */}
        <div>
          {canRegister ? (
            <WorkPackageFormButton
              projectId={projectId}
              githubRepo={githubRepo}
              workPackage={wp}
              categories={categoryOptions}
              epics={epics}
              employees={employees}
            />
          ) : (
            wp.name
          )}
        </div>
        <div className="bd-meta flex flex-wrap items-center gap-2 whitespace-nowrap">
          {/* Uden issue: opret det på GitHub (#25) */}
          {wp.githubNumber === null && githubRepo && canRegister && (
            <CreateGithubIssueButton kind="workPackage" id={wp.id} projectId={projectId} />
          )}
          {wp.githubNumber !== null && (
            <GithubLink repo={githubRepo} path={`issues/${wp.githubNumber}`} label={`#${wp.githubNumber}`} state={wp.githubState === 'closed' ? 'lukket' : null} />
          )}
          {wp.pullRequests.map((pr) => (
            <GithubLink key={pr.number} repo={githubRepo} path={`pull/${pr.number}`} label={`PR #${pr.number}`} state={PR_STATES[pr.state]} title={pr.title} />
          ))}
          {(wp.startDate || wp.endDate) && (
            <span>
              {wp.startDate ? formatShortDate(wp.startDate) : '…'} – {wp.endDate ? formatShortDate(wp.endDate) : '…'}
            </span>
          )}
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
  );
}

const PR_STATES: Record<GithubPullRequest['state'], string> = { open: 'åben', closed: 'lukket', merged: 'merget' };

// Issue eller PR som ID med link til GitHub (#24). Uden repo vises kun ID'et.
function GithubLink({ repo, path, label, state, title }: { repo: string | null; path: string; label: string; state: string | null; title?: string }) {
  const id = <span className="bd-id">{label}</span>;
  return (
    <span className="inline-flex items-center gap-1" title={title}>
      {repo ? (
        <a href={`https://github.com/${repo}/${path}`} target="_blank" rel="noreferrer" className="no-underline">{id}</a>
      ) : (
        id
      )}
      {state && <span>{state}</span>}
    </span>
  );
}
