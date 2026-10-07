import 'server-only';

import type { TimeEntrySource } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';

export type TimeEntryRow = {
  id: string;
  date: Date;
  employeeName: string;
  hours: number;
  description: string | null;
  source: TimeEntrySource;
};

// Tidsregistreringerne på én arbejdspakke, nyeste først
export async function getTimeEntries(workPackageId: string): Promise<TimeEntryRow[]> {
  await requireSession();

  const entries = await prisma.timeEntry.findMany({
    where: { workPackageId },
    select: { id: true, date: true, hours: true, description: true, source: true, employee: { select: { name: true } } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  // Decimal → number ved grænsen, så Client Components får almindelige tal
  return entries.map(({ employee, hours, ...entry }) => ({ ...entry, hours: Number(hours), employeeName: employee.name }));
}
