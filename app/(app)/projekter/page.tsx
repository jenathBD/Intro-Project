import Link from 'next/link';
import { FigureCells, FigureHeaderCells, isOverBudget } from '@/components/figure-cells';
import { PageHeader } from '@/components/page-header';
import { getTitles } from '@/lib/data/employees';
import { getProjectOverview } from '@/lib/data/projects';
import { ProjectFormButton } from './project-form';

export default async function ProjectsPage({ searchParams }: PageProps<'/projekter'>) {
  // ?arkiv=1 viser de arkiverede projekter i stedet for de aktive
  const archived = (await searchParams).arkiv === '1';
  const [projects, titles] = await Promise.all([getProjectOverview({ archived }), getTitles()]);
  const overBudget = projects.filter(isOverBudget).length;

  // Overskriften siger konklusionen, ikke emnet (BD-styleguide)
  const title = archived
    ? `${projects.length} arkiverede projekter`
    : projects.length === 0
      ? 'Ingen aktive projekter'
      : overBudget === 0
        ? 'Alle projekter holder budgettet'
        : `${overBudget} af ${projects.length} projekter er på vej over budget`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow={archived ? 'Arkiverede projekter' : 'Projekter'} title={title} />
        <div className="flex flex-wrap items-center gap-2">
          <Link href={archived ? '/projekter' : '/projekter?arkiv=1'} className="bd-btn bd-btn--ghost bd-btn--sm">
            {archived ? 'Vis aktive projekter' : 'Vis arkiverede'}
          </Link>
          {!archived && <ProjectFormButton titles={titles} />}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="bd-empty">
          <strong>{archived ? 'Ingen arkiverede projekter' : 'Der er ingen aktive projekter endnu'}</strong>
          {archived ? 'Arkivér et projekt fra projektets side.' : 'Opret det første med "Opret projekt".'}
        </div>
      ) : (
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
      )}
    </>
  );
}
