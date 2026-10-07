import Link from 'next/link';
import { FigureCells, FigureHeaderCells, isOverBudget } from '@/components/figure-cells';
import { PageHeader } from '@/components/page-header';
import { getProjectOverview } from '@/lib/data/projects';

export default async function ProjectsPage() {
  const projects = await getProjectOverview();
  const overBudget = projects.filter(isOverBudget).length;

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
              <FigureHeaderCells />
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const isOver = isOverBudget(project);
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
                  <FigureCells figures={project} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
