import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { bookingLevel, FULL_TIME_HOURS } from '@/lib/capacity';
import { getAllocationGrid } from '@/lib/data/allocations';
import { formatFte, formatShortDate } from '@/lib/format';
import { addWeeks, isoWeek, mondayOf, parseWeekParam, toWeekParam } from '@/lib/weeks';
import { EditableEmployee } from './editable-employee';

/** Antal uger, der vises ad gangen */
const WEEKS_SHOWN = 6;

export default async function AllocationPage({ searchParams }: PageProps<'/allokering'>) {
  const thisWeek = mondayOf(new Date());
  // ?uge=2026-10-12 vælger første viste uge. Mangler den eller er ugyldig, vises denne uge.
  const firstWeek = parseWeekParam((await searchParams).uge) ?? thisWeek;
  const { weeks, employees, projects } = await getAllocationGrid(firstWeek, WEEKS_SHOWN);

  const weekHref = (week: Date) =>
    week.getTime() === thisWeek.getTime() ? '/allokering' : `/allokering?uge=${toWeekParam(week)}`;

  // Overskriften siger konklusionen for den første viste uge (BD-styleguide)
  const week = isoWeek(weeks[0]);
  const overbooked = employees.filter((e) => bookingLevel(e.totals[0], e.capacityFte) === 'over').length;
  const underbooked = employees.filter((e) => bookingLevel(e.totals[0], e.capacityFte) === 'under').length;
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
          {/* Faste kolonnebredder, så kolonnerne ikke hopper, når en medarbejder foldes ud */}
          <table className="bd-table bd-table--fixed">
            <colgroup>
              <col className="bd-col-label" />
              {weeks.map((week) => (
                <col key={week.getTime()} />
              ))}
            </colgroup>
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
            {/* Én <tbody> pr. medarbejder. key indeholder ugen, så rækken starter forfra, når man bladrer. */}
            {employees.map((employee) => (
              <EditableEmployee
                key={`${employee.id}|${toWeekParam(weeks[0])}`}
                employee={employee}
                weeks={weeks}
                projects={projects}
              />
            ))}
          </table>
        </div>
      )}

      <p className="bd-meta m-0">
        Fold en medarbejder ud, og skriv FTE i trin af {formatFte(0.1)} (tom eller 0 fjerner). 1,0 FTE ={' '}
        {FULL_TIME_HOURS} t; på deltid er kapaciteten lavere (fx 30 t = 0,8 FTE).{' '}
        <span className="font-semibold text-bd-danger">Rødt</span>: overbooket (over kapaciteten).{' '}
        <span className="font-semibold text-bd-warn">Orange</span>: ledig tid (under kapaciteten).{' '}
        <span className="bd-cell-internal px-1">Blå baggrund</span>: noget af ugen er intern tid. Intern tid
        og fravær tæller som planlagt. Ferie og helligdage skrives ind på <em>Ferie</em> (1 dag = 0,2 FTE).
      </p>
    </>
  );
}
