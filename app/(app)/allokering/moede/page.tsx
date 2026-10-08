import Link from 'next/link';
import { CollapsibleTableGroup } from '@/components/collapsible-table-group';
import { PageHeader } from '@/components/page-header';
import { getStaffingOverview } from '@/lib/data/staffing';
import { formatFte, formatHours, formatShortDate, formatSignedHours } from '@/lib/format';
import type { Milestone } from '@/lib/staffing';
import { isoWeek } from '@/lib/weeks';

// Deadline-cellen: uge, dato og de pakker, der har deadline i den uge
function DeadlineCell({ milestone }: { milestone: Milestone }) {
  return (
    <td className="bd-tree-child">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Uge {isoWeek(milestone.deadlineWeek)}</span>
        <span className="bd-meta">{formatShortDate(milestone.deadlineWeek)}</span>
        {milestone.overdue && <span className="bd-badge bd-badge--warn">Forsinket</span>}
      </div>
      <div className="bd-meta">{milestone.packages.join(', ')}</div>
    </td>
  );
}

// Mangler (FTE) først, så timerne bag: bemandet − arbejde = forskel (+ til overs, − mangler)
function FigureCells({ milestone }: { milestone: Milestone }) {
  const missing = milestone.shortfallHours > 0;
  const difference = milestone.plannedHours - milestone.requiredHours;
  return (
    <>
      <td className={missing ? 'num font-semibold text-bd-danger' : 'num bd-meta'}>
        {missing ? `ca. ${formatFte(milestone.extraFtePerWeek)}` : '–'}
      </td>
      <td className="num">{formatHours(milestone.requiredHours)}</td>
      <td className="num">{formatHours(milestone.plannedHours)}</td>
      <td className={missing ? 'num font-semibold text-bd-danger' : 'num'}>
        {formatSignedHours(Math.round(difference))}
        <span className="sr-only">{missing ? ' timer mangler' : ' timer til overs'}</span>
      </td>
    </>
  );
}

export default async function AllocationMeetingPage() {
  const { thisWeek, projects } = await getStaffingOverview();
  const understaffed = projects.filter((p) => p.staffing.firstShortfall);
  const staffed = projects.filter((p) => !p.staffing.firstShortfall);

  // Overskriften siger konklusionen (BD-styleguide)
  const title =
    understaffed.length === 0
      ? 'Alle kundeprojekter er fuldt bemandet'
      : understaffed.length === 1
        ? '1 kundeprojekt mangler folk'
        : `${understaffed.length} kundeprojekter mangler folk`;

  return (
    <>
      <Link href="/allokering" className="bd-meta">← Ugegrid</Link>
      <PageHeader
        eyebrow={`Allokeringsmøde · uge ${isoWeek(thisWeek)}`}
        title={title}
        lede="Er der folk nok til at lave det resterende arbejde inden hver deadline? Arbejdet tilbage sammenlignes med de timer, projektet er bemandet med frem til deadline."
      />

      {understaffed.length > 0 && (
        <div className="grid gap-2">
          <p className="bd-meta m-0">
            Én række pr. deadline, dvs. kun de uger, hvor en arbejdspakke slutter. Tallene er samlet fra i dag: timer til
            overs ved en tidlig deadline er regnet med til de senere.
          </p>
          <div className="bd-table-wrap">
            <table className="bd-table">
              <thead>
                <tr>
                  <th>Projekt / deadline</th>
                  <th className="num">Mangler (FTE)</th>
                  <th className="num">Arbejde til og med (t)</th>
                  <th className="num">Bemandet frem til (t)</th>
                  <th className="num">Forskel (t)</th>
                </tr>
              </thead>
              {/* Én gruppe pr. projekt med den første deadline, der ikke er dækket. Alle deadlines ved udfoldning. */}
              {understaffed.map((project) => {
                const first = project.staffing.firstShortfall!;
                return (
                  <CollapsibleTableGroup
                    key={project.id}
                    label={project.name}
                    meta={`mangler ca. ${formatFte(first.extraFtePerWeek)} FTE frem til uge ${isoWeek(first.deadlineWeek)}`}
                    severity="blocker"
                    defaultOpen={false}
                    headerCells={<FigureCells milestone={first} />}
                  >
                    {project.staffing.milestones.map((milestone) => (
                      <tr key={milestone.deadlineWeek.getTime()} data-sev={milestone.shortfallHours > 0 ? 'blocker' : undefined}>
                        <DeadlineCell milestone={milestone} />
                        <FigureCells milestone={milestone} />
                      </tr>
                    ))}
                    <tr>
                      <td className="bd-tree-child" colSpan={5}>
                        <Link href={`/projekter/${project.id}`}>Se {project.name}</Link>
                      </td>
                    </tr>
                  </CollapsibleTableGroup>
                );
              })}
            </table>
          </div>
        </div>
      )}

      {staffed.length > 0 && (
        <section className="grid gap-4" aria-labelledby="staffed-heading">
          <div className="bd-page-head">
            <p className="bd-eyebrow">Fuldt bemandet</p>
            <h2 id="staffed-heading" className="bd-h2">
              {staffed.length === 1 ? '1 kundeprojekt har folk nok' : `${staffed.length} kundeprojekter har folk nok`}
            </h2>
            <p className="bd-lede">
              Kan afgive er, hvor mange FTE projektet kan undvære om ugen uden at komme bagud ved den strammeste deadline.
            </p>
          </div>
          <div className="bd-table-wrap">
            <table className="bd-table">
              <thead>
                <tr>
                  <th>Projekt</th>
                  <th>Næste deadline</th>
                  <th className="num">Kan afgive (FTE)</th>
                </tr>
              </thead>
              <tbody>
                {staffed.map((project) => {
                  const next = project.staffing.milestones[0];
                  const spare = project.staffing.spareFtePerWeek;
                  return (
                    <tr key={project.id}>
                      <td>
                        <Link href={`/projekter/${project.id}`} className="font-semibold">{project.name}</Link>
                        <div className="bd-meta">{project.customer}</div>
                      </td>
                      <td>
                        {next ? (
                          <>
                            Uge {isoWeek(next.deadlineWeek)}
                            <div className="bd-meta">{next.packages.join(', ')}</div>
                          </>
                        ) : (
                          <span className="bd-meta">Intet arbejde tilbage</span>
                        )}
                      </td>
                      <td className={spare > 0 ? 'num font-semibold' : 'num bd-meta'}>
                        {spare > 0 ? `ca. ${formatFte(spare)}` : '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
