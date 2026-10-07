import Link from 'next/link';
import { PageHeader } from '@/components/page-header';

export default function ProjectNotFound() {
  return (
    <>
      <PageHeader eyebrow="Projekter" title="Projektet findes ikke" />
      <div className="bd-empty">
        <strong>Vi kunne ikke finde projektet</strong>
        Det kan være slettet, eller linket kan være forkert.
        <Link href="/projekter">Gå til alle projekter</Link>
      </div>
    </>
  );
}
