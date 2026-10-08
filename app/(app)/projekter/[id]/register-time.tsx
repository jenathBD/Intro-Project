'use client';

import { useActionState, useEffect, useState } from 'react';
import { Dialog } from '@/components/dialog';
import type { EmployeeOption } from '@/lib/data/employees';
import { registerTime, type RegisterTimeState } from './actions';

// Dagens dato i brugerens egen tidszone som "YYYY-MM-DD" (ikke UTC, som toISOString ville give)
function localToday() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

type Props = {
  workPackageId: string;
  workPackageName: string;
  employees: EmployeeOption[];
  defaultEmployeeId: string | null;
};

// Knap og dialog til at registrere tid på én arbejdspakke
export function RegisterTimeButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function handleSaved(message: string) {
    setOpen(false);
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <>
      <button type="button" className="bd-btn bd-btn--secondary bd-btn--sm" onClick={() => setOpen(true)}>
        Registrér tid
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={`register-${props.workPackageId}`}>
        <RegisterTimeForm {...props} onCancel={() => setOpen(false)} onSaved={handleSaved} />
      </Dialog>
      {toast && (
        <div className="bd-toast-region" role="status">
          <div className="bd-toast">{toast}</div>
        </div>
      )}
    </>
  );
}

function RegisterTimeForm({
  workPackageId,
  workPackageName,
  employees,
  defaultEmployeeId,
  onCancel,
  onSaved,
}: Props & { onCancel: () => void; onSaved: (message: string) => void }) {
  const [state, action, pending] = useActionState(registerTime, {} as RegisterTimeState);

  // Luk dialogen, når serveren har gemt. Effekten synkroniserer med noget uden for React (dialogen).
  // Kun state som afhængighed: onSaved er en ny funktion ved hver rendering og må ikke udløse effekten igen.
  useEffect(() => {
    if (state.ok && state.message) onSaved(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="grid gap-4">
      <header className="bd-page-head">
        <p className="bd-eyebrow">Registrér tid</p>
        <h2 id={`register-${workPackageId}`} className="bd-h2">{workPackageName}</h2>
      </header>

      {state.error && <p role="alert" className="bd-callout bd-callout--blocker m-0">{state.error}</p>}

      <input type="hidden" name="workPackageId" value={workPackageId} />

      <div className="bd-field">
        <label className="bd-label" htmlFor={`employee-${workPackageId}`}>Medarbejder</label>
        <select id={`employee-${workPackageId}`} name="employeeId" className="bd-select" defaultValue={defaultEmployeeId ?? ''} required>
          <option value="" disabled>Vælg medarbejder</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bd-field">
          <label className="bd-label" htmlFor={`date-${workPackageId}`}>Dato</label>
          <input id={`date-${workPackageId}`} name="date" type="date" className="bd-input" defaultValue={localToday()} max={localToday()} required />
        </div>
        <div className="bd-field">
          <label className="bd-label" htmlFor={`hours-${workPackageId}`}>Timer</label>
          <input id={`hours-${workPackageId}`} name="hours" type="number" inputMode="decimal" className="bd-input" min={0.25} max={24} step={0.25} required />
        </div>
      </div>

      <div className="bd-field">
        <label className="bd-label" htmlFor={`description-${workPackageId}`}>Beskrivelse</label>
        <textarea id={`description-${workPackageId}`} name="description" className="bd-textarea" rows={2} />
        <span className="bd-hint">Valgfri. Hvad blev der arbejdet på?</span>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="bd-btn bd-btn--ghost" onClick={onCancel}>Annullér</button>
        <button className="bd-btn bd-btn--primary" disabled={pending}>
          {pending ? 'Gemmer …' : 'Gem timer'}
        </button>
      </div>
    </form>
  );
}
