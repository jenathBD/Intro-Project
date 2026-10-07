import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from '@/lib/auth';

// Slår sessionen op i databasen. cache() gør, at flere kald under samme request kun giver ét opslag.
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

// Brug i alle beskyttede sider, layouts og Server Actions: returnerer sessionen eller sender til /login
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}
