import { Topbar } from '@/components/topbar';
import { requireSession } from '@/lib/session';

function Header({ title }: { title?: string }) {
  return (
    <header className="bd-page-head">
      <p className="bd-eyebrow">Intro-Project</p>
      <h1 className="bd-title">{title ? title : 'Default title'}</h1>
    </header>
  );
}

export default async function HomePage() {
  const { user } = await requireSession();

  return (
    <>
      <Topbar userName={user.name} />
      <main className="bd-main">
        <Header title="Header 1" />
        <footer className="bd-footer mt-12">Better Developers · Aarhus · v0.1</footer>
      </main>
    </>
  );
}
