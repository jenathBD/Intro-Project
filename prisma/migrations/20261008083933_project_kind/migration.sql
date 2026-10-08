-- CreateEnum
CREATE TYPE "ProjectKind" AS ENUM ('client', 'internal', 'absence');

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "kind" "ProjectKind" NOT NULL DEFAULT 'client';

-- Referencedata (#44): ét internt projekt til lavperioder og ét fraværsprojekt til ferie og helligdage.
-- Faste id'er, så seed kan genkende og bevare dem. Kan allokeres i alle uger og har ingen arbejdspakker.
INSERT INTO "project" ("id", "name", "customer", "kind", "updatedAt")
VALUES
    ('intern-tid', 'Intern tid', 'Better Developers', 'internal', CURRENT_TIMESTAMP),
    ('ferie', 'Ferie', 'Better Developers', 'absence', CURRENT_TIMESTAMP);
