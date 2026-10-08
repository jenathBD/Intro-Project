'use client';

import { useActionState, useEffect, useId, useState, type ReactNode } from 'react';
import { Dialog } from '@/components/dialog';

/** Svar fra en Server Action, der gemmer en formular */
export type FormState = { ok?: boolean; error?: string; message?: string };
export type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

// Knap, der åbner en dialog med en formular. Efter gem lukkes dialogen, og der vises en toast.
// Bruges til at oprette og redigere medarbejdere, titler, projekter og arbejdspakker.
export function FormDialogButton({
  buttonLabel,
  buttonClassName,
  buttonAriaLabel,
  eyebrow,
  heading,
  action,
  submitLabel,
  footer,
  wide = false,
  children,
}: {
  buttonLabel: ReactNode;
  buttonClassName: string;
  buttonAriaLabel?: string;
  eyebrow: string;
  heading: string;
  action: FormAction;
  submitLabel: string;
  /** Ekstra knapper til venstre i bunden, fx "Slet" */
  footer?: (close: () => void, showToast: (message: string) => void) => ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const headingId = useId();

  function showToast(message: string) {
    setOpen(false);
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <>
      <button type="button" className={buttonClassName} aria-label={buttonAriaLabel} onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={headingId} wide={wide}>
        <DialogForm
          action={action}
          submitLabel={submitLabel}
          onCancel={() => setOpen(false)}
          onSaved={showToast}
          footer={footer?.(() => setOpen(false), showToast)}
        >
          <header className="bd-page-head">
            <p className="bd-eyebrow">{eyebrow}</p>
            <h2 id={headingId} className="bd-h2">{heading}</h2>
          </header>
          {children}
        </DialogForm>
      </Dialog>
      {toast && (
        <div className="bd-toast-region" role="status">
          <div className="bd-toast">{toast}</div>
        </div>
      )}
    </>
  );
}

function DialogForm({
  action,
  submitLabel,
  onCancel,
  onSaved,
  footer,
  children,
}: {
  action: FormAction;
  submitLabel: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);

  // Luk dialogen, når serveren har gemt. Kun state som afhængighed: onSaved er en ny funktion ved hver rendering.
  useEffect(() => {
    if (state.ok && state.message) onSaved(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4">
      {children}
      {state.error && <p role="alert" className="bd-callout bd-callout--blocker m-0">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {footer}
        <div className="ml-auto flex gap-2">
          <button type="button" className="bd-btn bd-btn--ghost" onClick={onCancel}>Annullér</button>
          <button className="bd-btn bd-btn--primary" disabled={pending}>{pending ? 'Gemmer …' : submitLabel}</button>
        </div>
      </div>
    </form>
  );
}
