'use client';

import { useState, useTransition } from 'react';
import { syncGithub } from './actions';

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
