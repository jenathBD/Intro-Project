import Link from 'next/link';
import { CollapsibleTableGroup } from '@/components/collapsible-table-group';
import { PageHeader } from '@/components/page-header';
import { bookingLevel, FULL_TIME, UNDERBOOKED_BELOW } from '@/lib/capacity';
import { getAllocationGrid } from '@/lib/data/allocations';
import { formatFte, formatHours, formatShortDate } from '@/lib/format';
import { addWeeks, isoWeek, mondayOf, parseWeekParam, toWeekParam } from '@/lib/weeks';

/** Antal uger, der vises ad gangen */
const WEEKS_SHOWN = 6;

// Celle med FTE. Summen pr. medarbejder får farve: over 1,0 rødt (overbooket), under 0,8 orange (ledig tid).
function FteCell({ fte, isTotal = false }: { fte: number; isTotal?: boolean }) {
  if (!isTotal) return fte === 0 ? <td className="num bd-meta">–</td> : <td className="num">{formatFte(fte)}</td>;

  const level = bookingLevel(fte);
  const className =
    level === 'over' ? 'num font-semibold text-bd-danger' : level === 'under' ? 'num font-semibold text-bd-warn' : 'num';
  return (
    <td className={className}>
      {formatFte(fte)}
      {/* Farven kan ikke ses af skærmlæsere */}
      {level !== 'ok' && <span className="sr-only">{level === 'over' ? ' overbooket' : ' ledig tid'}</span>}
    </td>
  );
}

export default async function AllocationPage({ searchParams }: PageProps<'/allokering'>) {
  const thisWeek = mondayOf(new Date());
  // ?uge=2026-10-12 vælger første viste uge. Mangler den eller er ugyldig, vises denne uge.
  const firstWeek = parseWeekParam((await searchParams).uge) ?? thisWeek;
  const { weeks, employees } = await getAllocationGrid(firstWeek, WEEKS_SHOWN);

  const weekHref = (week: Date) =>
    week.getTime() === thisWeek.getTime() ? '/allokering' : `/allokering?uge=${toWeekParam(week)}`;

  // Overskriften siger konklusionen for den første viste uge (BD-styleguide)
  const week = isoWeek(weeks[0]);
  const overbooked = employees.filter((e) => bookingLevel(e.totals[0]) === 'over').length;
  const underbooked = employees.filter((e) => bookingLevel(e.totals[0]) === 'under').length;
  const parts = [
    overbooked > 0 && `${overbooked} er overbooket`,
    underbooked > 0 && `${underbooked} har ledig tid`,
  ].filter(Boolean);
  const title = parts.length === 0 ? `Alle er fuldt planlagt i uge ${week}` : `${parts.join(' og ')} i uge ${week}`;

  return (
    <>
      <PageHeader eyebrow="Allokering" title={title} />

      <nav className="flex flex-wrap items-center gap-2" aria-label="Vælg uger">
        <Link href={weekHref(addWeeks(firstWeek, -1))} className="bd-btn bd-btn--secondary bd-btn--sm">← Forrige uge</Link>
        {firstWeek.getTime() !== thisWeek.getTime() && (
          <Link href="/allokering" className="bd-btn bd-btn--ghost bd-btn--sm">Denne uge</Link>
        )}
        <Link href={weekHref(addWeeks(firstWeek, 1))} className="bd-btn bd-btn--secondary bd-btn--sm">Næste uge →</Link>
      </nav>

      {employees.length === 0 ? (
        <div className="bd-empty">
          <strong>Ingen medarbejdere</strong>
          Medarbejdere oprettes i #18.
        </div>
      ) : (
        <div className="bd-table-wrap">
          <table className="bd-table">
            <thead>
              <tr>
                <th>Medarbejder / projekt</th>
                {weeks.map((week) => (
                  <th key={week.getTime()} className="num" aria-current={week.getTime() === thisWeek.getTime() ? 'date' : undefined}>
                    Uge {isoWeek(week)}
                    <div className="bd-meta normal-case tracking-normal">
                      {week.getTime() === thisWeek.getTime() ? 'denne uge' : formatShortDate(week)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            {/* Én <tbody> pr. medarbejder: samlet FTE pr. uge og fordelingen pr. projekt under */}
            {employees.map((employee) => {
              const levels = employee.totals.map(bookingLevel);
              // Rød stribe, hvis overbooket i en af ugerne; ellers orange, hvis der er ledig tid
              const severity = levels.includes('over') ? 'blocker' : levels.includes('under') ? 'major' : undefined;
              return (
                <CollapsibleTableGroup
                  key={employee.id}
                  label={employee.name}
                  meta={`1,0 = ${formatHours(employee.weeklyCapacity)} t`}
                  severity={severity}
                  defaultOpen={false}
                  headerCells={employee.totals.map((fte, index) => (
                    <FteCell key={weeks[index].getTime()} fte={fte} isTotal />
                  ))}
                >
                  {employee.projects.map((project) => (
                    <tr key={project.id}>
                      <td className="bd-tree-child">
                        <Link href={`/projekter/${project.id}`}>{project.name}</Link>
                      </td>
                      {project.fte.map((fte, index) => (
                        <FteCell key={weeks[index].getTime()} fte={fte} />
                      ))}
                    </tr>
                  ))}
                </CollapsibleTableGroup>
              );
            })}
          </table>
        </div>
      )}

      <p className="bd-meta m-0">
        Tallene er FTE: hver medarbejder har {formatFte(FULL_TIME)} pr. uge at fordele.{' '}
        <span className="font-semibold text-bd-danger">Rødt</span>: overbooket (over {formatFte(FULL_TIME)}).{' '}
        <span className="font-semibold text-bd-warn">Orange</span>: ledig tid (under {formatFte(UNDERBOOKED_BELOW)}).
      </p>
    </>
  );
}
