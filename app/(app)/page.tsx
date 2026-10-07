import { PageHeader } from '@/components/page-header';

export default function OverviewPage() {
  return (
    <>
      <PageHeader eyebrow="Overblik" title="Overblik" />
      <div className="bd-empty">
        <strong>Nøgletal og widgets kommer her</strong>
        Bygges i #20 og #21.
      </div>
    </>
  );
}
