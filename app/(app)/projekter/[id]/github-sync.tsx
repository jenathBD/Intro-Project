'use client';

import { type MouseEvent, useState, useTransition } from 'react';
import { createGithubEpic, createGithubIssue, syncGithub } from './actions';

// Henter projektets issues fra GitHub (#24). Fejl vises ved knappen; når det lykkes, vises en toast.
export function GithubSyncButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function sync() {
    setError(null);
    startTransition(async () => {
      const result = await syncGithub(projectId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setToast(result.message);
      setTimeout(() => setToast(null), 4000);
    });
  }

  return (
    <>
      <button type="button" className="bd-btn bd-btn--secondary" disabled={pending} onClick={sync}>
        {pending ? 'Henter fra GitHub …' : 'Hent fra GitHub'}
      </button>
      {error && <span role="alert" className="bd-hint text-bd-danger">{error}</span>}
      {toast && (
        <div className="bd-toast-region" role="status">
          <div className="bd-toast">{toast}</div>
        </div>
      )}
    </>
  );
}

// Opretter en arbejdspakke eller et epic som issue på GitHub (#25). Står i tabelrækker, hvor et klik på rækken
// folder gruppen ud og ind, så klikket stoppes her.
export function CreateGithubIssueButton({ kind, id, projectId }: { kind: 'workPackage' | 'epic'; id: string; projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function create(event: MouseEvent) {
    event.stopPropagation();
    setError(null);
    startTransition(async () => {
      const result = kind === 'epic' ? await createGithubEpic(id, projectId) : await createGithubIssue(id, projectId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setToast(result.message);
      setTimeout(() => setToast(null), 4000);
    });
  }

  return (
    <>
      <button type="button" className="bd-btn bd-btn--ghost bd-btn--sm" disabled={pending} onClick={create}>
        {pending ? 'Opretter …' : kind === 'epic' ? 'Opret på GitHub' : 'Opret issue'}
      </button>
      {error && <span role="alert" className="bd-hint text-bd-danger whitespace-normal">{error}</span>}
      {toast && (
        <div className="bd-toast-region" role="status">
          <div className="bd-toast">{toast}</div>
        </div>
      )}
    </>
  );
}
