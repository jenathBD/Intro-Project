'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { ProjectKind } from '@/app/generated/prisma/client';
import { CollapsibleTableGroup } from '@/components/collapsible-table-group';
import { byKindAndName, canAllocate } from '@/lib/allocation';
import { bookingLevel } from '@/lib/capacity';
import type { AllocatableProject, AllocationGridEmployee } from '@/lib/data/allocations';
import { formatFte, formatHours } from '@/lib/format';
import { isoWeek, toWeekParam } from '@/lib/weeks';
import { setAllocation } from './actions';

// FTE-summer afrundes til én decimal, fordi 0,2 + 0,4 + 0,4 ellers bliver 1,0000000000000002
const roundFte = (value: number) => Math.round(value * 10) / 10;

const KIND_LABELS: Record<ProjectKind, string> = { client: 'Kundeprojekter', internal: 'Interne', absence: 'Fravær' };

// Summen pr. uge i forhold til medarbejderens kapacitet: over = rødt (overbooket), under = orange (ledig tid).
// Intern tid tæller som planlagt, men fremhæves med blå baggrund (#44). Fravær fremhæves ikke.
function TotalCell({ fte, capacity, internal }: { fte: number; capacity: number; internal: number }) {
  const level = bookingLevel(fte, capacity);
  const classes = [
    'num',
    level === 'over' && 'font-semibold text-bd-danger',
    level === 'under' && 'font-semibold text-bd-warn',
    internal > 0 && 'bd-cell-internal',
  ].filter(Boolean);
  const notes = [
    level === 'over' && 'overbooket',
    level === 'under' && 'ledig tid',
    internal > 0 && `heraf ${formatFte(internal)} intern tid`,
  ].filter(Boolean);
  return (
    <td className={classes.join(' ')}>
      {formatFte(fte)}
      {/* Farverne kan ikke ses af skærmlæsere */}
      {notes.length > 0 && <span className="sr-only"> {notes.join(', ')}</span>}
    </td>
  );
}

type Props = {
  employee: AllocationGridEmployee;
  weeks: Date[];
  /** Aktive projekter, der kan allokeres, med periode og type */
  projects: AllocatableProject[];
};

// Én medarbejder i ugegridet med redigerbare FTE-celler pr. projekt og uge (#17, #44)
export function EditableEmployee({ employee, weeks, projects }: Props) {
  const [rows, setRows] = useState(employee.projects);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Summen beregnes her i browseren, så farverne skifter med det samme, mens der gemmes i baggrunden
  const sumWeek = (w: number, kind?: ProjectKind) =>
    roundFte(rows.filter((row) => !kind || row.kind === kind).reduce((sum, row) => sum + row.fte[w], 0));
  const totals = weeks.map((_, w) => sumWeek(w));
  const internal = weeks.map((_, w) => sumWeek(w, 'internal'));
  // Skrevet ud med vilje: totals.map(bookingLevel) ville sende indekset (0, 1, 2 …) ind som kapacitet
  const levels = totals.map((fte) => bookingLevel(fte, employee.capacityFte));
  const severity = levels.includes('over') ? 'blocker' : levels.includes('under') ? 'major' : undefined;

  const available = projects.filter((p) => !rows.some((row) => row.id === p.id));
  const availableByKind = (['client', 'internal', 'absence'] as const)
    .map((kind) => ({ kind, projects: available.filter((p) => p.kind === kind) }))
    .filter((group) => group.projects.length > 0);

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

  // Kun tomme rækker kan fjernes, så en planlægning ikke slettes ved et klik
  function removeRow(projectId: string) {
    setRows((current) => current.filter((row) => row.id !== projectId || row.fte.some((fte) => fte !== 0)));
  }

  function addProject(projectId: string) {
    const project = projects.find((p) => p.id === projectId);
    // Det nye projekt sættes ind på sin plads: kundeprojekter, interne, fravær, og alfabetisk inden for hver type
    if (project) {
      setRows((current) =>
        [...current, { id: project.id, name: project.name, kind: project.kind, fte: weeks.map(() => 0) }].sort(byKindAndName),
      );
    }
  }

  return (
    <CollapsibleTableGroup
      label={employee.name}
      meta={`${formatHours(employee.weeklyCapacity)} t · ${formatFte(employee.capacityFte)} FTE`}
      severity={severity}
      defaultOpen={false}
      headerCells={totals.map((fte, w) => (
        <TotalCell key={weeks[w].getTime()} fte={fte} capacity={employee.capacityFte} internal={internal[w]} />
      ))}
    >
      {rows.map((row) => {
        const project = projects.find((p) => p.id === row.id);
        return (
          <tr key={row.id} className={row.kind === 'absence' ? 'bd-row-absence' : undefined}>
            <td className="bd-tree-child">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {row.kind === 'absence' ? row.name : <Link href={`/projekter/${row.id}`}>{row.name}</Link>}
                  {row.kind !== 'client' && <span className="bd-meta"> · {row.kind === 'internal' ? 'intern' : 'fravær'}</span>}
                </span>
                {/* En tom række (ingen FTE i de viste uger) har intet i databasen og kan bare fjernes fra visningen */}
                {row.fte.every((fte) => fte === 0) && (
                  <button
                    type="button"
                    className="bd-btn bd-btn--ghost bd-btn--sm"
                    onClick={() => removeRow(row.id)}
                    aria-label={`Fjern ${row.name} fra ${employee.name}`}
                  >
                    Fjern
                  </button>
                )}
              </div>
            </td>
            {row.fte.map((fte, w) => {
              const week = weeks[w];
              // Uden for et kundeprojekts periode (eller arkiveret projekt) kan der ikke allokeres
              if (!project || !canAllocate(project, week)) {
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

      {availableByKind.length > 0 && (
        <tr>
          <td className="bd-tree-child" colSpan={weeks.length + 1}>
            <select
              className="bd-select bd-select--sm"
              value=""
              onChange={(event) => addProject(event.target.value)}
              aria-label={`Tilføj projekt eller fravær til ${employee.name}`}
            >
              <option value="">+ Tilføj projekt eller fravær</option>
              {availableByKind.map((group) => (
                <optgroup key={group.kind} label={KIND_LABELS[group.kind]}>
                  {group.projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </optgroup>
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
