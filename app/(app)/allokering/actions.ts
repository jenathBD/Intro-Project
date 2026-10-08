'use server';

import { revalidatePath } from 'next/cache';
import { getAllocatableProjects } from '@/lib/data/allocations';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';
import { parseWeekParam } from '@/lib/weeks';

export type SetAllocationResult = { ok: true } | { ok: false; error: string };

// Sætter én medarbejders FTE på ét projekt i én uge (#17). 0 fjerner allokeringen.
export async function setAllocation(input: {
  employeeId: string;
  projectId: string;
  /** Ugens mandag som "YYYY-MM-DD" */
  week: string;
  fte: number;
}): Promise<SetAllocationResult> {
  await requireSession();

  const weekStart = parseWeekParam(input.week);
  const { fte } = input;

  // Validering: fejlbeskeder siger, hvad der er galt (BD-styleguide)
  if (!weekStart || weekStart.toISOString().slice(0, 10) !== input.week) return { ok: false, error: 'Ugen er ugyldig. Genindlæs siden.' };
  if (!Number.isFinite(fte) || fte < 0 || fte > 1) return { ok: false, error: 'FTE skal være mellem 0 og 1,0 pr. projekt.' };
  // Trin af 0,1. Sammenlign med en lille tolerance, fordi 0,3 * 10 ikke er præcis 3 i JavaScript.
  if (Math.abs(fte * 10 - Math.round(fte * 10)) > 1e-9) return { ok: false, error: 'FTE angives i trin af 0,1, fx 0,3 eller 0,6.' };

  const [employee, projects] = await Promise.all([
    prisma.employee.findUnique({ where: { id: input.employeeId }, select: { id: true } }),
    getAllocatableProjects(),
  ]);
  const project = projects.find((p) => p.id === input.projectId);
  if (!employee || !project) return { ok: false, error: 'Medarbejderen eller projektet findes ikke længere. Genindlæs siden.' };
  if (weekStart < project.firstWeek || weekStart > project.lastWeek) {
    return { ok: false, error: `${project.name} kører ikke i den uge, så der kan ikke allokeres.` };
  }

  const where = { employeeId_projectId_weekStart: { employeeId: employee.id, projectId: project.id, weekStart } };
  if (fte === 0) {
    await prisma.allocation.deleteMany({ where: where.employeeId_projectId_weekStart });
  } else {
    const value = Math.round(fte * 10) / 10;
    await prisma.allocation.upsert({
      where,
      create: { employeeId: employee.id, projectId: project.id, weekStart, fte: value },
      update: { fte: value },
    });
  }

  revalidatePath('/allokering');
  return { ok: true };
}
