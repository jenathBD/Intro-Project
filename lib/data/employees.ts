import 'server-only';

import { capacityFte } from '@/lib/capacity';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';

export type EmployeeOption = { id: string; name: string };

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'da');

// Medarbejdere til valglister, fx i "Registrér tid". currentEmployeeId er den medarbejder,
// der er koblet til det indloggede login (#26/#27), så den kan være valgt på forhånd.
export async function getEmployeeOptions() {
  const session = await requireSession();

  const employees = await prisma.employee.findMany({
    select: { id: true, name: true, userId: true },
    orderBy: { name: 'asc' },
  });

  return {
    employees: employees.map(({ id, name }): EmployeeOption => ({ id, name })).sort(byName),
    currentEmployeeId: employees.find((e) => e.userId === session.user.id)?.id ?? null,
  };
}

export type EmployeeRow = {
  id: string;
  name: string;
  titleId: string;
  titleName: string;
  /** Timer pr. uge */
  weeklyCapacity: number;
  /** Kapacitet i FTE (37 t = 1,0) */
  capacityFte: number;
  /** GitHub-brugernavn (#24) */
  githubLogin: string | null;
};

// Medarbejderlisten (#18)
export async function getEmployees(): Promise<EmployeeRow[]> {
  await requireSession();

  const employees = await prisma.employee.findMany({
    select: { id: true, name: true, weeklyCapacity: true, githubLogin: true, title: { select: { id: true, name: true } } },
  });

  return employees
    .map((e) => ({
      id: e.id,
      name: e.name,
      titleId: e.title.id,
      titleName: e.title.name,
      weeklyCapacity: Number(e.weeklyCapacity),
      capacityFte: capacityFte(Number(e.weeklyCapacity)),
      githubLogin: e.githubLogin,
    }))
    .sort(byName);
}

export type TitleRow = { id: string; name: string; standardRate: number; employeeCount: number };

// Titler med standardpris (#18), sorteret efter pris (laveste først), så de står i rækkefølge fra junior til senior
export async function getTitles(): Promise<TitleRow[]> {
  await requireSession();

  const titles = await prisma.title.findMany({
    select: { id: true, name: true, standardRate: true, _count: { select: { employees: true } } },
  });

  return titles
    .map((t) => ({ id: t.id, name: t.name, standardRate: Number(t.standardRate), employeeCount: t._count.employees }))
    .sort((a, b) => a.standardRate - b.standardRate || byName(a, b));
}
