import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../app/generated/prisma/client';
import * as enums from '../app/generated/prisma/enums';

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Fingeraftryk af skemaet: alle modellers felter og alle enums fra den genererede klient.
// Det ændrer sig kun, når `prisma generate` har kørt med et ændret skema – ikke ved almindelige genindlæsninger,
// hvor Next også indlæser den genererede klient igen (så PrismaClient-klassen alene kan ikke bruges til at afgøre det).
const schemaFingerprint = JSON.stringify([
  Object.entries(Prisma).filter(([name]) => name.endsWith('ScalarFieldEnum')),
  enums,
]);

// I udvikling genindlæser Next moduler ved hver ændring. Uden denne cache ville hver genindlæsning åbne en ny pulje af databaseforbindelser.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaSchema?: string };

const cached = globalForPrisma.prisma;
const isCurrent = cached !== undefined && globalForPrisma.prismaSchema === schemaFingerprint;
if (cached && !isCurrent) {
  console.info('Prisma-skemaet er ændret – opretter en ny databaseforbindelse.');
  void cached.$disconnect();
}

export const prisma = isCurrent ? cached : createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchema = schemaFingerprint;
}
