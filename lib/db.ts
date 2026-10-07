import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../app/generated/prisma/client';

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// I udvikling genindlæser Next moduler ved hver ændring. Uden denne cache ville hver genindlæsning åbne en ny pulje af databaseforbindelser.
// Typet bredt med vilje: instansen kan stamme fra en ældre version af PrismaClient-klassen.
const globalForPrisma = globalThis as unknown as { prisma?: { $disconnect(): Promise<void> } };

// Efter `prisma generate` indlæser Next den genererede klient igen, og PrismaClient er så en ny klasse.
// En gemt instans af den gamle klasse kender ikke de nye modeller og værdier, så den skiftes ud.
const cached = globalForPrisma.prisma;
const isCurrent = cached instanceof PrismaClient;
if (cached && !isCurrent) {
  console.info('Prisma-klienten er genereret igen – opretter en ny databaseforbindelse.');
  void cached.$disconnect();
}

export const prisma = isCurrent ? cached : createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
