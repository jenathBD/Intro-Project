import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { getProject } from '@/lib/data/projects';

export default async function ProjectPage({ params }: PageProps<'/projekter/[id]'>) {
  const { id } = await params;
  const project = await getProject(id);
  // Ukendt id: vis not-found.tsx i stedet for en tom side
  if (!project) notFound();

  return (
    <>
      <Link href="/projekter" className="bd-meta">← Alle projekter</Link>
      <PageHeader eyebrow={project.customer} title={project.name} />
      <div className="bd-empty">
        <strong>Arbejdspakker og nøgletal kommer her</strong>
        Bygges i #12.
      </div>
    </>
  );
}
