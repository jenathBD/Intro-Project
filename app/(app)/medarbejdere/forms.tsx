'use client';

import { useActionState, useEffect, useId, useState, type ReactNode } from 'react';
import { Dialog } from '@/components/dialog';
import { FULL_TIME_HOURS } from '@/lib/capacity';
import type { EmployeeRow, TitleRow } from '@/lib/data/employees';
import { saveEmployee, saveTitle, type SaveState } from './actions';

type SaveAction = (prev: SaveState, formData: FormData) => Promise<SaveState>;

// Knap, der åbner en dialog med en formular. Efter gem lukkes dialogen, og der vises en toast.
function FormDialogButton({
  buttonLabel,
  buttonClassName,
  eyebrow,
  heading,
  action,
  submitLabel,
  children,
}: {
  buttonLabel: string;
  buttonClassName: string;
  eyebrow: string;
  heading: string;
  action: SaveAction;
  submitLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const headingId = useId();

  function handleSaved(message: string) {
    setOpen(false);
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={headingId}>
        <DialogForm action={action} submitLabel={submitLabel} onCancel={() => setOpen(false)} onSaved={handleSaved}>
          <header className="bd-page-head">
            <p className="bd-eyebrow">{eyebrow}</p>
            <h2 id={headingId} className="bd-h2">{heading}</h2>
          </header>
          {children}
        </DialogForm>
      </Dialog>
      {toast && (
        <div className="bd-toast-region" role="status">
          <div className="bd-toast">{toast}</div>
        </div>
      )}
    </>
  );
}

function DialogForm({
  action,
  submitLabel,
  onCancel,
  onSaved,
  children,
}: {
  action: SaveAction;
  submitLabel: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {} as SaveState);

  // Luk dialogen, når serveren har gemt (kun state som afhængighed, se register-time.tsx)
  useEffect(() => {
    if (state.ok && state.message) onSaved(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4">
      {children}
      {state.error && <p role="alert" className="bd-callout bd-callout--blocker m-0">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="bd-btn bd-btn--ghost" onClick={onCancel}>Annullér</button>
        <button className="bd-btn bd-btn--primary" disabled={pending}>{pending ? 'Gemmer …' : submitLabel}</button>
      </div>
    </form>
  );
}

// Opret (uden employee) eller redigér (med employee) en medarbejder
export function EmployeeFormButton({ employee, titles }: { employee?: EmployeeRow; titles: TitleRow[] }) {
  const id = useId();
  return (
    <FormDialogButton
      buttonLabel={employee ? 'Redigér' : 'Opret medarbejder'}
      buttonClassName={employee ? 'bd-btn bd-btn--secondary bd-btn--sm' : 'bd-btn bd-btn--primary'}
      eyebrow={employee ? 'Redigér medarbejder' : 'Ny medarbejder'}
      heading={employee ? employee.name : 'Opret medarbejder'}
      action={saveEmployee}
      submitLabel={employee ? 'Gem ændringer' : 'Opret medarbejder'}
    >
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <div className="bd-field">
        <label className="bd-label" htmlFor={`${id}-name`}>Navn</label>
        <input id={`${id}-name`} name="name" className="bd-input" defaultValue={employee?.name} required autoComplete="off" />
      </div>
      <div className="bd-field">
        <label className="bd-label" htmlFor={`${id}-title`}>Titel</label>
        <select id={`${id}-title`} name="titleId" className="bd-select" defaultValue={employee?.titleId ?? ''} required>
          <option value="" disabled>Vælg titel</option>
          {titles.map((title) => (
            <option key={title.id} value={title.id}>{title.name}</option>
          ))}
        </select>
        <span className="bd-hint">Titlen bestemmer timeprisen på projekter med titelpriser.</span>
      </div>
      <div className="bd-field">
        <label className="bd-label" htmlFor={`${id}-capacity`}>Ugentlig kapacitet (timer)</label>
        <input
          id={`${id}-capacity`}
          name="weeklyCapacity"
          type="number"
          inputMode="decimal"
          className="bd-input max-w-40"
          min={1}
          max={60}
          step={0.5}
          defaultValue={employee?.weeklyCapacity ?? FULL_TIME_HOURS}
          required
        />
        <span className="bd-hint">{FULL_TIME_HOURS} t = 1,0 FTE. Deltid, fx 30 t = 0,8 FTE.</span>
      </div>
    </FormDialogButton>
  );
}

// Opret (uden title) eller redigér (med title) en titel
export function TitleFormButton({ title }: { title?: TitleRow }) {
  const id = useId();
  return (
    <FormDialogButton
      buttonLabel={title ? 'Redigér' : 'Opret titel'}
      buttonClassName={title ? 'bd-btn bd-btn--secondary bd-btn--sm' : 'bd-btn bd-btn--secondary'}
      eyebrow={title ? 'Redigér titel' : 'Ny titel'}
      heading={title ? title.name : 'Opret titel'}
      action={saveTitle}
      submitLabel={title ? 'Gem ændringer' : 'Opret titel'}
    >
      {title && <input type="hidden" name="id" value={title.id} />}
      <div className="bd-field">
        <label className="bd-label" htmlFor={`${id}-name`}>Navn</label>
        <input id={`${id}-name`} name="name" className="bd-input" defaultValue={title?.name} required autoComplete="off" />
      </div>
      <div className="bd-field">
        <label className="bd-label" htmlFor={`${id}-rate`}>Standardpris (kr. pr. time)</label>
        <input
          id={`${id}-rate`}
          name="standardRate"
          type="number"
          inputMode="decimal"
          className="bd-input max-w-40"
          min={0}
          step={1}
          defaultValue={title?.standardRate}
          required
        />
        <span className="bd-hint">
          Bruges på projekter med titelpriser, medmindre projektet har aftalt en anden pris. En ændring gælder kun ny tid;
          registreret tid beholder sin pris.
        </span>
      </div>
    </FormDialogButton>
  );
}
