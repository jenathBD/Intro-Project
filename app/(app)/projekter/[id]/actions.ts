'use server';

import { revalidatePath } from 'next/cache';
import { getTimeEntries } from '@/lib/data/time-entries';
import { prisma } from '@/lib/db';
import { resolveHourlyRate } from '@/lib/pricing';
import { requireSession } from '@/lib/session';

export type RegisterTimeState = { ok?: boolean; error?: string; message?: string };

// Registrerer tid på en arbejdspakke. Prisen låses ud fra projektets prismodel og medarbejderens titel (#10).
export async function registerTime(_prev: RegisterTimeState, formData: FormData): Promise<RegisterTimeState> {
  await requireSession();

  const workPackageId = String(formData.get('workPackageId') ?? '');
  const employeeId = String(formData.get('employeeId') ?? '');
  const dateValue = String(formData.get('date') ?? '');
  // Tillad både 7,5 og 7.5
  const hours = Number(String(formData.get('hours') ?? '').replace(',', '.'));
  const description = String(formData.get('description') ?? '').trim() || null;

  // Validering: fejlbeskeder siger, hvad der er galt, og hvad man kan gøre (BD-styleguide)
  if (!employeeId) return { error: 'Vælg, hvem timerne er for.' };
  if (!Number.isFinite(hours) || hours < 0.25 || hours > 24) return { error: 'Timer skal være mellem 0,25 og 24.' };
  if (Math.round(hours * 4) !== hours * 4) return { error: 'Timer registreres i kvarter, fx 1,25 eller 7,5.' };
  // "YYYY-MM-DD" fortolkes som midnat UTC, som @db.Date forventer
  const date = new Date(dateValue);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || Number.isNaN(date.getTime())) return { error: 'Vælg en gyldig dato.' };
  // Én dags margin: datoen er midnat UTC, og i dansk tid er "i dag" op til to timer foran UTC
  if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return { error: 'Tid kan ikke registreres på en dato i fremtiden.' };

  const [workPackage, employee] = await Promise.all([
    prisma.workPackage.findUnique({
      where: { id: workPackageId },
      select: { id: true, projectId: true, project: { include: { titleRates: true } } },
    }),
    prisma.employee.findUnique({ where: { id: employeeId }, include: { title: true } }),
  ]);
  if (!workPackage || !employee) return { error: 'Arbejdspakken eller medarbejderen findes ikke længere. Genindlæs siden.' };
  if (workPackage.project.archivedAt) return { error: 'Projektet er arkiveret, så der kan ikke registreres tid på det.' };

  await prisma.timeEntry.create({
    data: {
      workPackageId: workPackage.id,
      employeeId: employee.id,
      date,
      hours,
      description,
      titleId: employee.titleId,
      hourlyRate: resolveHourlyRate(workPackage.project, employee.title),
      source: 'manual',
    },
  });

  // Bygger projektsiderne igen, så brugt og prognose viser de nye timer med det samme
  revalidatePath(`/projekter/${workPackage.projectId}`);
  revalidatePath('/projekter');

  const hoursText = new Intl.NumberFormat('da-DK').format(hours);
  return { ok: true, message: `${hoursText} t registreret for ${employee.name}.` };
}

// Henter registreringerne, når brugeren klikker på "Brugt". getTimeEntries kalder selv requireSession().
export async function loadTimeEntries(workPackageId: string) {
  return getTimeEntries(workPackageId);
}
