'use client';

import { useActionState, useState } from 'react';
import { signIn, signUp, type AuthState } from './actions';

type Mode = 'signin' | 'signup';

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('signin');

  return (
    <div className="bd-card">
      <div className="bd-tabs" role="tablist">
        <button type="button" role="tab" className="bd-tab" aria-selected={mode === 'signin'} onClick={() => setMode('signin')}>
          Log ind
        </button>
        <button type="button" role="tab" className="bd-tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>
          Opret bruger
        </button>
      </div>
      {/* key nulstiller formularens state, når man skifter fane */}
      {mode === 'signin' ? <SignInForm key="signin" /> : <SignUpForm key="signup" />}
    </div>
  );
}

function SignInForm() {
  const [state, action, pending] = useActionState(signIn, {} as AuthState);

  return (
    <form action={action} className="grid gap-4">
      <ErrorMessage message={state.error} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.email} />
      <Field label="Kodeord" name="password" type="password" autoComplete="current-password" />
      <button className="bd-btn bd-btn--primary" disabled={pending}>
        {pending ? 'Logger ind …' : 'Log ind'}
      </button>
    </form>
  );
}

function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, {} as AuthState);

  return (
    <form action={action} className="grid gap-4">
      <ErrorMessage message={state.error} />
      <Field label="Navn" name="name" autoComplete="name" defaultValue={state.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.email} />
      <Field
        label="Kodeord"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        hint="Mindst 8 tegn."
      />
      <button className="bd-btn bd-btn--primary" disabled={pending}>
        {pending ? 'Opretter …' : 'Opret bruger og log ind'}
      </button>
    </form>
  );
}

function Field({ label, name, hint, ...input }: { label: string; name: string; hint?: string } & React.ComponentProps<'input'>) {
  const id = `field-${name}`;
  return (
    <div className="bd-field">
      <label className="bd-label" htmlFor={id}>{label}</label>
      <input id={id} name={name} className="bd-input" required aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      {hint && <span id={`${id}-hint`} className="bd-hint">{hint}</span>}
    </div>
  );
}

function ErrorMessage({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="bd-callout bd-callout--blocker m-0">{message}</p>;
}
