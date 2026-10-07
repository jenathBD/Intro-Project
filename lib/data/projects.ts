import 'server-only';

import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';

export type ProjectOverviewRow = {
  id: string;
  name: string;
  customer: string;
  estimateHours: number;
  spentHours: number;
  remainingHours: number;
  /** brugt + resterende */
  forecastHours: number;
  /** prognose − estimat. Positiv = over budget */
  varianceHours: number;
  /** Brugt tid i kr: summen af timer × den låste pris på hver registrering */
  spentCost: number;
};

// Ét projekt til projektdetaljen. null, hvis id'et ikke findes.
export async function getProject(id: string) {
  await requireSession();
  return prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, customer: true, archivedAt: true },
  });
}

// Nøgletal for alle aktive projekter. Al aggregering sker i databasen i én forespørgsel,
// fordi brugt i kr er SUM(timer × pris) pr. række, og det kan Prisma's _sum ikke udtrykke.
export async function getProjectOverview(): Promise<ProjectOverviewRow[]> {
  await requireSession();

  // ::float8 gør Postgres' numeric til almindelige JavaScript-tal. Fint til visning; beløbene her er summer af to-decimal-tal.
  const rows = await prisma.$queryRaw<Omit<ProjectOverviewRow, 'forecastHours' | 'varianceHours'>[]>`
    WITH estimate AS (
      SELECT "projectId", SUM("estimateHours") AS hours
      FROM work_package
      GROUP BY "projectId"
    ),
    spent AS (
      SELECT wp."projectId", SUM(te.hours) AS hours, SUM(te.hours * te."hourlyRate") AS cost
      FROM time_entry te
      JOIN work_package wp ON wp.id = te."workPackageId"
      GROUP BY wp."projectId"
    ),
    latest_remaining AS (
      -- Resterende er den seneste opdatering pr. arbejdspakke
      SELECT DISTINCT ON ("workPackageId") "workPackageId", "remainingHours"
      FROM remaining_update
      ORDER BY "workPackageId", "createdAt" DESC
    ),
    remaining AS (
      SELECT wp."projectId", SUM(lr."remainingHours") AS hours
      FROM latest_remaining lr
      JOIN work_package wp ON wp.id = lr."workPackageId"
      GROUP BY wp."projectId"
    )
    SELECT
      p.id,
      p.name,
      p.customer,
      COALESCE(e.hours, 0)::float8 AS "estimateHours",
      COALESCE(s.hours, 0)::float8 AS "spentHours",
      COALESCE(r.hours, 0)::float8 AS "remainingHours",
      COALESCE(s.cost, 0)::float8 AS "spentCost"
    FROM project p
    LEFT JOIN estimate e ON e."projectId" = p.id
    LEFT JOIN spent s ON s."projectId" = p.id
    LEFT JOIN remaining r ON r."projectId" = p.id
    WHERE p."archivedAt" IS NULL
    ORDER BY p.name`;

  return rows.map((row) => {
    const forecastHours = row.spentHours + row.remainingHours;
    return { ...row, forecastHours, varianceHours: forecastHours - row.estimateHours };
  });
}
