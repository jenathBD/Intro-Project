-- Allokering pr. projekt i FTE i stedet for timer pr. arbejdspakke (#16).
-- Datamigration: eksisterende timer lægges sammen pr. medarbejder, projekt og uge
-- og regnes om til FTE (timer ÷ medarbejderens ugentlige kapacitet), afrundet til 0,1.

-- 1. Beregn de nye rækker ud fra de gamle
CREATE TEMP TABLE allocation_fte AS
SELECT
    MIN(a.id) AS id,
    a."employeeId",
    wp."projectId",
    a."weekStart",
    ROUND(SUM(a.hours) / NULLIF(e."weeklyCapacity", 0), 1) AS fte,
    MIN(a."createdAt") AS "createdAt",
    MAX(a."updatedAt") AS "updatedAt"
FROM "allocation" a
JOIN "work_package" wp ON wp.id = a."workPackageId"
JOIN "employee" e ON e.id = a."employeeId"
GROUP BY a."employeeId", wp."projectId", a."weekStart", e."weeklyCapacity";

-- 2. Fjern de gamle rækker, nøgler og kolonner
DELETE FROM "allocation";

ALTER TABLE "allocation" DROP CONSTRAINT "allocation_workPackageId_fkey";
DROP INDEX "allocation_employeeId_workPackageId_weekStart_key";
ALTER TABLE "allocation" DROP COLUMN "workPackageId",
DROP COLUMN "hours",
ADD COLUMN "projectId" TEXT NOT NULL,
ADD COLUMN "fte" DECIMAL(3,1) NOT NULL;

-- 3. Indsæt de omregnede rækker (allokeringer, der runder ned til 0, droppes)
INSERT INTO "allocation" ("id", "employeeId", "projectId", "weekStart", "fte", "createdAt", "updatedAt")
SELECT id, "employeeId", "projectId", "weekStart", fte, "createdAt", "updatedAt"
FROM allocation_fte
WHERE fte > 0;

DROP TABLE allocation_fte;

-- 4. Nye nøgler
CREATE UNIQUE INDEX "allocation_employeeId_projectId_weekStart_key" ON "allocation"("employeeId", "projectId", "weekStart");

ALTER TABLE "allocation" ADD CONSTRAINT "allocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
