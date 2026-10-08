'use server';

import { revalidatePath } from 'next/cache';
import type { WorkPackageStatus } from '@/app/generated/prisma/client';
import type { FormState } from '@/components/form-dialog';
import { getRemainingHistory } from '@/lib/data/remaining';
import { getTimeEntries } from '@/lib/data/time-entries';
import { prisma } from '@/lib/db';
import { resolveHourlyRate } from '@/lib/pricing';
import { NEW_CATEGORY, NEW_EPIC } from '@/lib/work-package';
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

export type UpdateRemainingState = { ok?: boolean; error?: string; message?: string };

// Gemmer en ny vurdering af resterende (#13). Den seneste opdatering ER resterende, så prognosen ændres med det samme.
export async function updateRemaining(_prev: UpdateRemainingState, formData: FormData): Promise<UpdateRemainingState> {
  // Brugeren tages fra sessionen, aldrig fra formularen, så ingen kan opdatere i en andens navn
  const session = await requireSession();

  const workPackageId = String(formData.get('workPackageId') ?? '');
  const remainingHours = Number(String(formData.get('remainingHours') ?? '').replace(',', '.'));
  const comment = String(formData.get('comment') ?? '').trim() || null;

  if (!Number.isFinite(remainingHours) || remainingHours < 0 || remainingHours > 99999) {
    return { error: 'Resterende skal være et tal fra 0 og op.' };
  }
  if (Math.round(remainingHours * 4) !== remainingHours * 4) {
    return { error: 'Resterende angives i kvarter, fx 12,25 eller 40.' };
  }

  const workPackage = await prisma.workPackage.findUnique({
    where: { id: workPackageId },
    select: { id: true, projectId: true, project: { select: { archivedAt: true } } },
  });
  if (!workPackage) return { error: 'Arbejdspakken findes ikke længere. Genindlæs siden.' };
  if (workPackage.project.archivedAt) return { error: 'Projektet er arkiveret, så resterende kan ikke ændres.' };

  await prisma.remainingUpdate.create({
    data: { workPackageId: workPackage.id, remainingHours, comment, userId: session.user.id },
  });

  revalidatePath(`/projekter/${workPackage.projectId}`);
  revalidatePath('/projekter');

  return { ok: true, message: `Resterende er opdateret til ${new Intl.NumberFormat('da-DK').format(remainingHours)} t.` };
}

// Henter historikken, når dialogen åbnes. getRemainingHistory kalder selv requireSession().
export async function loadRemainingHistory(workPackageId: string) {
  return getRemainingHistory(workPackageId);
}

const STATUSES: WorkPackageStatus[] = ['notStarted', 'inProgress', 'onHold', 'done'];

