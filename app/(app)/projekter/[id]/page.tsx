import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CollapsibleTableGroup } from '@/components/collapsible-table-group';
import { FigureCells, FigureHeaderCells, isOverBudget } from '@/components/figure-cells';
import { PageHeader } from '@/components/page-header';
import { Stat } from '@/components/stat';
import { WorkPackageStatusBadge } from '@/components/work-package-status';
import { getEmployeeOptions } from '@/lib/data/employees';
import { type Figures, getProjectDetail } from '@/lib/data/projects';
import { formatHours, formatKr, formatShortDate } from '@/lib/format';
import { RegisterTimeButton } from './register-time';
import { RemainingButton } from './remaining';
import { SpentHoursButton } from './time-entries';

// Konklusionen i én sætning (BD: overskrift og lede siger konklusionen, ikke emnet)
function conclusion(totals: Figures) {
  if (totals.estimateHours === 0) return 'Projektet har ingen arbejdspakker endnu.';
  if (totals.varianceHours > 0) return `Prognosen er ${formatHours(totals.varianceHours)} timer over estimatet.`;
  if (totals.varianceHours < 0) return `Prognosen er ${formatHours(-totals.varianceHours)} timer under estimatet.`;
  return 'Prognosen rammer estimatet.';
}

export default async function ProjectPage({ params }: PageProps<'/projekter/[id]'>) {
  const { id } = await params;
  // Hentes samtidig: projektet og listen over medarbejdere til "Registrér tid"
  const [detail, { employees, currentEmployeeId }] = await Promise.all([getProjectDetail(id), getEmployeeOptions()]);
  // Ukendt id: vis not-found.tsx i stedet for en tom side
  if (!detail) notFound();
  const { project, categories, totals } = detail;
  const over = isOverBudget(totals);
  const canRegister = !project.archivedAt;

  return (
    <>
      <Link href="/projekter" className="bd-meta">← Alle projekter</Link>
      <PageHeader eyebrow={project.customer} title={project.name} lede={conclusion(totals)} />
      {project.archivedAt && (
        <p className="m-0">
          <span className="bd-badge">Arkiveret {formatShortDate(project.archivedAt)}</span>
        </p>
      )}

      <div className="bd-stats">
        <Stat label="Estimat" value={formatHours(totals.estimateHours)} unit="t" />
        <Stat label="Brugt" value={formatHours(totals.spentHours)} unit="t" note={formatKr(totals.spentCost)} />
        <Stat label="Resterende" value={formatHours(totals.remainingHours)} unit="t" />
        <Stat
          label="Prognose"
          value={formatHours(totals.forecastHours)}
          unit="t"
          note={over ? 'Over estimat' : 'Inden for estimat'}
          tone={over ? 'bad' : 'good'}
        />
      </div>

      {categories.length === 0 ? (
        <div className="bd-empty">
          <strong>Ingen arbejdspakker</strong>
          Arbejdspakker oprettes i #14.
        </div>
      ) : (
        <div className="bd-table-wrap">
          <table className="bd-table">
            <thead>
              <tr>
                <th>Kategori / arbejdspakke</th>
                <th>Status</th>
                <FigureHeaderCells />
                <th>Ansvarlig</th>
                <th><span className="sr-only">Handlinger</span></th>
              </tr>
            </thead>
            {/* Én <tbody> pr. kategori: overskriftsrække med subtotal og arbejdspakkerne under */}
            {categories.map((category) => (
              <CollapsibleTableGroup
                key={category.categoryName}
                label={category.categoryName}
                count={category.workPackages.length}
                overBudget={isOverBudget(category.totals)}
                headerCells={
                  <>
                    <td><WorkPackageStatusBadge status={category.status} /></td>
                    <FigureCells figures={category.totals} />
                    <td />
                    <td />
                  </>
                }
              >
                {category.workPackages.map((wp) => (
                  <tr key={wp.id} data-sev={isOverBudget(wp) ? 'blocker' : undefined}>
                    <td className="bd-tree-child">
                      <div>{wp.name}</div>
                      <div className="bd-meta whitespace-nowrap">
                        {formatShortDate(wp.startDate)} – {formatShortDate(wp.endDate)}
                      </div>
                    </td>
                    <td><WorkPackageStatusBadge status={wp.status} /></td>
                    <FigureCells
                      figures={wp}
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
                    <td className="whitespace-nowrap">{wp.responsibleName}</td>
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
