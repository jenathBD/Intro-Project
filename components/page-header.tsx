export function PageHeader({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <header className="bd-page-head">
      <p className="bd-eyebrow">{eyebrow}</p>
      <h1 className="bd-title">{title}</h1>
      {lede && <p className="bd-lede">{lede}</p>}
    </header>
  );
}
