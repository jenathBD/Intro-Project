import 'server-only';

import { Prisma, type WorkPackageStatus } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';

/** Nøgletal, der kan summeres fra arbejdspakke til projekt */
export type Figures = {
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

export type ProjectOverviewRow = Figures & { id: string; name: string; customer: string };

export type WorkPackageRow = Figures & {
  id: string;
  name: string;
  categoryName: string;
  responsibleName: string;
  status: WorkPackageStatus;
  startDate: Date;
  endDate: Date;
};

/** Arbejdspakkerne i én kategori med subtotal og udledt status */
export type CategoryGroup = {
  categoryName: string;
  status: WorkPackageStatus;
  workPackages: WorkPackageRow[];
  totals: Figures;
};

type RawWorkPackage = Omit<WorkPackageRow, 'forecastHours' | 'varianceHours'> & { projectId: string };

// Nøgletal pr. arbejdspakke. Den ENESTE kilde til estimat, brugt, resterende og kr:
// projekttotaler er summen af arbejdspakkerne og kan derfor ikke komme ud af takt med dem.
// filter er et Prisma.sql-fragment, så værdier altid sendes som parametre og aldrig som SQL-tekst.
function queryWorkPackages(filter: Prisma.Sql) {
  // ::float8 gør Postgres' numeric til almindelige JavaScript-tal, så komponenterne ikke skal kende Decimal
  return prisma.$queryRaw<RawWorkPackage[]>`
    WITH spent AS (
      -- Brugt i kr er SUM(timer × pris) pr. række, som Prismas _sum ikke kan udtrykke
      SELECT "workPackageId", SUM(hours) AS hours, SUM(hours * "hourlyRate") AS cost
      FROM time_entry
      GROUP BY "workPackageId"
    ),
    latest_remaining AS (
      -- Resterende er den seneste opdatering pr. arbejdspakke
      SELECT DISTINCT ON ("workPackageId") "workPackageId", "remainingHours"
      FROM remaining_update
      ORDER BY "workPackageId", "createdAt" DESC
    )
    SELECT
      wp.id,
      wp."projectId",
      wp.name,
      c.name AS "categoryName",
      e.name AS "responsibleName",
      wp.status::text AS status,
      wp."startDate",
      wp."endDate",
      wp."estimateHours"::float8 AS "estimateHours",
      COALESCE(s.hours, 0)::float8 AS "spentHours",
      COALESCE(lr."remainingHours", 0)::float8 AS "remainingHours",
      COALESCE(s.cost, 0)::float8 AS "spentCost"
    FROM work_package wp
    JOIN project p ON p.id = wp."projectId"
    JOIN work_package_category c ON c.id = wp."categoryId"
    JOIN employee e ON e.id = wp."responsibleId"
    LEFT JOIN spent s ON s."workPackageId" = wp.id
    LEFT JOIN latest_remaining lr ON lr."workPackageId" = wp.id
    WHERE ${filter}
    ORDER BY wp."startDate", wp.name`;
}

function withForecast<T extends Omit<Figures, 'forecastHours' | 'varianceHours'>>(row: T): T & Figures {
  const forecastHours = row.spentHours + row.remainingHours;
  return { ...row, forecastHours, varianceHours: forecastHours - row.estimateHours };
}

function sumFigures(rows: Figures[]): Figures {
  const total = (key: keyof Figures) => rows.reduce((sum, row) => sum + row[key], 0);
  return withForecast({
    estimateHours: total('estimateHours'),
    spentHours: total('spentHours'),
    remainingHours: total('remainingHours'),
    spentCost: total('spentCost'),
  });
}

// Nøgletal for alle aktive projekter (#11)
export async function getProjectOverview(): Promise<ProjectOverviewRow[]> {
  await requireSession();

  const [projects, workPackages] = await Promise.all([
    prisma.project.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true, customer: true },
      orderBy: { name: 'asc' },
    }),
    queryWorkPackages(Prisma.sql`p."archivedAt" IS NULL`),
  ]);

  return projects.map((project) => ({
    ...project,
    ...sumFigures(workPackages.filter((wp) => wp.projectId === project.id).map(withForecast)),
  }));
}

// Grupperer arbejdspakker pr. kategori. Rækkerne er sorteret efter startdato, så kategorierne
// kommer i den rækkefølge, deres første pakke starter (typisk Analyse og Design før Udvikling).
function groupByCategory(workPackages: WorkPackageRow[]): CategoryGroup[] {
  const groups = new Map<string, WorkPackageRow[]>();
  for (const wp of workPackages) {
    groups.set(wp.categoryName, [...(groups.get(wp.categoryName) ?? []), wp]);
  }
  return [...groups].map(([categoryName, rows]) => ({
    categoryName,
    status: categoryStatus(rows.map((wp) => wp.status)),
    workPackages: rows,
    totals: sumFigures(rows),
  }));
}

// Kategoriens status udledes af arbejdspakkerne og gemmes ikke, så den aldrig kan modsige dem.
// "Afventer" vinder over "I gang", så en blokeret pakke er synlig, også når kategorien er foldet sammen.
function categoryStatus(statuses: WorkPackageStatus[]): WorkPackageStatus {
  if (statuses.every((status) => status === 'done')) return 'done';
  if (statuses.every((status) => status === 'notStarted')) return 'notStarted';
  if (statuses.includes('onHold')) return 'onHold';
  return 'inProgress';
}

// Ét projekt med arbejdspakker grupperet pr. kategori (#12). null, hvis id'et ikke findes.
export async function getProjectDetail(id: string) {
  await requireSession();

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, customer: true, archivedAt: true },
  });
  if (!project) return null;

  const rawWorkPackages = await queryWorkPackages(Prisma.sql`wp."projectId" = ${id}`);
  const workPackages: WorkPackageRow[] = rawWorkPackages.map(({ projectId: _projectId, ...wp }) => withForecast(wp));

  return { project, categories: groupByCategory(workPackages), totals: sumFigures(workPackages) };
}
