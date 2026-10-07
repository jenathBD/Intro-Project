import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Log ind · Intro-Project' };

export default async function LoginPage() {
  // Allerede logget ind: ingen grund til at se login-formularen
  if (await getSession()) redirect('/');

  return (
    <main className="mx-auto grid w-full max-w-sm gap-6 px-4 py-16">
      <header className="bd-page-head">
        <span className="bd-wordmark"><b>Better</b><span>Developers</span></span>
        <h1 className="bd-title">Log ind for at se dashboardet</h1>
      </header>
      <LoginForm />
    </main>
  );
}
