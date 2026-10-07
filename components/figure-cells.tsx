import type { ReactNode } from 'react';
import type { Figures } from '@/lib/data/projects';
import { formatHours, formatSignedHours } from '@/lib/format';

// Fælles kolonner for projektoversigten og projektdetaljen, så tal og markering altid vises ens

export const isOverBudget = (figures: Figures) => figures.varianceHours > 0;

export function FigureHeaderCells() {
  return (
    <>
      <th className="num">Estimat (t)</th>
      <th className="num">Brugt (t)</th>
      <th className="num">Resterende (t)</th>
      <th className="num">Prognose (t)</th>
      <th className="num">Afvigelse (t)</th>
    </>
  );
}

/** spent erstatter indholdet i "Brugt"-cellen, fx med en knap der viser registreringerne */
export function FigureCells({ figures, spent }: { figures: Figures; spent?: ReactNode }) {
  return (
    <>
      <td className="num">{formatHours(figures.estimateHours)}</td>
      <td className="num">{spent ?? formatHours(figures.spentHours)}</td>
      <td className="num">{formatHours(figures.remainingHours)}</td>
      <td className="num">{formatHours(figures.forecastHours)}</td>
      <td className={isOverBudget(figures) ? 'num font-semibold text-bd-danger' : 'num'}>
        {formatSignedHours(figures.varianceHours)}
      </td>
    </>
  );
}
