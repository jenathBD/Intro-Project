import { PageHeader } from '@/components/page-header';

export default function AllocationPage() {
  return (
    <>
      <PageHeader eyebrow="Allokering" title="Allokering" />
      <div className="bd-empty">
        <strong>Ugegridet kommer her</strong>
        Bygges i #16.
      </div>
    </>
  );
}
