'use client';

import { useId } from 'react';
import { FormDialogButton } from '@/components/form-dialog';
import { FULL_TIME_HOURS } from '@/lib/capacity';
import type { EmployeeRow, TitleRow } from '@/lib/data/employees';
import { saveEmployee, saveTitle } from './actions';

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
