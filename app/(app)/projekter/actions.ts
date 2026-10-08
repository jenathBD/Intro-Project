'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { PricingModel, ProjectKind } from '@/app/generated/prisma/client';
import type { FormState } from '@/components/form-dialog';
import { prisma } from '@/lib/db';
import { parseGithubRepo } from '@/lib/github-sync';
import { requireSession } from '@/lib/session';

// Tillad både 1.100,5 og 1100.5: punktum som tusindtalsseparator fjernes, komma bliver decimaltegn
const toAmount = (value: FormDataEntryValue | null) => {
  const text = String(value ?? '').trim();
  return text === '' ? null : Number(text.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
};
const isValidAmount = (amount: number) => Number.isFinite(amount) && amount >= 0 && amount <= 99999;

// Opretter eller redigerer et projekt med prismodel (#14). Med id redigeres, uden oprettes.
export async function saveProject(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();

  const id = String(formData.get('id') ?? '') || null;
  const name = String(formData.get('name') ?? '').trim();
  const customer = String(formData.get('customer') ?? '').trim();
  const kind = String(formData.get('kind') ?? 'client') as ProjectKind;
  const isClient = kind === 'client';
  // Interne og fraværsprojekter har ingen prismodel (#44); feltet gemmes som fast pris uden timepris
  const pricingModel = (isClient ? String(formData.get('pricingModel') ?? '') : 'fixed') as PricingModel;
  const hourlyRate = isClient ? toAmount(formData.get('hourlyRate')) : null;
  // Fravær har ingen arbejdspakker og dermed intet repo (#24)
  const githubValue = kind === 'absence' ? '' : String(formData.get('githubRepo') ?? '').trim();
  const githubRepo = githubValue ? parseGithubRepo(githubValue) : null;

  if (!name) return { error: 'Skriv projektets navn.' };
  if (!customer) return { error: isClient ? 'Skriv kundens navn.' : 'Skriv, hvem projektet hører til, fx Better Developers.' };
  if (!['client', 'internal', 'absence'].includes(kind)) return { error: 'Vælg en projekttype.' };
  if (isClient && pricingModel !== 'fixed' && pricingModel !== 'byTitle') return { error: 'Vælg en prismodel.' };
  if (isClient && pricingModel === 'fixed' && (hourlyRate === null || !isValidAmount(hourlyRate))) {
    return { error: 'Et projekt med fast pris skal have en timepris i kr.' };
  }

  if (githubValue && !githubRepo) return { error: 'GitHub-repoet skal skrives som owner/repo, fx jenathBD/Intro-Project.' };

  // Titelpriser: kun de udfyldte felter er aftalte priser. Tomme felter bruger titlens standardpris.
  const titles = await prisma.title.findMany({ select: { id: true, name: true } });
  const titleRates: { titleId: string; hourlyRate: number }[] = [];
  if (isClient && pricingModel === 'byTitle') {
    for (const title of titles) {
      const rate = toAmount(formData.get(`titleRate:${title.id}`));
      if (rate === null) continue;
      if (!isValidAmount(rate)) return { error: `Prisen for ${title.name} skal være et beløb i kr. fra 0 og op.` };
      titleRates.push({ titleId: title.id, hourlyRate: rate });
    }
  }

  const data = { name, customer, kind, pricingModel, hourlyRate: isClient && pricingModel === 'fixed' ? hourlyRate : null, githubRepo };
  let createdId: string | null = null;

  if (id) {
    const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return { error: 'Projektet findes ikke længere. Genindlæs siden.' };
    // Transaktion: projekt og titelpriser opdateres samlet, eller slet ikke
    await prisma.$transaction([
      prisma.project.update({ where: { id }, data }),
      prisma.projectTitleRate.deleteMany({ where: { projectId: id } }),
      prisma.projectTitleRate.createMany({ data: titleRates.map((rate) => ({ ...rate, projectId: id })) }),
    ]);
  } else {
    const created = await prisma.project.create({ data: { ...data, titleRates: { create: titleRates } } });
    createdId = created.id;
  }

  revalidatePath('/projekter');
  // Et nyt projekt er tomt, så man sendes videre til det for at tilføje arbejdspakker.
  // redirect() kaster en særlig fejl og må derfor ikke stå i en try.
  if (createdId) redirect(`/projekter/${createdId}`);

  revalidatePath(`/projekter/${id}`);
  return { ok: true, message: `${name} er opdateret. Nye priser gælder kun ny tid.` };
}

// Arkivér eller genaktivér et projekt (#14). Arkiverede projekter skjules i oversigten og kan ikke få ny tid.
export async function setProjectArchived(projectId: string, archived: boolean) {
  await requireSession();
  await prisma.project.update({ where: { id: projectId }, data: { archivedAt: archived ? new Date() : null } });
  revalidatePath('/projekter');
  revalidatePath(`/projekter/${projectId}`);
}
