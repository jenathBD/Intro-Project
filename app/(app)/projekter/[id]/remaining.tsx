'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { Dialog } from '@/components/dialog';
import type { RemainingUpdateRow } from '@/lib/data/remaining';
import { formatDateTime, formatDaysAgo, formatHours, formatSignedHours } from '@/lib/format';
import { loadRemainingHistory, updateRemaining, type UpdateRemainingState } from './actions';

type Props = {
  workPackageId: string;
  workPackageName: string;
  hours: number;
  updatedAt: Date | null;
  /** false på arkiverede projekter: historikken kan ses, men ikke ændres */
  canEdit: boolean;
};

// "Resterende"-tallet som knap. Klik åbner en dialog med formular og historik (#13).
export function RemainingButton(props: Props) {
  const { workPackageId, workPackageName, hours } = props;
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function handleSaved(message: string) {
    setOpen(false);
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <>
      <button
        type="button"
        className="bd-link-button"
        onClick={() => setOpen(true)}
        aria-label={`${formatHours(hours)} timer resterende på ${workPackageName}. Opdatér eller se historik`}
      >
        {formatHours(hours)}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={`remaining-${workPackageId}`} wide>
        <RemainingDialogContent {...props} onClose={() => setOpen(false)} onSaved={handleSaved} />
      </Dialog>
      {toast && (
        <div className="bd-toast-region" role="status">
          <div className="bd-toast">{toast}</div>
        </div>
      )}
    </>
  );
}

function RemainingDialogContent({
  workPackageId,
  workPackageName,
  hours,
  updatedAt,
  canEdit,
  onClose,
  onSaved,
}: Props & { onClose: () => void; onSaved: (message: string) => void }) {
  const [state, action, pending] = useActionState(updateRemaining, {} as UpdateRemainingState);
  const [history, setHistory] = useState<RemainingUpdateRow[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [loading, startTransition] = useTransition();

  // Historikken hentes, når dialogen åbner (indholdet findes kun, mens den er åben)
  useEffect(() => {
    startTransition(async () => {
      try {
        setHistory(await loadRemainingHistory(workPackageId));
      } catch {
        setHistoryError(true);
      }
    });
  }, [workPackageId]);

  // Luk dialogen, når serveren har gemt (kun state som afhængighed, se register-time.tsx)
  useEffect(() => {
    if (state.ok && state.message) onSaved(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="grid gap-5">
      <header className="bd-page-head">
        <p className="bd-eyebrow">Resterende</p>
        <h2 id={`remaining-${workPackageId}`} className="bd-h2">{workPackageName}</h2>
        <p className="bd-meta m-0">
          Nu: {formatHours(hours)} t
          {updatedAt ? ` · opdateret ${formatDateTime(updatedAt)} (${formatDaysAgo(updatedAt)})` : ' · aldrig vurderet'}
        </p>
      </header>

      {canEdit ? (
        <form action={action} className="grid gap-4">
          {state.error && <p role="alert" className="bd-callout bd-callout--blocker m-0">{state.error}</p>}
          <input type="hidden" name="workPackageId" value={workPackageId} />
          <div className="bd-field">
            <label className="bd-label" htmlFor={`remaining-hours-${workPackageId}`}>Hvor mange timer er der tilbage?</label>
            <input
              id={`remaining-hours-${workPackageId}`}
              name="remainingHours"
              type="number"
              inputMode="decimal"
              className="bd-input max-w-40"
              min={0}
              step={0.25}
              defaultValue={hours}
              required
            />
            <span className="bd-hint">Din bedste vurdering af det, der mangler. Ikke estimat minus brugt.</span>
          </div>
          <div className="bd-field">
            <label className="bd-label" htmlFor={`remaining-comment-${workPackageId}`}>Kommentar</label>
            <textarea id={`remaining-comment-${workPackageId}`} name="comment" className="bd-textarea" rows={2} />
            <span className="bd-hint">Valgfri. Fx hvorfor vurderingen har ændret sig.</span>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="bd-btn bd-btn--ghost" onClick={onClose}>Annullér</button>
            <button className="bd-btn bd-btn--primary" disabled={pending}>
              {pending ? 'Gemmer …' : 'Gem resterende'}
            </button>
          </div>
        </form>
      ) : (
        <p className="bd-callout m-0">Projektet er arkiveret, så resterende kan ikke ændres.</p>
      )}

      <section className="grid gap-3" aria-label="Historik">
        <h3 className="bd-eyebrow">Historik</h3>
        {loading || (!history && !historyError) ? (
          <p className="bd-meta m-0">Henter historik …</p>
        ) : historyError ? (
          <p role="alert" className="bd-callout bd-callout--blocker m-0">Vi kunne ikke hente historikken. Luk dialogen, og prøv igen.</p>
        ) : history!.length === 0 ? (
          <p className="bd-meta m-0">Ingen vurderinger endnu.</p>
        ) : (
          <div className="bd-table-wrap max-h-[40vh] overflow-y-auto">
            <table className="bd-table">
              <thead>
                <tr>
                  <th>Tidspunkt</th>
                  <th className="num">Resterende (t)</th>
                  <th className="num">Ændring (t)</th>
                  <th>Kommentar</th>
                  <th>Af</th>
                </tr>
              </thead>
              <tbody>
                {history!.map((update, index) => {
                  // Ændring i forhold til den forrige (ældre) vurdering. Stigning = mere arbejde end troet.
                  const previous = history![index + 1];
                  const change = previous ? update.remainingHours - previous.remainingHours : null;
                  return (
                    <tr key={update.id}>
                      <td className="whitespace-nowrap">{formatDateTime(update.createdAt)}</td>
                      <td className="num">{formatHours(update.remainingHours)}</td>
                      <td className={change !== null && change > 0 ? 'num text-bd-danger' : 'num'}>
                        {change === null || change === 0 ? '–' : formatSignedHours(change)}
                      </td>
                      <td>{update.comment ?? <span className="bd-meta">–</span>}</td>
                      <td className="whitespace-nowrap">{update.userName ?? <span className="bd-meta">Seed</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
