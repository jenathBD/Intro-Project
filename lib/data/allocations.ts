import 'server-only';

import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';
import { addWeeks } from '@/lib/weeks';

export type AllocationGridEmployee = {
  id: string;
  name: string;
  /** Timer pr. uge, som 1,0 FTE svarer til for denne medarbejder */
  weeklyCapacity: number;
  /** Samlet FTE pr. uge, samme rækkefølge som weeks */
  totals: number[];
  /** Fordelingen pr. projekt i FTE, samme rækkefølge som weeks */
  projects: { id: string; name: string; fte: number[] }[];
};

export type AllocationGrid = { weeks: Date[]; employees: AllocationGridEmployee[] };

// Kommatal i JavaScript er upræcise (0,2 + 0,4 + 0,4 = 1,0000000000000002).
// FTE fordeles i trin af 0,1, så summer afrundes til én decimal, før de sammenlignes med 1,0.
const roundFte = (value: number) => Math.round(value * 10) / 10;

// Ugegrid for weekCount uger fra firstWeek (#16): medarbejdere som rækker, uger som kolonner, i FTE.
export async function getAllocationGrid(firstWeek: Date, weekCount: number): Promise<AllocationGrid> {
  await requireSession();

  const weeks = Array.from({ length: weekCount }, (_, i) => addWeeks(firstWeek, i));

  const [employees, allocations] = await Promise.all([
    prisma.employee.findMany({ select: { id: true, name: true, weeklyCapacity: true }, orderBy: { name: 'asc' } }),
    prisma.allocation.findMany({
      where: { weekStart: { gte: weeks[0], lte: weeks[weeks.length - 1] } },
      select: { employeeId: true, weekStart: true, fte: true, project: { select: { id: true, name: true } } },
    }),
  ]);

  // Ugens position i kolonnerne slås op på tidsstemplet, fordi to Date-objekter aldrig er ===
  const weekIndex = new Map(weeks.map((week, index) => [week.getTime(), index]));
  const empty = () => weeks.map(() => 0);

  const rows = new Map<string, AllocationGridEmployee>(
    employees.map((e) => [
      e.id,
      { id: e.id, name: e.name, weeklyCapacity: Number(e.weeklyCapacity), totals: empty(), projects: [] },
    ]),
  );

  for (const allocation of allocations) {
    const row = rows.get(allocation.employeeId);
    const index = weekIndex.get(allocation.weekStart.getTime());
    if (!row || index === undefined) continue;

    let project = row.projects.find((p) => p.id === allocation.project.id);
    if (!project) {
      project = { id: allocation.project.id, name: allocation.project.name, fte: empty() };
      row.projects.push(project);
    }
    // Decimal → number. Der er højst én allokering pr. medarbejder, projekt og uge (@@unique).
    const fte = Number(allocation.fte);
    project.fte[index] = fte;
    row.totals[index] = roundFte(row.totals[index] + fte);
  }

  for (const row of rows.values()) row.projects.sort((a, b) => a.name.localeCompare(b.name, 'da'));

  return { weeks, employees: [...rows.values()] };
}
