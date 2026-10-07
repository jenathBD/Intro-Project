export function PageHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="bd-page-head">
      <p className="bd-eyebrow">{eyebrow}</p>
      <h1 className="bd-title">{title}</h1>
    </header>
  );
}
