'use client';

import { useRef, useState, useTransition } from 'react';
import type { TimeEntrySource } from '@/app/generated/prisma/client';
import type { TimeEntryRow } from '@/lib/data/time-entries';
import { formatHours, formatShortDate } from '@/lib/format';
import { loadTimeEntries } from './actions';

const SOURCE_LABELS: Record<TimeEntrySource, string> = { manual: 'Manuel', clockify: 'Clockify', mock: 'Mock' };

// "Brugt"-tallet som knap. Klik åbner en dialog med registreringerne, som først hentes nu.
export function SpentHoursButton({
  workPackageId,
  workPackageName,
  hours,
}: {
  workPackageId: string;
  workPackageName: string;
  hours: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<TimeEntryRow[] | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function open() {
    setEntries(null);
    setError(false);
    dialogRef.current?.showModal();
    // Hentes forfra hver gang, så nye registreringer altid er med
    startTransition(async () => {
      try {
        setEntries(await loadTimeEntries(workPackageId));
      } catch {
        setError(true);
      }
    });
  }

  const total = entries?.reduce((sum, entry) => sum + entry.hours, 0) ?? 0;

  return (
    <>
      <button
        type="button"
        className="bd-link-button"
        onClick={open}
        aria-label={`${formatHours(hours)} timer brugt på ${workPackageName}. Vis registreringer`}
      >
        {formatHours(hours)}
      </button>
      <dialog ref={dialogRef} className="bd-dialog bd-dialog--wide" aria-labelledby={`entries-${workPackageId}`}>
        <div className="grid gap-4">
          <header className="bd-page-head">
            <p className="bd-eyebrow">Tidsregistreringer</p>
            <h2 id={`entries-${workPackageId}`} className="bd-h2">{workPackageName}</h2>
          </header>

          {pending || (!entries && !error) ? (
            <p className="bd-meta m-0">Henter registreringer …</p>
          ) : error ? (
            <p role="alert" className="bd-callout bd-callout--blocker m-0">
              Vi kunne ikke hente registreringerne. Luk dialogen, og prøv igen.
            </p>
          ) : entries!.length === 0 ? (
            <div className="bd-empty">
              <strong>Ingen registreringer endnu</strong>
              Brug "Registrér tid" for at tilføje den første.
            </div>
          ) : (
            <div className="bd-table-wrap max-h-[60vh] overflow-y-auto">
              <table className="bd-table">
                <thead>
                  <tr>
                    <th>Dato</th>
                    <th>Medarbejder</th>
                    <th className="num">Timer</th>
                    <th>Beskrivelse</th>
                    <th>Kilde</th>
                  </tr>
                </thead>
                <tbody>
                  {entries!.map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap">{formatShortDate(entry.date)}</td>
                      <td className="whitespace-nowrap">{entry.employeeName}</td>
                      <td className="num">{formatHours(entry.hours)}</td>
                      <td>{entry.description ?? <span className="bd-meta">–</span>}</td>
                      <td><span className="bd-badge bd-badge--plain">{SOURCE_LABELS[entry.source]}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>I alt ({entries!.length} registreringer)</td>
                    <td className="num">{formatHours(total)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" className="bd-btn bd-btn--secondary" onClick={() => dialogRef.current?.close()}>
              Luk
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
