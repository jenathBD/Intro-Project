'use server';

import { isAPIError } from 'better-auth/api';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export type AuthState = { error?: string; email?: string; name?: string };

// Better Auths fejlkoder oversat til tekst, brugeren kan handle på
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Forkert email eller kodeord. Prøv igen.',
  INVALID_EMAIL: 'Emailen ser ikke rigtig ud. Tjek, om den er stavet korrekt.',
  USER_ALREADY_EXISTS: 'Der findes allerede en bruger med den email. Log ind i stedet.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Der findes allerede en bruger med den email. Log ind i stedet.',
  PASSWORD_TOO_SHORT: 'Kodeordet skal være mindst 8 tegn.',
  PASSWORD_TOO_LONG: 'Kodeordet er for langt.',
};

function toMessage(error: unknown) {
  const code = isAPIError(error) ? error.body?.code : undefined;
  if (code && MESSAGES[code]) return MESSAGES[code];
  console.error(error);
  return 'Vi kunne ikke logge dig ind lige nu. Prøv igen om lidt.';
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (error) {
    return { error: toMessage(error), email };
  }

  // redirect() virker ved at kaste en særlig fejl, så det må ikke ske inde i try
  redirect('/');
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get('name') ?? '');
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  try {
    // Opretter brugeren og logger ind i samme omgang
    await auth.api.signUpEmail({ body: { name, email, password }, headers: await headers() });
  } catch (error) {
    return { error: toMessage(error), name, email };
  }

  redirect('/');
}

export async function signOut() {
  // Sletter sessionen i databasen og cookien i browseren
  await auth.api.signOut({ headers: await headers() });
  redirect('/login');
}
