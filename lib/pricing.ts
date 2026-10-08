import type { PricingModel, Prisma, ProjectKind } from '@/app/generated/prisma/client';

type ProjectPricing = {
  kind: ProjectKind;
  pricingModel: PricingModel;
  hourlyRate: Prisma.Decimal | null;
  titleRates: { titleId: string; hourlyRate: Prisma.Decimal }[];
};

type TitlePricing = { id: string; standardRate: Prisma.Decimal };

// Timeprisen for en ny tidsregistrering. Resultatet gemmes på TimeEntry og ændres ikke bagudrettet.
// Ren funktion uden database og session, så både seed og Clockify-import (#23) kan bruge den.
// Returnerer et tal eller en Decimal; Prisma accepterer begge.
export function resolveHourlyRate(project: ProjectPricing, title: TitlePricing): Prisma.Decimal | number {
  // Interne og fraværsprojekter faktureres ikke (#44)
  if (project.kind !== 'client') return 0;
  if (project.pricingModel === 'fixed') {
    if (!project.hourlyRate) throw new Error('Projekt med fast pris mangler en timepris');
    return project.hourlyRate;
  }
  return project.titleRates.find((rate) => rate.titleId === title.id)?.hourlyRate ?? title.standardRate;
}
