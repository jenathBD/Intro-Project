import { PageHeader } from '@/components/page-header';

export default function EmployeesPage() {
  return (
    <>
      <PageHeader eyebrow="Medarbejdere" title="Medarbejdere" />
      <div className="bd-empty">
        <strong>Medarbejderlisten kommer her</strong>
        Bygges i #18.
      </div>
    </>
  );
}
