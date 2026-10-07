'use client';

import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

// Sidepanelets ramme. På mobil er menuen foldet sammen bag en knap (CSS i app/globals.css).
export function CollapsibleNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Husk hvilken side menuen blev åbnet på. Navigerer man videre, er den automatisk lukket igen.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  return (
    <nav className="bd-nav" aria-label="Hovedmenu" data-open={open}>
      <button
        type="button"
        className="bd-nav-toggle bd-btn bd-btn--ghost bd-btn--sm"
        aria-expanded={open}
        aria-controls="hovedmenu"
        onClick={() => setOpenedOn(open ? null : pathname)}
      >
        {open ? 'Luk menu' : 'Menu'}
      </button>
      <div id="hovedmenu" className="bd-nav-links">
        {children}
      </div>
    </nav>
  );
}
