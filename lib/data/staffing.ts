import 'server-only';

import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';
import { checkStaffing, type StaffingResult } from '@/lib/staffing';
import { mondayOf } from '@/lib/weeks';

export type ProjectStaffing = { id: string; name: string; customer: string; staffing: StaffingResult };

// Bemandingstjek for alle aktive kundeprojekter (#45). Interne projekter og fravær indgår ikke.
// Projekter, der mangler tid, kommer først, sorteret efter den nærmeste deadline med mangel.
export async function getStaffingOverview(): Promise<{ thisWeek: Date; projects: ProjectStaffing[] }> {
  await requireSession();

  const thisWeek = mondayOf(new Date());

  const [projects, allocations] = await Promise.all([
    prisma.project.findMany({
      where: { archivedAt: null, kind: 'client' },
      select: {
        id: true,
        name: true,
        customer: true,
        workPackages: {
          select: {
            name: true,
            endDate: true,
            status: true,
            // Resterende er den seneste vurdering
            remainingUpdates: { select: { remainingHours: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    }),
    // Samlet FTE pr. projekt og uge fra denne uge og frem
    prisma.allocation.groupBy({ by: ['projectId', 'weekStart'], where: { weekStart: { gte: thisWeek } }, _sum: { fte: true } }),
  ]);

  const result = projects.map((project): ProjectStaffing => {
    const fteByWeek = new Map(
      allocations
        .filter((a) => a.projectId === project.id)
        .map((a) => [a.weekStart.getTime(), Number(a._sum.fte ?? 0)]),
    );
    const packages = project.workPackages.map((wp) => ({
      name: wp.name,
      deadlineWeek: mondayOf(wp.endDate),
      remainingHours: Number(wp.remainingUpdates[0]?.remainingHours ?? 0),
      done: wp.status === 'done',
    }));
    return { id: project.id, name: project.name, customer: project.customer, staffing: checkStaffing(thisWeek, packages, fteByWeek) };
  });

  const shortfallWeek = (p: ProjectStaffing) => p.staffing.firstShortfall?.deadlineWeek.getTime() ?? Infinity;
  result.sort((a, b) => shortfallWeek(a) - shortfallWeek(b) || a.name.localeCompare(b.name, 'da'));

  return { thisWeek, projects: result };
}
