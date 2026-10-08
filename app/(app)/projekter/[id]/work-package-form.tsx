'use client';

import { useId, useState, useTransition } from 'react';
import { FormDialogButton } from '@/components/form-dialog';
import { WORK_PACKAGE_STATUSES } from '@/components/work-package-status';
import type { CategoryOption } from '@/lib/data/categories';
import type { EmployeeOption } from '@/lib/data/employees';
import type { EpicOption, WorkPackageRow } from '@/lib/data/projects';
import { formatHours } from '@/lib/format';
import { NEW_CATEGORY, NEW_EPIC } from '@/lib/work-package';
import { deleteWorkPackage, saveWorkPackage } from './actions';

// Datoer fra @db.Date er midnat UTC, så "YYYY-MM-DD" tages fra ISO-strengen og ikke fra lokal tid
const dateValue = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : '');

type Props = {
  projectId: string;
  /** Projektets repo. Med repo kan en ny pakke oprettes som issue (#25). */
  githubRepo: string | null;
  /** Uden workPackage oprettes en ny; med redigeres den */
  workPackage?: WorkPackageRow;
  categories: CategoryOption[];
  /** Projektets epics (#50) */
  epics: EpicOption[];
  employees: EmployeeOption[];
};

// Opret eller redigér en arbejdspakke (#14). Ved redigering er triggeren pakkens navn.
export function WorkPackageFormButton({ projectId, githubRepo, workPackage, categories, epics, employees }: Props) {
  const id = useId();
  const [category, setCategory] = useState(workPackage?.categoryId ?? '');
  const [epic, setEpic] = useState(workPackage?.epicId ?? '');

  return (
    <FormDialogButton
      buttonLabel={workPackage ? workPackage.name : 'Tilføj arbejdspakke'}
      buttonClassName={workPackage ? 'bd-link-button text-left' : 'bd-btn bd-btn--primary'}
      buttonAriaLabel={workPackage ? `Redigér ${workPackage.name}` : undefined}
      eyebrow={workPackage ? 'Redigér arbejdspakke' : 'Ny arbejdspakke'}
      heading={workPackage ? workPackage.name : 'Tilføj arbejdspakke'}
      action={saveWorkPackage}
      submitLabel={workPackage ? 'Gem ændringer' : 'Tilføj arbejdspakke'}
      wide
      footer={workPackage ? (close, showToast) => <DeleteButton workPackage={workPackage} onDeleted={showToast} /> : undefined}
    >
      <input type="hidden" name="projectId" value={projectId} />
      {workPackage && <input type="hidden" name="id" value={workPackage.id} />}

      <div className="bd-field">
        <label className="bd-label" htmlFor={`${id}-name`}>Navn</label>
        <input id={`${id}-name`} name="name" className="bd-input" defaultValue={workPackage?.name} required autoComplete="off" />
      </div>

      <div className="bd-field">
        <label className="bd-label" htmlFor={`${id}-description`}>Beskrivelse</label>
        <textarea id={`${id}-description`} name="description" className="bd-textarea" rows={2} defaultValue={workPackage?.description ?? ''} />
        <span className="bd-hint">Valgfri.</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bd-field">
          <label className="bd-label" htmlFor={`${id}-category`}>Kategori</label>
          <select
            id={`${id}-category`}
            name="categoryId"
            className="bd-select"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
          >
            <option value="" disabled>Vælg kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value={NEW_CATEGORY}>+ Ny kategori …</option>
          </select>
          {category === NEW_CATEGORY && (
            <input
              name="newCategory"
              className="bd-input"
              placeholder="Navn på den nye kategori"
              aria-label="Navn på den nye kategori"
              required
              autoFocus
              autoComplete="off"
            />
          )}
        </div>

        <div className="bd-field">
          <label className="bd-label" htmlFor={`${id}-responsible`}>Ansvarlig</label>
          <select id={`${id}-responsible`} name="responsibleId" className="bd-select" defaultValue={workPackage?.responsibleId ?? ''}>
            <option value="">Ingen ansvarlig endnu</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <span className="bd-hint">Den, man spørger. Hvem der arbejder på pakken, styres i allokeringen.</span>
        </div>
      </div>

      <div className="bd-field">
        <label className="bd-label" htmlFor={`${id}-epic`}>Epic</label>
        <select id={`${id}-epic`} name="epicId" className="bd-select" value={epic} onChange={(event) => setEpic(event.target.value)}>
          <option value="">Intet epic</option>
          {epics.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
          <option value={NEW_EPIC}>+ Nyt epic …</option>
        </select>
        {epic === NEW_EPIC && (
          <input
            name="newEpic"
            className="bd-input"
            placeholder="Navn på det nye epic"
            aria-label="Navn på det nye epic"
            required
            autoFocus
            autoComplete="off"
          />
        )}
        <span className="bd-hint">Valgfri. Løbende pakker som projektledelse hører typisk ikke til et epic.</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="bd-field">
          <label className="bd-label" htmlFor={`${id}-status`}>Status</label>
          <select id={`${id}-status`} name="status" className="bd-select" defaultValue={workPackage?.status ?? 'notStarted'}>
            {Object.entries(WORK_PACKAGE_STATUSES).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="bd-field">
          <label className="bd-label" htmlFor={`${id}-estimate`}>Estimat (t)</label>
          <input
            id={`${id}-estimate`}
            name="estimateHours"
            type="number"
            inputMode="decimal"
            className="bd-input"
            min={0.25}
            step={0.25}
            // Uden estimat er estimateHours 0, så feltet skal stå tomt
            defaultValue={workPackage?.estimated ? workPackage.estimateHours : undefined}
          />
        </div>
        <div className="bd-field">
          <label className="bd-label" htmlFor={`${id}-start`}>Start</label>
          <input id={`${id}-start`} name="startDate" type="date" className="bd-input" defaultValue={dateValue(workPackage?.startDate)} />
        </div>
        <div className="bd-field">
          <label className="bd-label" htmlFor={`${id}-end`}>Slut</label>
          <input id={`${id}-end`} name="endDate" type="date" className="bd-input" defaultValue={dateValue(workPackage?.endDate)} />
        </div>
      </div>

      {/* Kun ved oprettelse: pakker med issue skrives til GitHub, når de gemmes (#51) */}
      {!workPackage && githubRepo && (
        <label className="flex items-start gap-2">
          <input type="checkbox" name="createIssue" defaultChecked className="mt-1" />
          <span>
            <span className="font-semibold">Opret som issue på GitHub</span>
            <span className="bd-hint block">
              I {githubRepo}, med kategori og epic. Et epic, der kun findes her, oprettes også.
            </span>
          </span>
        </label>
      )}

      <p className="bd-hint m-0">
        Ansvarlig, estimat og datoer er valgfrie. Uden estimat er al tid på pakken over budget og
        markeres med rødt. Uden slutdato er den ikke med i bemandingstjekket.{' '}
        {workPackage
          ? 'Et ændret estimat ændrer ikke resterende. Resterende er udviklerens vurdering og opdateres ved at klikke på tallet.'
          : 'Resterende starter med at være lig estimatet.'}
      </p>
    </FormDialogButton>
  );
}

// Slet med bekræftelse i to trin. Pakker med registreret tid kan ikke slettes, og det forklares i stedet.
function DeleteButton({ workPackage, onDeleted }: { workPackage: WorkPackageRow; onDeleted: (message: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (workPackage.spentHours > 0) {
    return (
      <span className="bd-hint max-w-xs">
        Kan ikke slettes: der er registreret {formatHours(workPackage.spentHours)} t. Sæt status til Afsluttet i stedet.
      </span>
    );
  }

  if (!confirming) {
    return (
      <button type="button" className="bd-btn bd-btn--danger" onClick={() => setConfirming(true)}>
        Slet
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="bd-btn bd-btn--danger"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteWorkPackage(workPackage.id);
            if (result.ok && result.message) onDeleted(result.message);
            else setError(result.error ?? 'Vi kunne ikke slette arbejdspakken. Prøv igen.');
          })
        }
      >
        {pending ? 'Sletter …' : 'Ja, slet permanent'}
      </button>
      <button type="button" className="bd-btn bd-btn--ghost" onClick={() => setConfirming(false)}>Fortryd</button>
      {error && <span role="alert" className="bd-hint text-bd-danger">{error}</span>}
    </span>
  );
}
