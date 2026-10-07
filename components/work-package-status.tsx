import type { WorkPackageStatus } from '@/app/generated/prisma/client';

// Dansk tekst og BD-badge pr. status. Samme liste bruges til visning og senere til formularen (#14).
export const WORK_PACKAGE_STATUSES: Record<WorkPackageStatus, { label: string; badge: string }> = {
  notStarted: { label: 'Ikke startet', badge: 'bd-badge' },
  inProgress: { label: 'I gang', badge: 'bd-badge bd-badge--info' },
  onHold: { label: 'Afventer', badge: 'bd-badge bd-badge--warn' },
  done: { label: 'Afsluttet', badge: 'bd-badge bd-badge--ok' },
};

export function WorkPackageStatusBadge({ status }: { status: WorkPackageStatus }) {
  const { label, badge } = WORK_PACKAGE_STATUSES[status];
  return <span className={badge}>{label}</span>;
}
