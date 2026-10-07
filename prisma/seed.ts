// Mockdata til udvikling: npm run db:seed
// Sletter og genopretter alt domænedata. Brugere og logins (Better Auth) røres ikke.
// Datoer er relative til i dag, så data altid ser aktuelle ud. Tilfældige tal har en fast seed,
// så hver kørsel giver samme resultat.

import 'dotenv/config';
import type { PricingModel, Prisma, WorkPackageStatus } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/db';
import { resolveHourlyRate } from '@/lib/pricing';

// ---------- Data ----------

type TitleKey = 'junior' | 'dev' | 'senior' | 'pm';
type EmployeeKey = 'mette' | 'jonas' | 'sara' | 'ali' | 'freja' | 'emil';
/**
 * De fem første er standardkategorierne fra migrationen add_category_and_responsible.
 * Drift er et eksempel på en egen kategori, som kun seed opretter.
 */
type CategoryName = 'Analyse' | 'Design' | 'Udvikling' | 'Test' | 'Projektledelse' | 'Drift';
const CATEGORIES: CategoryName[] = ['Analyse', 'Design', 'Udvikling', 'Test', 'Projektledelse', 'Drift'];

type PackageSeed = {
  name: string;
  description?: string;
  category: CategoryName;
  responsible: EmployeeKey;
  status: WorkPackageStatus;
  estimate: number;
  /** Start og slut i dage fra i dag (negativ = fortid) */
  start: number;
  end: number;
  /** Brugt tid i alt, fordeles på hverdage fra start til i går */
  spent: number;
  /** Seneste vurdering af resterende */
  remaining: number;
  team: EmployeeKey[];
  /** Antal dage siden seneste resterende-opdatering. Over 7 = forældet (#13) */
  lastUpdate?: number;
};

type ProjectSeed = {
  name: string;
  customer: string;
  pricingModel: PricingModel;
  hourlyRate?: number;
  titleRates?: Partial<Record<TitleKey, number>>;
  archivedDaysAgo?: number;
  packages: PackageSeed[];
};

const TITLES: Record<TitleKey, { name: string; standardRate: number }> = {
  junior: { name: 'Juniorudvikler', standardRate: 850 },
  dev: { name: 'Udvikler', standardRate: 1050 },
  senior: { name: 'Seniorudvikler', standardRate: 1250 },
  pm: { name: 'Projektleder', standardRate: 1150 },
};

const EMPLOYEES: Record<EmployeeKey, { name: string; title: TitleKey; weeklyCapacity: number }> = {
  mette: { name: 'Mette Holm', title: 'pm', weeklyCapacity: 37 },
  jonas: { name: 'Jonas Kragh', title: 'senior', weeklyCapacity: 37 },
  sara: { name: 'Sara Lund', title: 'senior', weeklyCapacity: 30 },
  ali: { name: 'Ali Hassan', title: 'dev', weeklyCapacity: 37 },
  freja: { name: 'Freja Dahl', title: 'dev', weeklyCapacity: 37 },
  emil: { name: 'Emil Berg', title: 'junior', weeklyCapacity: 37 },
};

