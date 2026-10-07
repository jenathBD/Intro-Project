import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { getProjectOverview } from '@/lib/data/projects';
import { formatHours, formatKr, formatSignedHours } from '@/lib/format';

export default async function ProjectsPage() {
  const projects = await getProjectOverview();
  const overBudget = projects.filter((project) => project.varianceHours > 0).length;

  // Overskriften siger konklusionen, ikke emnet (BD-styleguide)
  const title =
    overBudget === 0
      ? 'Alle projekter holder budgettet'
      : `${overBudget} af ${projects.length} projekter er på vej over budget`;

  if (projects.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Projekter" title="Ingen aktive projekter" />
        <div className="bd-empty">
          <strong>Der er ingen aktive projekter endnu</strong>
          Kør <code>npm run db:seed</code> for at få mockdata.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Projekter" title={title} />
      <div className="bd-table-wrap">
        <table className="bd-table">
          <thead>
            <tr>
              <th>Projekt</th>
              <th className="num">Estimat (t)</th>
              <th className="num">Brugt (t)</th>
              <th className="num">Resterende (t)</th>
              <th className="num">Prognose (t)</th>
              <th className="num">Afvigelse (t)</th>
              <th className="num">Brugt (kr)</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const isOver = project.varianceHours > 0;
              return (
                <tr key={project.id} data-sev={isOver ? 'blocker' : undefined}>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/projekter/${project.id}`} className="font-semibold">
                        {project.name}
                      </Link>
                      {isOver && <span className="bd-badge bd-badge--danger">Over budget</span>}
                    </div>
                    <div className="bd-meta">{project.customer}</div>
                  </td>
                  <td className="num">{formatHours(project.estimateHours)}</td>
                  <td className="num">{formatHours(project.spentHours)}</td>
                  <td className="num">{formatHours(project.remainingHours)}</td>
                  <td className="num">{formatHours(project.forecastHours)}</td>
                  <td className={isOver ? 'num font-semibold text-bd-danger' : 'num'}>
                    {formatSignedHours(project.varianceHours)}
                  </td>
                  <td className="num">{formatKr(project.spentCost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="bd-meta m-0">
        Prognose = brugt + resterende. Brugt i kr er beregnet med timeprisen på det tidspunkt, timerne blev registreret.
      </p>
    </>
  );
}
