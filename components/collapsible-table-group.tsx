'use client';

import { useState, type ReactNode } from 'react';

// En gruppe i en tabel: overskriftsrække med fold-knap og rækkerne under. Hver gruppe er sin egen <tbody>.
// headerCells og children renderes af serveren og sendes ind som færdige rækker/celler.
// Bruges til kategorier på projektdetaljen og medarbejdere i ugegridet.
export function CollapsibleTableGroup({
  label,
  meta,
  headerCells,
  severity,
  defaultOpen = true,
  children,
}: {
  label: string;
  /** Lille tekst efter navnet, fx antal pakker eller kapacitet */
  meta?: ReactNode;
  headerCells: ReactNode;
  /** Stribe i venstre kant: blocker = rød (fx over budget, overbooket), major = orange (fx ledig tid) */
  severity?: 'blocker' | 'major';
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <tbody>
      {/* Hele rækken kan klikkes. Knappen er der til tastatur og skærmlæsere; dens klik bobler op til rækken. */}
      <tr className="bd-group-row" data-sev={severity} onClick={() => setOpen(!open)}>
        <td>
          <button type="button" className="bd-group-toggle" aria-expanded={open}>
            <span aria-hidden="true">{open ? '▾' : '▸'}</span>
            {label}
            {meta !== undefined && <span className="bd-meta">{meta}</span>}
          </button>
        </td>
        {headerCells}
      </tr>
      {open && children}
    </tbody>
  );
}
