'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';

export type SaveState = { ok?: boolean; error?: string; message?: string };

// Tillad både 7,5 og 7.5
const toNumber = (value: FormDataEntryValue | null) => Number(String(value ?? '').replace(',', '.'));

// Opretter eller redigerer en medarbejder (#18). Med id redigeres, uden oprettes.
export async function saveEmployee(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireSession();

  const id = String(formData.get('id') ?? '') || null;
  const name = String(formData.get('name') ?? '').trim();
  const titleId = String(formData.get('titleId') ?? '');
  const weeklyCapacity = toNumber(formData.get('weeklyCapacity'));
  // GitHub-brugernavn uden @ (#24). Tomt = ingen kobling.
  const githubLogin = String(formData.get('githubLogin') ?? '').trim().replace(/^@/, '') || null;

  if (!name) return { error: 'Skriv medarbejderens navn.' };
  if (!titleId) return { error: 'Vælg en titel.' };
  if (!Number.isFinite(weeklyCapacity) || weeklyCapacity < 1 || weeklyCapacity > 60) {
    return { error: 'Ugentlig kapacitet skal være mellem 1 og 60 timer.' };
  }
  if (Math.round(weeklyCapacity * 2) !== weeklyCapacity * 2) return { error: 'Kapacitet angives i halve timer, fx 37 eller 32,5.' };
  // GitHubs regel: bogstaver, tal og bindestreg, højst 39 tegn
  if (githubLogin && !/^[A-Za-z0-9-]{1,39}$/.test(githubLogin)) {
    return { error: 'GitHub-brugernavnet må kun indeholde bogstaver, tal og bindestreg.' };
  }

  const title = await prisma.title.findUnique({ where: { id: titleId }, select: { id: true } });
  if (!title) return { error: 'Titlen findes ikke længere. Genindlæs siden.' };

  const data = { name, titleId, weeklyCapacity, githubLogin };
  try {
    if (id) {
      const updated = await prisma.employee.updateMany({ where: { id }, data });
      if (updated.count === 0) return { error: 'Medarbejderen findes ikke længere. Genindlæs siden.' };
    } else {
      await prisma.employee.create({ data });
    }
  } catch (error) {
    // P2002 = unik værdi findes allerede (Employee.githubLogin er @unique)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: `GitHub-brugernavnet ${githubLogin} hører allerede til en anden medarbejder.` };
    }
    throw error;
  }

  // Kapaciteten bruges også i ugegridet
  revalidatePath('/medarbejdere');
  revalidatePath('/allokering');
  return { ok: true, message: id ? `${name} er opdateret.` : `${name} er oprettet.` };
}

// Opretter eller redigerer en titel (#18). Ændret standardpris gælder kun ny tid; registreret tid har sin pris låst.
export async function saveTitle(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireSession();

  const id = String(formData.get('id') ?? '') || null;
  const name = String(formData.get('name') ?? '').trim();
  const standardRate = toNumber(formData.get('standardRate'));

  if (!name) return { error: 'Skriv titlens navn.' };
  if (!Number.isFinite(standardRate) || standardRate < 0 || standardRate > 99999) {
    return { error: 'Standardprisen skal være et beløb i kr. fra 0 og op.' };
  }

  try {
    if (id) {
      const updated = await prisma.title.updateMany({ where: { id }, data: { name, standardRate } });
      if (updated.count === 0) return { error: 'Titlen findes ikke længere. Genindlæs siden.' };
    } else {
      await prisma.title.create({ data: { name, standardRate } });
    }
  } catch (error) {
    // P2002 = unik værdi findes allerede (Title.name er @unique)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: `Der findes allerede en titel, der hedder "${name}".` };
    }
    throw error;
  }

  revalidatePath('/medarbejdere');
  return { ok: true, message: id ? `${name} er opdateret.` : `${name} er oprettet.` };
}
