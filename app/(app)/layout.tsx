import type { ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { requireSession } from '@/lib/session';

// Fælles ramme for alle sider i (app): topbar, sidepanel og indhold. /login ligger udenfor og får den ikke.
export default async function AppLayout({ children }: { children: ReactNode }) {
  // Henter brugeren til topbaren. Det er IKKE adgangskontrollen: layouts kører ikke ved navigation,
  // og siden renderes parallelt. Data beskyttes i de funktioner, der henter dem (se lib/session.ts).
  const { user } = await requireSession();

  return (
    <div className="bd-shell">
      <Topbar userName={user.name} />
      <Sidebar />
      <main className="bd-main">
        <div className="bd-main-body">{children}</div>
        <footer className="bd-footer">Better Developers · Aarhus · v0.1</footer>
      </main>
    </div>
  );
}
