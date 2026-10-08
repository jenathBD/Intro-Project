import 'server-only';

import type { ProjectKind } from '@/app/generated/prisma/client';
import { byKindAndName } from '@/lib/allocation';
import { capacityFte } from '@/lib/capacity';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';
import { addWeeks, mondayOf } from '@/lib/weeks';

export type AllocationGridProject = { id: string; name: string; kind: ProjectKind; fte: number[] };

export type AllocationGridEmployee = {
  id: string;
  name: string;
  /** Arbejdstid i timer pr. uge */
  weeklyCapacity: number;
  /** Kapacitet i FTE (37 t = 1,0, 30 t = 0,8). Over den er medarbejderen overbooket. */
  capacityFte: number;
  /** Samlet FTE pr. uge (kunde + intern + fravær), samme rækkefølge som weeks */
  totals: number[];
  /** Fordelingen pr. projekt i FTE, samme rækkefølge som weeks */
  projects: AllocationGridProject[];
};

/**
 * Et aktivt projekt, der kan allokeres. Kundeprojekter kan allokeres fra ugen, første pakke starter, til ugen,
 * sidste slutter. Interne og fraværsprojekter har ingen periode (null) og kan allokeres i alle uger (#44).
 */
export type AllocatableProject = {
  id: string;
  name: string;
  kind: ProjectKind;
  firstWeek: Date | null;
  lastWeek: Date | null;
};

export type AllocationGrid = { weeks: Date[]; employees: AllocationGridEmployee[]; projects: AllocatableProject[] };

// Kommatal i JavaScript er upræcise (0,2 + 0,4 + 0,4 = 1,0000000000000002).
// FTE fordeles i trin af 0,1, så summer afrundes til én decimal, før de sammenlignes med 1,0.
const roundFte = (value: number) => Math.round(value * 10) / 10;

// Dansk alfabetisk (Æ, Ø, Å til sidst). Projekter sorteres med byKindAndName fra lib/allocation.ts.
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'da');

// Ugegrid for weekCount uger fra firstWeek (#16): medarbejdere som rækker, uger som kolonner, i FTE.
export async function getAllocationGrid(firstWeek: Date, weekCount: number): Promise<AllocationGrid> {
  await requireSession();

  const weeks = Array.from({ length: weekCount }, (_, i) => addWeeks(firstWeek, i));

  const [employees, allocations] = await Promise.all([
    prisma.employee.findMany({ select: { id: true, name: true, weeklyCapacity: true } }),
    prisma.allocation.findMany({
      where: { weekStart: { gte: weeks[0], lte: weeks[weeks.length - 1] } },
      select: { employeeId: true, weekStart: true, fte: true, project: { select: { id: true, name: true, kind: true } } },
    }),
  ]);

  // Ugens position i kolonnerne slås op på tidsstemplet, fordi to Date-objekter aldrig er ===
  const weekIndex = new Map(weeks.map((week, index) => [week.getTime(), index]));
  const empty = () => weeks.map(() => 0);

  const rows = new Map<string, AllocationGridEmployee>(
    employees.map((e) => [
      e.id,
      {
        id: e.id,
        name: e.name,
        weeklyCapacity: Number(e.weeklyCapacity),
        capacityFte: capacityFte(Number(e.weeklyCapacity)),
        totals: empty(),
        projects: [],
      },
    ]),
  );

  for (const allocation of allocations) {
    const row = rows.get(allocation.employeeId);
    const index = weekIndex.get(allocation.weekStart.getTime());
    if (!row || index === undefined) continue;

    let project = row.projects.find((p) => p.id === allocation.project.id);
    if (!project) {
      project = { ...allocation.project, fte: empty() };
      row.projects.push(project);
    }
    // Decimal → number. Der er højst én allokering pr. medarbejder, projekt og uge (@@unique).
    const fte = Number(allocation.fte);
    project.fte[index] = fte;
    row.totals[index] = roundFte(row.totals[index] + fte);
  }

  for (const row of rows.values()) row.projects.sort(byKindAndName);

  return {
    weeks,
    employees: [...rows.values()].sort(byName),
    projects: (await getAllocatableProjects()).sort(byKindAndName),
  };
}

// Aktive projekter, der kan allokeres (#17, #44). Bruges af gridet og af Server Actionen.
export async function getAllocatableProjects(): Promise<AllocatableProject[]> {
  await requireSession();

  const [projects, periods] = await Promise.all([
    prisma.project.findMany({ where: { archivedAt: null }, select: { id: true, name: true, kind: true } }),
    prisma.workPackage.groupBy({ by: ['projectId'], _min: { startDate: true }, _max: { endDate: true } }),
  ]);

  return projects.flatMap((project): AllocatableProject[] => {
    // Interne og fraværsprojekter kan altid allokeres, også uden arbejdspakker
    if (project.kind !== 'client') return [{ ...project, firstWeek: null, lastWeek: null }];
    const period = periods.find((p) => p.projectId === project.id);
    // Et kundeprojekt uden arbejdspakker har ingen periode og kan ikke allokeres endnu
    if (!period?._min.startDate || !period._max.endDate) return [];
    return [{ ...project, firstWeek: mondayOf(period._min.startDate), lastWeek: mondayOf(period._max.endDate) }];
  });
}