const PROJECTS: ProjectSeed[] = [
  {
    // Over budget: estimat 270 t, prognose 332 t
    name: 'Kundeportal',
    customer: 'Nordlys Energi',
    pricingModel: 'fixed',
    hourlyRate: 1100,
    packages: [
      { name: 'Login og brugere', category: 'Udvikling', responsible: 'jonas', status: 'done', estimate: 60, start: -70, end: -35, spent: 74, remaining: 0, team: ['jonas', 'ali'] },
      { name: 'Forbrugsoversigt', description: 'Grafer over forbrug pr. måned og år.', category: 'Udvikling', responsible: 'jonas', status: 'inProgress', estimate: 120, start: -40, end: 14, spent: 105, remaining: 45, team: ['jonas', 'freja', 'ali'] },
      { name: 'Fakturaarkiv', category: 'Udvikling', responsible: 'freja', status: 'inProgress', estimate: 50, start: -10, end: 28, spent: 18, remaining: 40, team: ['freja'] },
      { name: 'Projektledelse', category: 'Projektledelse', responsible: 'mette', status: 'inProgress', estimate: 40, start: -70, end: 28, spent: 38, remaining: 12, team: ['mette'] },
    ],
  },
  {
    // Titelpriser med aftalt seniorpris. Under budget: estimat 310 t, prognose 306 t
    name: 'Booking-app',
    customer: 'Havnens Færger',
    pricingModel: 'byTitle',
    titleRates: { senior: 1300 },
    packages: [
      { name: 'Design af bookingflow', category: 'Design', responsible: 'sara', status: 'done', estimate: 40, start: -35, end: -14, spent: 36, remaining: 0, team: ['sara'] },
      { name: 'Betalingsintegration', category: 'Udvikling', responsible: 'sara', status: 'onHold', estimate: 80, start: -21, end: 21, spent: 30, remaining: 48, team: ['sara', 'emil'], lastUpdate: 12 },
      { name: 'App til iOS og Android', category: 'Udvikling', responsible: 'ali', status: 'inProgress', estimate: 160, start: -7, end: 56, spent: 12, remaining: 150, team: ['ali', 'emil'] },
      { name: 'Projektledelse', category: 'Projektledelse', responsible: 'mette', status: 'inProgress', estimate: 30, start: -35, end: 56, spent: 10, remaining: 20, team: ['mette'] },
    ],
  },
  {
    // Titelpriser uden aftalte priser (standardpriser). Under budget: estimat 124 t, prognose 123 t
    name: 'Lagerintegration',
    customer: 'Grøn Cykel ApS',
    pricingModel: 'byTitle',
    packages: [
      { name: 'Analyse af lagersystem', category: 'Analyse', responsible: 'jonas', status: 'done', estimate: 24, start: -28, end: -14, spent: 22, remaining: 0, team: ['jonas'] },
      { name: 'Synkronisering af varer', category: 'Udvikling', responsible: 'jonas', status: 'inProgress', estimate: 70, start: -14, end: 21, spent: 25, remaining: 46, team: ['jonas', 'emil'], lastUpdate: 9 },
      { name: 'Overvågning og alarmer', category: 'Udvikling', responsible: 'freja', status: 'notStarted', estimate: 30, start: 7, end: 35, spent: 0, remaining: 30, team: ['freja'] },
    ],
  },
  {
    // Stort projekt med alle kategorier, blandede statusser og en egen kategori (Drift).
    // Viser træstrukturen på projektdetaljen. Estimat 696 t, prognose 729 t.
    name: 'Beboerportal',
    customer: 'Østerlund Boligselskab',
    pricingModel: 'byTitle',
    titleRates: { pm: 1200 },
    packages: [
      // Analyse: alle afsluttet
      { name: 'Workshop med beboerrepræsentanter', category: 'Analyse', responsible: 'mette', status: 'done', estimate: 16, start: -84, end: -77, spent: 18, remaining: 0, team: ['mette', 'sara'] },
      { name: 'Kravspecifikation', category: 'Analyse', responsible: 'sara', status: 'done', estimate: 40, start: -80, end: -60, spent: 44, remaining: 0, team: ['sara'] },
      { name: 'Analyse af ejendomssystemets API', category: 'Analyse', responsible: 'jonas', status: 'done', estimate: 24, start: -70, end: -56, spent: 20, remaining: 0, team: ['jonas'] },
      // Design: afsluttet og i gang
      { name: 'Brugerrejser og wireframes', category: 'Design', responsible: 'sara', status: 'done', estimate: 40, start: -63, end: -42, spent: 46, remaining: 0, team: ['sara'] },
      { name: 'Visuelt design', category: 'Design', responsible: 'sara', status: 'inProgress', estimate: 60, start: -49, end: -14, spent: 52, remaining: 6, team: ['sara', 'freja'] },
      { name: 'Designsystem', category: 'Design', responsible: 'freja', status: 'inProgress', estimate: 30, start: -35, end: 7, spent: 14, remaining: 18, team: ['freja'] },
      // Udvikling: én pakke afventer leverandøren, to er over budget
      { name: 'Login med MitID', category: 'Udvikling', responsible: 'jonas', status: 'inProgress', estimate: 50, start: -42, end: -7, spent: 48, remaining: 10, team: ['jonas'] },
      { name: 'Fejlmeldinger', description: 'Beboere melder fejl med billeder; viceværten følger op.', category: 'Udvikling', responsible: 'ali', status: 'inProgress', estimate: 90, start: -35, end: 21, spent: 52, remaining: 45, team: ['ali', 'emil'] },
      { name: 'Booking af fælleslokaler', category: 'Udvikling', responsible: 'freja', status: 'inProgress', estimate: 70, start: -21, end: 35, spent: 20, remaining: 50, team: ['freja', 'emil'] },
      { name: 'Integration til ejendomssystem', description: 'Afventer adgang til leverandørens test-API.', category: 'Udvikling', responsible: 'jonas', status: 'onHold', estimate: 80, start: -28, end: 28, spent: 30, remaining: 60, team: ['jonas'], lastUpdate: 15 },
      { name: 'Nyheder og opslag', category: 'Udvikling', responsible: 'emil', status: 'notStarted', estimate: 40, start: 7, end: 28, spent: 0, remaining: 40, team: ['emil'] },
      // Test: afsluttet og ikke startet
      { name: 'Testplan', category: 'Test', responsible: 'ali', status: 'done', estimate: 12, start: -14, end: -7, spent: 10, remaining: 0, team: ['ali'] },
      { name: 'Brugertest med beboere', category: 'Test', responsible: 'sara', status: 'notStarted', estimate: 24, start: 14, end: 28, spent: 0, remaining: 24, team: ['sara'] },
      { name: 'Tilgængelighedstest (WCAG)', category: 'Test', responsible: 'freja', status: 'notStarted', estimate: 20, start: 21, end: 35, spent: 0, remaining: 20, team: ['freja'] },
      // Drift: egen kategori
      { name: 'Hosting og overvågning', category: 'Drift', responsible: 'jonas', status: 'notStarted', estimate: 20, start: 28, end: 49, spent: 0, remaining: 20, team: ['jonas'] },
      // Projektledelse
      { name: 'Projektledelse', category: 'Projektledelse', responsible: 'mette', status: 'inProgress', estimate: 80, start: -84, end: 49, spent: 52, remaining: 30, team: ['mette'] },
    ],
  },
  {
    // Afsluttet og arkiveret
    name: 'Webshop-redesign',
    customer: 'Fiskerkonen',
    pricingModel: 'fixed',
    hourlyRate: 1000,
    archivedDaysAgo: 30,
    packages: [
      { name: 'Redesign', category: 'Design', responsible: 'sara', status: 'done', estimate: 80, start: -120, end: -40, spent: 78, remaining: 0, team: ['sara', 'freja'] },
      { name: 'Test og lancering', category: 'Test', responsible: 'ali', status: 'done', estimate: 20, start: -45, end: -31, spent: 22, remaining: 0, team: ['ali'] },
    ],
  },
];

