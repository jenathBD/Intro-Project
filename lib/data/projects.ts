import 'server-only';

import { Prisma, type ProjectKind, type WorkPackageStatus } from '@/app/generated/prisma/client';
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

export type ProjectOverviewRow = Figures & { id: string; name: string; customer: string; kind: ProjectKind };

export type WorkPackageRow = Figures & {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  epicId: string | null;
  epicName: string | null;
  /** false = pakken har intet estimat. estimateHours er så 0, så summerne stadig går op (#50). */
  estimated: boolean;
  responsibleId: string | null;
  responsibleName: string | null;
  status: WorkPackageStatus;
  startDate: Date | null;
  endDate: Date | null;
  /** Issuets nummer i projektets repo (#50) */
  githubNumber: number | null;
  /** Tidspunkt for den seneste resterende-opdatering. null, hvis der aldrig er givet en vurdering */
  remainingUpdatedAt: Date | null;
};

/** Arbejdspakkerne i ét epic inden for en kategori, med subtotal og udledt status */
export type EpicGroup = {
  id: string;
  name: string;
  status: WorkPackageStatus;
  workPackages: WorkPackageRow[];
  totals: Figures;
};

/** En kategori med dens epics og pakkerne uden epic (#50). Totalerne dækker alle pakkerne i kategorien. */
export type CategoryGroup = {
  id: string;
  name: string;
  status: WorkPackageStatus;
  epics: EpicGroup[];
  /** Pakker uden epic, fx projektledelse */
  withoutEpic: WorkPackageRow[];
  workPackageCount: number;
  totals: Figures;
};

export type EpicOption = { id: string; name: string };

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
      SELECT DISTINCT ON ("workPackageId") "workPackageId", "remainingHours", "createdAt"
      FROM remaining_update
      ORDER BY "workPackageId", "createdAt" DESC
    )
    SELECT
      wp.id,
      wp."projectId",
      wp.name,
      wp.description,
      wp."categoryId",
      c.name AS "categoryName",
      wp."epicId",
      ep.name AS "epicName",
      wp."responsibleId",
      e.name AS "responsibleName",
      wp.status::text AS status,
      wp."startDate",
      wp."endDate",
      wp."githubNumber",
      -- Uden estimat tæller pakken som 0 t i estimatet, men dens brugte tid tæller med i prognosen
      wp."estimateHours" IS NOT NULL AS estimated,
      COALESCE(wp."estimateHours", 0)::float8 AS "estimateHours",
      COALESCE(s.hours, 0)::float8 AS "spentHours",
      COALESCE(lr."remainingHours", 0)::float8 AS "remainingHours",
      lr."createdAt" AS "remainingUpdatedAt",
      COALESCE(s.cost, 0)::float8 AS "spentCost"
    FROM work_package wp
    JOIN project p ON p.id = wp."projectId"
    JOIN work_package_category c ON c.id = wp."categoryId"
    LEFT JOIN employee e ON e.id = wp."responsibleId"
    LEFT JOIN epic ep ON ep.id = wp."epicId"
    LEFT JOIN spent s ON s."workPackageId" = wp.id
    LEFT JOIN latest_remaining lr ON lr."workPackageId" = wp.id
    WHERE ${filter}
    ORDER BY wp."startDate" NULLS LAST, wp.name`;
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

// Nøgletal for alle aktive projekter (#11), eller for de arkiverede (#14).
// Fravær (fx Ferie) er ikke et projekt i oversigten og kommer ikke med (#44).
export async function getProjectOverview({ archived = false } = {}): Promise<ProjectOverviewRow[]> {
  await requireSession();

  const [projects, workPackages] = await Promise.all([
    prisma.project.findMany({
      where: { archivedAt: archived ? { not: null } : null, kind: { not: 'absence' } },
      select: { id: true, name: true, customer: true, kind: true },
      orderBy: { name: 'asc' },
    }),
    queryWorkPackages(archived ? Prisma.sql`p."archivedAt" IS NOT NULL` : Prisma.sql`p."archivedAt" IS NULL`),
  ]);

  return projects.map((project) => ({
    ...project,
    ...sumFigures(workPackages.filter((wp) => wp.projectId === project.id).map(withForecast)),
  }));
}

// Samler rækker i grupper efter en nøgle. Rækkerne er sorteret efter startdato, så grupperne kommer
// i den rækkefølge, deres første pakke starter (typisk Analyse og Design før Udvikling).
function groupRows(rows: WorkPackageRow[], key: (wp: WorkPackageRow) => string) {
  const groups = new Map<string, WorkPackageRow[]>();
  for (const wp of rows) groups.set(key(wp), [...(groups.get(key(wp)) ?? []), wp]);
  return [...groups.values()];
}

// Kategori → epic → arbejdspakke (#50). Et epic kan gå på tværs af kategorier (fx udvikling og test af
// samme app) og står så under hver kategori med de pakker, der hører til den.
function groupByCategoryAndEpic(workPackages: WorkPackageRow[]): CategoryGroup[] {
  return groupRows(workPackages, (wp) => wp.categoryId).map((rows) => ({
    id: rows[0].categoryId,
    name: rows[0].categoryName,
    status: groupStatus(rows.map((wp) => wp.status)),
    epics: groupRows(
      rows.filter((wp) => wp.epicId),
      (wp) => wp.epicId!,
    ).map((epicRows) => ({
      id: epicRows[0].epicId!,
      name: epicRows[0].epicName!,
      status: groupStatus(epicRows.map((wp) => wp.status)),
      workPackages: epicRows,
      totals: sumFigures(epicRows),
    })),
    withoutEpic: rows.filter((wp) => !wp.epicId),
    workPackageCount: rows.length,
    totals: sumFigures(rows),
  }));
}

// Gruppens status udledes af arbejdspakkerne og gemmes ikke, så den aldrig kan modsige dem.
// "Afventer" vinder over "I gang", så en blokeret pakke er synlig, også når gruppen er foldet sammen.
function groupStatus(statuses: WorkPackageStatus[]): WorkPackageStatus {
  if (statuses.every((status) => status === 'done')) return 'done';
  if (statuses.every((status) => status === 'notStarted')) return 'notStarted';
  if (statuses.includes('onHold')) return 'onHold';
  return 'inProgress';
}

// Ét projekt med arbejdspakker grupperet pr. kategori (#12) og derunder pr. epic (#50). null, hvis id'et ikke findes.
export async function getProjectDetail(id: string) {
  await requireSession();

  const found = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      customer: true,
      archivedAt: true,
      kind: true,
      pricingModel: true,
      hourlyRate: true,
      titleRates: { select: { titleId: true, hourlyRate: true } },
      epics: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
    },
  });
  if (!found) return null;

  // Decimal → number, så projektet kan sendes til redigeringsformularen (Client Component)
  const project = {
    ...found,
    hourlyRate: found.hourlyRate === null ? null : Number(found.hourlyRate),
    titleRates: found.titleRates.map((rate) => ({ titleId: rate.titleId, hourlyRate: Number(rate.hourlyRate) })),
  };

  const rawWorkPackages = await queryWorkPackages(Prisma.sql`wp."projectId" = ${id}`);
  const workPackages: WorkPackageRow[] = rawWorkPackages.map(({ projectId: _projectId, ...wp }) => withForecast(wp));

  return {
    project,
    workPackageCount: workPackages.length,
    categories: groupByCategoryAndEpic(workPackages),
    totals: sumFigures(workPackages),
  };
}

/** Projektets felter til redigeringsformularen (#14) */
export type ProjectForEdit = NonNullable<Awaited<ReturnType<typeof getProjectDetail>>>['project'];
