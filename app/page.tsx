function Header({ title }: { title?: string }) {
  return (
    <header className="bd-page-head">
      <p className="bd-eyebrow">Intro-Project</p>
      <h1 className="bd-title">{title ? title : 'Default title'}</h1>
    </header>
  );
}

export default function HomePage() {
  return (
    <>
      <div className="bd-topbar">
        <span className="bd-wordmark"><b>Better</b><span>Developers</span></span>
        <span className="bd-tool">Intro-Project</span>
      </div>
      <main className="bd-main">
        <Header title="Header 1" />
        <footer className="bd-footer mt-12">Better Developers · Aarhus · v0.1</footer>
      </main>
    </>
  );
}
