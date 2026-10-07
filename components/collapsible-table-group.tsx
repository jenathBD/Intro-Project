'use client';

import { useState, type ReactNode } from 'react';

// En gruppe i en tabel: overskriftsrække med fold-knap og rækkerne under. Hver gruppe er sin egen <tbody>.
// headerCells og children renderes af serveren og sendes ind som færdige rækker/celler.
export function CollapsibleTableGroup({
  label,
  count,
  headerCells,
  overBudget,
  children,
}: {
  label: string;
  count: number;
  headerCells: ReactNode;
  overBudget: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <tbody>
      {/* Hele rækken kan klikkes. Knappen er der til tastatur og skærmlæsere; dens klik bobler op til rækken. */}
      <tr className="bd-group-row" data-sev={overBudget ? 'blocker' : undefined} onClick={() => setOpen(!open)}>
        <td>
          <button type="button" className="bd-group-toggle" aria-expanded={open}>
            <span aria-hidden="true">{open ? '▾' : '▸'}</span>
            {label}
            <span className="bd-meta">{count}</span>
          </button>
        </td>
        {headerCells}
      </tr>
      {open && children}
    </tbody>
  );
}
