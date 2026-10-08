'use client';

import { useId, useState, useTransition } from 'react';
import type { PricingModel, ProjectKind } from '@/app/generated/prisma/client';
import { FormDialogButton } from '@/components/form-dialog';
import type { TitleRow } from '@/lib/data/employees';
import type { ProjectForEdit } from '@/lib/data/projects';
import { formatKr } from '@/lib/format';
import { saveProject, setProjectArchived } from './actions';

// Beløb vises med dansk format i felterne (1.100), så de ligner det, brugeren selv skriver
const amountText = (amount: number | null | undefined) =>
  amount === null || amount === undefined ? '' : new Intl.NumberFormat('da-DK').format(amount);

// Opret (uden project) eller redigér (med project) et projekt med prismodel (#14)
export function ProjectFormButton({ project, titles }: { project?: ProjectForEdit; titles: TitleRow[] }) {
  const id = useId();
  const [pricingModel, setPricingModel] = useState<PricingModel>(project?.pricingModel ?? 'fixed');
  const [kind, setKind] = useState<ProjectKind>(project?.kind ?? 'client');
  const agreedRate = (titleId: string) => project?.titleRates.find((rate) => rate.titleId === titleId)?.hourlyRate;

  return (
    <FormDialogButton
      buttonLabel={project ? 'Redigér projekt' : 'Opret projekt'}
      buttonClassName={project ? 'bd-btn bd-btn--secondary bd-btn--sm' : 'bd-btn bd-btn--primary'}
      eyebrow={project ? 'Redigér projekt' : 'Nyt projekt'}
      heading={project ? project.name : 'Opret projekt'}
      action={saveProject}
      submitLabel={project ? 'Gem ændringer' : 'Opret projekt'}
      wide
    >
      {project && <input type="hidden" name="id" value={project.id} />}

      {/* Projekttype (#44): kun kundeprojekter har prismodel og periode */}
      <fieldset className="bd-field m-0 border-0 p-0">
        <legend className="bd-label mb-1.5">Type</legend>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ['client', 'Kundeprojekt', 'Har prismodel og kan allokeres i projektets periode'],
              ['internal', 'Internt', 'Fx kompetenceudvikling. Ingen pris, kan altid allokeres'],
              ['absence', 'Fravær', 'Fx ferie. Ingen pris og ingen arbejdspakker'],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className="flex max-w-56 items-start gap-2">
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="mt-1" />
              <span>
                <span className="font-semibold">{label}</span>
                <span className="bd-hint block">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bd-field">
          <label className="bd-label" htmlFor={`${id}-name`}>Projektnavn</label>
          <input id={`${id}-name`} name="name" className="bd-input" defaultValue={project?.name} required autoComplete="off" />
        </div>
        <div className="bd-field">
          <label className="bd-label" htmlFor={`${id}-customer`}>{kind === 'client' ? 'Kunde' : 'Hører til'}</label>
          <input
            id={`${id}-customer`}
            name="customer"
            className="bd-input"
            defaultValue={project?.customer ?? (kind === 'client' ? '' : 'Better Developers')}
            key={kind === 'client' ? 'client' : 'other'}
            required
            autoComplete="off"
          />
        </div>
      </div>

      {kind === 'client' && (
      <>
      <fieldset className="bd-field m-0 border-0 p-0">
        <legend className="bd-label mb-1.5">Prismodel</legend>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ['fixed', 'Fast timepris', 'Samme pris for alle på projektet'],
              ['byTitle', 'Titelpriser', 'Prisen afhænger af medarbejderens titel'],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className="flex items-start gap-2">
              <input
                type="radio"
                name="pricingModel"
                value={value}
                checked={pricingModel === value}
                onChange={() => setPricingModel(value)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold">{label}</span>
                <span className="bd-hint block">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {pricingModel === 'fixed' ? (
        <div className="bd-field">
          <label className="bd-label" htmlFor={`${id}-rate`}>Timepris (kr.)</label>
          <input
            id={`${id}-rate`}
            name="hourlyRate"
            inputMode="decimal"
            className="bd-input max-w-40"
            defaultValue={amountText(project?.hourlyRate)}
            required
            autoComplete="off"
          />
        </div>
      ) : (
        <div className="bd-field">
          <span className="bd-label">Aftalte priser pr. titel (kr. pr. time)</span>
          <span className="bd-hint">Udfyld kun de titler, hvor der er aftalt en anden pris. Tomme felter bruger standardprisen.</span>
          <div className="bd-table-wrap">
            <table className="bd-table">
              <thead>
                <tr>
                  <th>Titel</th>
                  <th className="num">Standardpris</th>
                  <th className="num">Aftalt pris</th>
                </tr>
              </thead>
              <tbody>
                {titles.map((title) => (
                  <tr key={title.id}>
                    <td>
                      <label htmlFor={`${id}-title-${title.id}`}>{title.name}</label>
                    </td>
                    <td className="num bd-meta">{formatKr(title.standardRate)}</td>
                    <td className="num">
                      <input
                        id={`${id}-title-${title.id}`}
                        name={`titleRate:${title.id}`}
                        inputMode="decimal"
                        className="bd-input bd-input--cell w-28"
                        placeholder={amountText(title.standardRate)}
                        defaultValue={amountText(agreedRate(title.id))}
                        autoComplete="off"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}

      {project && kind === 'client' && (
        <p className="bd-hint m-0">Ændrede priser gælder kun ny tid. Registreret tid beholder sin pris.</p>
      )}
    </FormDialogButton>
  );
}

// Arkivér eller genaktivér et projekt. Kan fortrydes, så der spørges ikke først.
export function ArchiveProjectButton({ projectId, archived }: { projectId: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="bd-btn bd-btn--ghost bd-btn--sm"
      disabled={pending}
      onClick={() => startTransition(() => setProjectArchived(projectId, !archived))}
    >
      {pending ? 'Gemmer …' : archived ? 'Genaktivér projekt' : 'Arkivér projekt'}
    </button>
  );
}
