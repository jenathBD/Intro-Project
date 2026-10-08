'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Fælles dialog. Renderes med en portal direkte i <body>, så den ikke arver stil fra det sted,
// den bruges, fx text-align og BD's røde stribe, når knappen står i en tabelcelle.
// Indholdet findes kun, mens dialogen er åben, så formularer starter forfra hver gang.
export function Dialog({
  open,
  onClose,
  labelledBy,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // document findes først i browseren, så portalen oprettes efter første rendering
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // showModal() giver fokusfangst, Escape og baggrund. Synkroniseres med open.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, mounted]);

  if (!mounted) return null;

  return createPortal(
    // onClose kommer også, når brugeren trykker Escape
    <dialog ref={ref} className={wide ? 'bd-dialog bd-dialog--wide' : 'bd-dialog'} aria-labelledby={labelledBy} onClose={onClose}>
      {open && children}
    </dialog>,
    document.body,
  );
}
