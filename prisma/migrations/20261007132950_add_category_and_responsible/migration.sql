-- Kategori og ansvarlig på arbejdspakker (#12).
-- Datamigration i fire trin, så eksisterende arbejdspakker bevares:
--   1. kategoritabel + standardkategorier  2. nye kolonner som valgfri
--   3. udfyld eksisterende rækker            4. gør kolonnerne påkrævede og tilføj nøgler

-- 1. Kategoritabel og standardkategorier (referencedata, findes i alle miljøer)
CREATE TABLE "work_package_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_package_category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_package_category_name_key" ON "work_package_category"("name");

INSERT INTO "work_package_category" ("id", "name", "updatedAt")
SELECT gen_random_uuid()::text, name, CURRENT_TIMESTAMP
FROM (VALUES ('Analyse'), ('Design'), ('Udvikling'), ('Test'), ('Projektledelse')) AS defaults(name);

-- 2. Nye kolonner, foreløbig valgfri
ALTER TABLE "work_package" ADD COLUMN "categoryId" TEXT,
ADD COLUMN "responsibleId" TEXT;

-- 3. Udfyld eksisterende arbejdspakker
-- Kategori gættes ud fra navnet; resten bliver Udvikling
UPDATE "work_package" wp
SET "categoryId" = c.id
FROM "work_package_category" c
WHERE c.name = CASE
    WHEN wp.name ILIKE '%projektledelse%' THEN 'Projektledelse'
    WHEN wp.name ILIKE '%analyse%' THEN 'Analyse'
    WHEN wp.name ILIKE '%design%' THEN 'Design'
    WHEN wp.name ILIKE '%test%' THEN 'Test'
    ELSE 'Udvikling'
END;

-- Ansvarlig: den første allokerede medarbejder (alfabetisk), ellers den første medarbejder overhovedet
UPDATE "work_package" wp
SET "responsibleId" = COALESCE(
    (SELECT a."employeeId" FROM "allocation" a JOIN "employee" e ON e.id = a."employeeId"
     WHERE a."workPackageId" = wp.id ORDER BY e.name LIMIT 1),
    (SELECT id FROM "employee" ORDER BY name LIMIT 1)
);

-- 4. Nu har alle rækker en værdi: gør kolonnerne påkrævede og tilføj nøgler
ALTER TABLE "work_package" ALTER COLUMN "categoryId" SET NOT NULL,
ALTER COLUMN "responsibleId" SET NOT NULL;

CREATE INDEX "work_package_responsibleId_idx" ON "work_package"("responsibleId");

ALTER TABLE "work_package" ADD CONSTRAINT "work_package_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "work_package_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "work_package" ADD CONSTRAINT "work_package_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
