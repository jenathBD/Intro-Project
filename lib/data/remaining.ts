import 'server-only';

import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';

export type RemainingUpdateRow = {
  id: string;
  remainingHours: number;
  comment: string | null;
  createdAt: Date;
  /** null for seed-data, eller hvis brugeren er slettet */
  userName: string | null;
};

// Historikken over resterende for én arbejdspakke, nyeste først (#13, #15)
export async function getRemainingHistory(workPackageId: string): Promise<RemainingUpdateRow[]> {
  await requireSession();

  const updates = await prisma.remainingUpdate.findMany({
    where: { workPackageId },
    select: { id: true, remainingHours: true, comment: true, createdAt: true, user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // Decimal → number ved grænsen
  return updates.map(({ user, remainingHours, ...update }) => ({
    ...update,
    remainingHours: Number(remainingHours),
    userName: user?.name ?? null,
  }));
}
