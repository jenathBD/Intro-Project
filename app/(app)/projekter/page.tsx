import Link from 'next/link';
import { FigureCells, FigureHeaderCells, isOverBudget } from '@/components/figure-cells';
import { PageHeader } from '@/components/page-header';
import { getTitles } from '@/lib/data/employees';
import { getProjectOverview, type ProjectOverviewRow } from '@/lib/data/projects';
import { ProjectFormButton } from './project-form';

function ProjectTable({ projects }: { projects: ProjectOverviewRow[] }) {
  return (
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
  );
}

export default async function ProjectsPage({ searchParams }: PageProps<'/projekter'>) {
  // ?arkiv=1 viser de arkiverede projekter i stedet for de aktive
  const archived = (await searchParams).arkiv === '1';
  const [projects, titles] = await Promise.all([getProjectOverview({ archived }), getTitles()]);

  // Kundeprojekter og interne projekter vises hver for sig; fravær er ikke med i oversigten (#44)
  const clientProjects = projects.filter((p) => p.kind === 'client');
  const internalProjects = projects.filter((p) => p.kind === 'internal');
  const overBudget = clientProjects.filter(isOverBudget).length;

  // Overskriften siger konklusionen om kundeprojekterne (BD-styleguide)
  const title = archived
    ? `${projects.length} arkiverede projekter`
    : clientProjects.length === 0
      ? 'Ingen aktive kundeprojekter'
      : overBudget === 0
        ? 'Alle kundeprojekter holder budgettet'
        : `${overBudget} af ${clientProjects.length} kundeprojekter er på vej over budget`;

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
        <>
          {clientProjects.length > 0 && <ProjectTable projects={clientProjects} />}

          {internalProjects.length > 0 && (
            <section className="grid gap-4" aria-labelledby="internal-heading">
              <div className="bd-page-head">
                <p className="bd-eyebrow">Interne projekter</p>
                <h2 id="internal-heading" className="bd-h2">Intern tid faktureres ikke</h2>
              </div>
              <ProjectTable projects={internalProjects} />
            </section>
          )}
        </>
      )}
    </>
  );
}
