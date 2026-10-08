import type { ReactNode } from 'react';
import type { Figures } from '@/lib/data/projects';
import { formatHours, formatSignedHours } from '@/lib/format';

// Fælles kolonner for projektoversigten og projektdetaljen, så tal og markering altid vises ens

export const isOverBudget = (figures: Figures) => figures.varianceHours > 0;

/** Der er brugt mere end estimatet. Så er prognosen over budget, uanset hvad der er tilbage.
 *  Uden estimat er estimatet 0 t, så al tid på pakken er over budget (#50). */
export const isSpentOverEstimate = (figures: Figures) => figures.spentHours > figures.estimateHours;

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

/**
 * spent og remaining erstatter indholdet i "Brugt"- og "Resterende"-cellerne, fx med knapper der åbner detaljer.
 * estimated = false: arbejdspakken har intet estimat (#50). Estimatet vises som "–", og tid på pakken er over budget.
 */
export function FigureCells({
  figures,
  spent,
  remaining,
  estimated = true,
}: {
  figures: Figures;
  spent?: ReactNode;
  remaining?: ReactNode;
  estimated?: boolean;
}) {
  // Rødt og fedt som afvigelsen. Forklaringen står som skjult tekst til skærmlæsere, som ikke kan se farven.
  const spentWarning = !isSpentOverEstimate(figures)
    ? undefined
    : !estimated
      ? `Der er brugt ${formatHours(figures.spentHours)} t på en arbejdspakke uden estimat.`
      : `Brugt er ${formatHours(figures.spentHours - figures.estimateHours)} t over estimatet på ${formatHours(figures.estimateHours)} t.`;

  return (
    <>
      {/* Intet estimat er kun et problem, når der er brugt eller resterende tid på pakken */}
      <td className={estimated ? 'num' : isOverBudget(figures) ? 'num font-semibold text-bd-danger' : 'num bd-meta'}>
        {estimated ? formatHours(figures.estimateHours) : '–'}
        {!estimated && <span className="sr-only">Intet estimat</span>}
      </td>
      <td className={spentWarning ? 'num bd-over-estimate' : 'num'}>
        {spent ?? formatHours(figures.spentHours)}
        {spentWarning && <span className="sr-only"> {spentWarning}</span>}
      </td>
      <td className="num">{remaining ?? formatHours(figures.remainingHours)}</td>
      <td className="num">{formatHours(figures.forecastHours)}</td>
      <td className={isOverBudget(figures) ? 'num font-semibold text-bd-danger' : 'num'}>
        {formatSignedHours(figures.varianceHours)}
      </td>
    </>
  );
}
