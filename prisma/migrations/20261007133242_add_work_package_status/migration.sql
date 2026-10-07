-- CreateEnum
CREATE TYPE "WorkPackageStatus" AS ENUM ('notStarted', 'inProgress', 'onHold', 'done');

-- AlterTable
ALTER TABLE "work_package" ADD COLUMN     "status" "WorkPackageStatus" NOT NULL DEFAULT 'notStarted';

-- Backfill: gæt status for eksisterende arbejdspakker ud fra datoer og seneste resterende.
-- "Afventer" kan ikke udledes af data og sættes kun manuelt.
UPDATE "work_package" wp
SET "status" = CASE
    WHEN latest."remainingHours" = 0 THEN 'done'::"WorkPackageStatus"
    WHEN wp."startDate" > CURRENT_DATE THEN 'notStarted'::"WorkPackageStatus"
    ELSE 'inProgress'::"WorkPackageStatus"
END
FROM (
    SELECT DISTINCT ON ("workPackageId") "workPackageId", "remainingHours"
    FROM "remaining_update"
    ORDER BY "workPackageId", "createdAt" DESC
) AS latest
WHERE latest."workPackageId" = wp.id;