// Opretter eller redigerer en arbejdspakke (#14). Med id redigeres, uden oprettes.
export async function saveWorkPackage(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();

  const id = String(formData.get('id') ?? '') || null;
  const projectId = String(formData.get('projectId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const categoryValue = String(formData.get('categoryId') ?? '');
  const newCategory = String(formData.get('newCategory') ?? '').trim();
  const epicValue = String(formData.get('epicId') ?? '');
  const newEpic = String(formData.get('newEpic') ?? '').trim();
  // Ansvarlig, estimat og datoer er valgfrie (#50). Tom = null.
  const responsibleId = String(formData.get('responsibleId') ?? '') || null;
  const status = String(formData.get('status') ?? '') as WorkPackageStatus;
  const estimateValue = String(formData.get('estimateHours') ?? '').trim();
  const estimateHours = estimateValue ? Number(estimateValue.replace(',', '.')) : null;
  const startValue = String(formData.get('startDate') ?? '');
  const endValue = String(formData.get('endDate') ?? '');

  // Validering: fejlbeskeder siger, hvad der er galt (BD-styleguide)
  if (!name) return { error: 'Skriv arbejdspakkens navn.' };
  if (!categoryValue) return { error: 'Vælg en kategori.' };
  if (categoryValue === NEW_CATEGORY && !newCategory) return { error: 'Skriv navnet på den nye kategori.' };
  if (epicValue === NEW_EPIC && !newEpic) return { error: 'Skriv navnet på det nye epic.' };
  if (!STATUSES.includes(status)) return { error: 'Vælg en status.' };
  if (estimateHours !== null) {
    if (!Number.isFinite(estimateHours) || estimateHours < 0.25 || estimateHours > 99999) {
      return { error: 'Estimatet skal være mindst 0,25 timer. Lad feltet stå tomt, hvis pakken ikke er estimeret.' };
    }
    if (Math.round(estimateHours * 4) !== estimateHours * 4) return { error: 'Estimatet angives i kvarter, fx 40 eller 12,5.' };
  }
  // "YYYY-MM-DD" fortolkes som midnat UTC, som @db.Date forventer
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
  if ((startValue && !isDate(startValue)) || (endValue && !isDate(endValue))) return { error: 'Vælg en gyldig dato.' };
  const startDate = startValue ? new Date(startValue) : null;
  const endDate = endValue ? new Date(endValue) : null;
  if (startDate && endDate && endDate < startDate) return { error: 'Slutdatoen kan ikke ligge før startdatoen.' };

  const [project, responsible, category, epic] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { archivedAt: true } }),
    responsibleId ? prisma.employee.findUnique({ where: { id: responsibleId }, select: { id: true } }) : null,
    categoryValue === NEW_CATEGORY
      ? null
      : prisma.workPackageCategory.findUnique({ where: { id: categoryValue }, select: { id: true } }),
    // Et epic skal høre til samme projekt som pakken
    epicValue && epicValue !== NEW_EPIC
      ? prisma.epic.findFirst({ where: { id: epicValue, projectId }, select: { id: true } })
      : null,
  ]);
  if (!project) return { error: 'Projektet findes ikke længere. Genindlæs siden.' };
  if (project.archivedAt) return { error: 'Projektet er arkiveret. Genaktivér det for at ændre arbejdspakker.' };
  if (responsibleId && !responsible) return { error: 'Den ansvarlige findes ikke længere. Genindlæs siden.' };
  if (categoryValue !== NEW_CATEGORY && !category) return { error: 'Kategorien findes ikke længere. Genindlæs siden.' };
  if (epicValue && epicValue !== NEW_EPIC && !epic) return { error: 'Epicet findes ikke længere. Genindlæs siden.' };

  // Ny kategori: upsert på det unikke navn, så to, der opretter "Drift" samtidig, får den samme
  const categoryId =
    categoryValue === NEW_CATEGORY
      ? (await prisma.workPackageCategory.upsert({ where: { name: newCategory }, update: {}, create: { name: newCategory } })).id
      : categoryValue;

  // Nyt epic oprettes på projektet. Navne er ikke unikke, for i GitHub kan to epics godt hedde det samme.
  const epicId =
    epicValue === NEW_EPIC
      ? (await prisma.epic.create({ data: { projectId, name: newEpic }, select: { id: true } })).id
      : epicValue || null;

  const data = { name, description, categoryId, epicId, responsibleId, status, estimateHours, startDate, endDate };

  if (id) {
    const updated = await prisma.workPackage.updateMany({ where: { id, projectId }, data });
    if (updated.count === 0) return { error: 'Arbejdspakken findes ikke længere. Genindlæs siden.' };
  } else {
    // En ny pakke får sin første vurdering af resterende = estimatet. Ellers ville prognosen vise den som færdig.
    // Uden estimat er der intet at starte fra; resterende sættes, når nogen vurderer det.
    await prisma.workPackage.create({
      data: {
        ...data,
        projectId,
        remainingUpdates:
          estimateHours === null
            ? undefined
            : { create: { remainingHours: estimateHours, comment: 'Estimat ved oprettelse', userId: session.user.id } },
      },
    });
  }

  revalidatePath(`/projekter/${projectId}`);
  revalidatePath('/projekter');
  // Pakkernes datoer bestemmer, hvilke uger projektet kan allokeres i
  revalidatePath('/allokering');
  return { ok: true, message: id ? `${name} er opdateret.` : `${name} er oprettet.` };
}

// Sletter en arbejdspakke (#14). Registreret tid må ikke forsvinde, så pakker med tid kan ikke slettes.
export async function deleteWorkPackage(workPackageId: string): Promise<FormState> {
  await requireSession();

  const workPackage = await prisma.workPackage.findUnique({
    where: { id: workPackageId },
    select: { name: true, projectId: true, _count: { select: { timeEntries: true } } },
  });
  if (!workPackage) return { error: 'Arbejdspakken findes ikke længere. Genindlæs siden.' };
  if (workPackage._count.timeEntries > 0) {
    return { error: `${workPackage.name} har registreret tid og kan ikke slettes. Sæt status til Afsluttet i stedet.` };
  }

  // Resterende-historikken slettes med (onDelete: Cascade)
  await prisma.workPackage.delete({ where: { id: workPackageId } });

  revalidatePath(`/projekter/${workPackage.projectId}`);
  revalidatePath('/projekter');
  revalidatePath('/allokering');
  return { ok: true, message: `${workPackage.name} er slettet.` };
}