/** Allokeringer genereres for disse uger (0 = denne uge) */
const ALLOCATION_WEEKS = [-2, -1, 0, 1, 2, 3, 4];

// ---------- Hjælpere ----------

// Tilfældige tal med fast seed (mulberry32): samme rækkefølge ved hver kørsel
let state = 42;
function random() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];

// Datoer som UTC-midnat, så @db.Date gemmer den rigtige dag uanset tidszone
const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const daysFromToday = (days: number) => new Date(today.getTime() + days * DAY);
const mondayOf = (date: Date) => new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY);

function weekdaysBetween(from: Date, to: Date) {
  const days: Date[] = [];
  for (let day = from; day <= to; day = new Date(day.getTime() + DAY)) {
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) days.push(day);
  }
  return days;
}

// Halve timer, så værdierne ligner rigtige vurderinger
const roundToHalf = (hours: number) => Math.round(hours * 2) / 2;

// ---------- Seed ----------

async function main() {
  // Ryd domænedata. Rækkefølgen respekterer fremmednøglerne: det, der peger, slettes først.
  await prisma.$transaction([
    prisma.allocation.deleteMany(),
    prisma.remainingUpdate.deleteMany(),
    prisma.timeEntry.deleteMany(),
    prisma.projectTitleRate.deleteMany(),
    prisma.workPackage.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.project.deleteMany(),
    prisma.title.deleteMany(),
  ]);

  const titles = new Map<TitleKey, { id: string; standardRate: Prisma.Decimal }>();
  for (const [key, title] of Object.entries(TITLES) as [TitleKey, (typeof TITLES)[TitleKey]][]) {
    titles.set(key, await prisma.title.create({ data: title }));
  }

  // Kategorier er referencedata fra migrationen og slettes ikke. upsert sikrer, at de findes.
  const categories = new Map<CategoryName, string>();
  for (const name of CATEGORIES) {
    const category = await prisma.workPackageCategory.upsert({ where: { name }, update: {}, create: { name } });
    categories.set(name, category.id);
  }

  const employees = new Map<EmployeeKey, { id: string; titleKey: TitleKey }>();
  for (const [key, employee] of Object.entries(EMPLOYEES) as [EmployeeKey, (typeof EMPLOYEES)[EmployeeKey]][]) {
    const created = await prisma.employee.create({
      data: { name: employee.name, titleId: titles.get(employee.title)!.id, weeklyCapacity: employee.weeklyCapacity },
    });
    employees.set(key, { id: created.id, titleKey: employee.title });
  }

  // Én allokering pr. medarbejder, arbejdspakke og uge (samme regel som @@unique i skemaet)
  const allocations = new Map<string, Prisma.AllocationCreateManyInput>();
  const counts = { timeEntries: 0, remainingUpdates: 0 };

  for (const projectSeed of PROJECTS) {
    const project = await prisma.project.create({
      data: {
        name: projectSeed.name,
        customer: projectSeed.customer,
        pricingModel: projectSeed.pricingModel,
        hourlyRate: projectSeed.hourlyRate ?? null,
        archivedAt: projectSeed.archivedDaysAgo ? daysFromToday(-projectSeed.archivedDaysAgo) : null,
        titleRates: {
          create: (Object.entries(projectSeed.titleRates ?? {}) as [TitleKey, number][]).map(([key, hourlyRate]) => ({
            titleId: titles.get(key)!.id,
            hourlyRate,
          })),
        },
      },
      include: { titleRates: true },
    });

    for (const pkg of projectSeed.packages) {
      const startDate = daysFromToday(pkg.start);
      const endDate = daysFromToday(pkg.end);
      const workPackage = await prisma.workPackage.create({
        data: {
          projectId: project.id,
          name: pkg.name,
          description: pkg.description,
          categoryId: categories.get(pkg.category)!,
          responsibleId: employees.get(pkg.responsible)!.id,
          status: pkg.status,
          estimateHours: pkg.estimate,
          startDate,
          endDate,
        },
      });

      // Brugt tid: fordel timerne på hverdage og teamet. Prisen låses via resolveHourlyRate.
      const lastWorkday = endDate < today ? endDate : daysFromToday(-1);
      const days = weekdaysBetween(startDate, lastWorkday);
      const timeEntries: Prisma.TimeEntryCreateManyInput[] = [];
      let left = pkg.spent;
      for (let i = 0; left > 0 && days.length > 0; i++) {
        const employee = employees.get(pkg.team[i % pkg.team.length])!;
        const title = titles.get(employee.titleKey)!;
        const hours = Math.min(left, pick([2, 3, 3.5, 4, 5, 6, 7.5]));
        left -= hours;
        timeEntries.push({
          employeeId: employee.id,
          workPackageId: workPackage.id,
          date: days[i % days.length],
          hours,
          titleId: title.id,
          hourlyRate: resolveHourlyRate(project, title),
          source: 'mock',
        });
      }
      await prisma.timeEntry.createMany({ data: timeEntries });
      counts.timeEntries += timeEntries.length;

      // Resterende: estimat ved opstart, en vurdering midtvejs og den seneste vurdering
      const finished = pkg.remaining === 0 && endDate < today;
      const lastDate = finished ? endDate : daysFromToday(-(pkg.lastUpdate ?? 2));
      const updates: Prisma.RemainingUpdateCreateManyInput[] =
        startDate >= lastDate
          ? [{ workPackageId: workPackage.id, remainingHours: pkg.remaining, comment: 'Første vurdering', createdAt: lastDate }]
          : [
              { workPackageId: workPackage.id, remainingHours: pkg.estimate, comment: 'Estimat ved opstart', createdAt: startDate },
              {
                workPackageId: workPackage.id,
                remainingHours: roundToHalf((pkg.estimate + pkg.remaining) / 2),
                createdAt: new Date((startDate.getTime() + lastDate.getTime()) / 2),
              },
              {
                workPackageId: workPackage.id,
                remainingHours: pkg.remaining,
                comment: finished ? 'Afsluttet' : undefined,
                createdAt: lastDate,
              },
            ];
      await prisma.remainingUpdate.createMany({ data: updates });
      counts.remainingUpdates += updates.length;

      // Allokeringer for de uger, hvor arbejdspakken er i gang (ikke arkiverede projekter)
      if (projectSeed.archivedDaysAgo) continue;
      for (const week of ALLOCATION_WEEKS) {
        const weekStart = daysFromToday(week * 7 - ((today.getUTCDay() + 6) % 7));
        const weekEnd = new Date(weekStart.getTime() + 4 * DAY);
        if (weekEnd < startDate || weekStart > endDate) continue;
        for (const key of pkg.team) {
          const employeeId = employees.get(key)!.id;
          allocations.set(`${employeeId}|${workPackage.id}|${weekStart.toISOString()}`, {
            employeeId,
            workPackageId: workPackage.id,
            weekStart,
            hours: pick([4, 6, 8, 10, 12, 16]),
          });
        }
      }
    }
  }

  // Tydeligt eksempel på overbooking i denne uge (#16): Jonas får 30 + 12 = 42 t mod en kapacitet på 37 t.
  // Begge sættes eksplicit, så eksemplet ikke afhænger af de tilfældige tal.
  const jonas = employees.get('jonas')!.id;
  const thisWeek = mondayOf(today);
  for (const [name, hours] of [['Forbrugsoversigt', 30], ['Synkronisering af varer', 12]] as const) {
    const workPackage = await prisma.workPackage.findFirstOrThrow({ where: { name } });
    allocations.set(`${jonas}|${workPackage.id}|${thisWeek.toISOString()}`, {
      employeeId: jonas,
      workPackageId: workPackage.id,
      weekStart: thisWeek,
      hours,
    });
  }

  await prisma.allocation.createMany({ data: [...allocations.values()] });

  console.log(
    `Seed færdig: ${titles.size} titler, ${employees.size} medarbejdere, ${PROJECTS.length} projekter, ` +
      `${PROJECTS.reduce((sum, p) => sum + p.packages.length, 0)} arbejdspakker, ${counts.timeEntries} tidsregistreringer, ` +
      `${counts.remainingUpdates} resterende-opdateringer, ${allocations.size} allokeringer`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
