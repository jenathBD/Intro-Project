'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { CollapsibleTableGroup } from '@/components/collapsible-table-group';
import { bookingLevel } from '@/lib/capacity';
import type { AllocatableProject, AllocationGridEmployee } from '@/lib/data/allocations';
import { formatFte, formatHours } from '@/lib/format';
import { isoWeek, toWeekParam } from '@/lib/weeks';
import { setAllocation } from './actions';

// FTE-summer afrundes til én decimal, fordi 0,2 + 0,4 + 0,4 ellers bliver 1,0000000000000002
const roundFte = (value: number) => Math.round(value * 10) / 10;

// Summen pr. uge i forhold til medarbejderens kapacitet: over = rødt (overbooket), under 80 % = orange (ledig tid)
function TotalCell({ fte, capacity }: { fte: number; capacity: number }) {
  const level = bookingLevel(fte, capacity);
  const className =
    level === 'over' ? 'num font-semibold text-bd-danger' : level === 'under' ? 'num font-semibold text-bd-warn' : 'num';
  return (
    <td className={className}>
      {formatFte(fte)}
      {level !== 'ok' && <span className="sr-only">{level === 'over' ? ' overbooket' : ' ledig tid'}</span>}
    </td>
  );
}

type Props = {
  employee: AllocationGridEmployee;
  weeks: Date[];
  /** Aktive projekter med den periode, der kan allokeres i */
  projects: AllocatableProject[];
};

// Én medarbejder i ugegridet med redigerbare FTE-celler pr. projekt og uge (#17)
export function EditableEmployee({ employee, weeks, projects }: Props) {
  const [rows, setRows] = useState(employee.projects);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Summen beregnes her i browseren, så farverne skifter med det samme, mens der gemmes i baggrunden
  const totals = weeks.map((_, w) => roundFte(rows.reduce((sum, row) => sum + row.fte[w], 0)));
  // Skrevet ud med vilje: totals.map(bookingLevel) ville sende indekset (0, 1, 2 …) ind som kapacitet
  const levels = totals.map((fte) => bookingLevel(fte, employee.capacityFte));
  const severity = levels.includes('over') ? 'blocker' : levels.includes('under') ? 'major' : undefined;

  const available = projects.filter((p) => !rows.some((row) => row.id === p.id));

  function setCell(projectId: string, weekIndex: number, fte: number) {
    setRows((current) =>
      current.map((row) => (row.id === projectId ? { ...row, fte: row.fte.map((v, i) => (i === weekIndex ? fte : v)) } : row)),
    );
  }

  function commit(projectId: string, weekIndex: number, next: number, previous: number, input: HTMLInputElement) {
    setError(null);
    setCell(projectId, weekIndex, next); // optimistisk: vis den nye værdi med det samme
    startTransition(async () => {
      const result = await setAllocation({ employeeId: employee.id, projectId, week: toWeekParam(weeks[weekIndex]), fte: next });
      if (!result.ok) {
        // Serveren afviste: rul tilbage og fortæl hvorfor
        setCell(projectId, weekIndex, previous);
        input.value = previous ? String(previous) : '';
        setError(result.error);
      }
    });
  }

  function addProject(projectId: string) {
    const project = projects.find((p) => p.id === projectId);
    // Det nye projekt sættes ind på sin alfabetiske plads
    if (project) {
      setRows((current) =>
        [...current, { id: project.id, name: project.name, fte: weeks.map(() => 0) }].sort((a, b) =>
          a.name.localeCompare(b.name, 'da'),
        ),
      );
    }
  }

  return (
    <CollapsibleTableGroup
      label={employee.name}
      meta={`${formatHours(employee.weeklyCapacity)} t · ${formatFte(employee.capacityFte)} FTE`}
      severity={severity}
      defaultOpen={false}
      headerCells={totals.map((fte, w) => <TotalCell key={weeks[w].getTime()} fte={fte} capacity={employee.capacityFte} />)}
    >
      {rows.map((row) => {
        const project = projects.find((p) => p.id === row.id);
        return (
          <tr key={row.id}>
            <td className="bd-tree-child">
              <Link href={`/projekter/${row.id}`}>{row.name}</Link>
            </td>
            {row.fte.map((fte, w) => {
              const week = weeks[w];
              // Uden for projektets periode (eller arkiveret projekt) kan der ikke allokeres
              const editable = project && week >= project.firstWeek && week <= project.lastWeek;
              if (!editable) {
                return (
                  <td key={week.getTime()} className="num bd-meta" title="Projektet kører ikke i denne uge">
                    {fte ? formatFte(fte) : '–'}
                  </td>
                );
              }
              return (
                <td key={week.getTime()} className="num">
                  <input
                    type="number"
                    inputMode="decimal"
                    className="bd-input bd-input--cell"
                    min={0}
                    max={1}
                    step={0.1}
                    defaultValue={fte || ''}
                    placeholder="–"
                    aria-label={`${employee.name}, ${row.name}, uge ${isoWeek(week)}`}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                    onBlur={(event) => {
                      const raw = event.currentTarget.value.replace(',', '.');
                      const next = raw === '' ? 0 : Number(raw);
                      if (next !== fte) commit(row.id, w, next, fte, event.currentTarget);
                    }}
                  />
                </td>
              );
            })}
          </tr>
        );
      })}

      {available.length > 0 && (
        <tr>
          <td className="bd-tree-child" colSpan={weeks.length + 1}>
            <select
              className="bd-select bd-select--sm"
              value=""
              onChange={(event) => addProject(event.target.value)}
              aria-label={`Tilføj projekt til ${employee.name}`}
            >
              <option value="">+ Tilføj projekt</option>
              {available.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </td>
        </tr>
      )}

      {error && (
        <tr>
          <td colSpan={weeks.length + 1}>
            <p role="alert" className="bd-callout bd-callout--blocker m-0">{error}</p>
          </td>
        </tr>
      )}
    </CollapsibleTableGroup>
  );
}
