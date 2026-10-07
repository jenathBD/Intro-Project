import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from '@/lib/auth';

// Slår sessionen op i databasen. cache() gør, at flere kald under samme request kun giver ét opslag.
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

// Returnerer sessionen eller sender til /login.
// Regel: kald den først i hver funktion, der henter eller ændrer data (lib/data/*, Server Actions),
// så en side ikke kan glemme tjekket. Et kald i et layout beskytter ikke siderne under det.
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}
