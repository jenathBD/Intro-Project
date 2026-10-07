import { PageHeader } from '@/components/page-header';

export default function ProjectsPage() {
  return (
    <>
      <PageHeader eyebrow="Projekter" title="Projekter" />
      <div className="bd-empty">
        <strong>Projektoversigten kommer her</strong>
        Bygges i #11.
      </div>
    </>
  );
}
