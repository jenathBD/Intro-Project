// Mockdata til udvikling: npm run db:seed
// Sletter og genopretter alt domænedata. Brugere og logins (Better Auth) røres ikke.
// Datoer er relative til i dag, så data altid ser aktuelle ud. Tilfældige tal har en fast seed,
// så hver kørsel giver samme resultat.

import 'dotenv/config';
import type { PricingModel, Prisma, WorkPackageStatus } from '@/app/generated/prisma/client';
import { FULL_TIME_HOURS } from '@/lib/capacity';
import { prisma } from '@/lib/db';
import { resolveHourlyRate } from '@/lib/pricing';
import { ABSENCE_PROJECT_ID, INTERNAL_TIME_PROJECT_ID, SYSTEM_PROJECT_IDS } from '@/lib/system-projects';

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

/** De øvrige medarbejdere (i alt 25). De er ikke ansvarlige for arbejdspakker, men allokeres efter EXTRA_PATTERNS. */
const EXTRA_EMPLOYEES: { name: string; title: TitleKey; weeklyCapacity: number }[] = [
  { name: 'Anders Kjær', title: 'dev', weeklyCapacity: 37 },
  { name: 'Camilla Vestergaard', title: 'senior', weeklyCapacity: 37 },
  { name: 'Rasmus Thomsen', title: 'dev', weeklyCapacity: 37 },
  { name: 'Louise Andersen', title: 'pm', weeklyCapacity: 37 },
  { name: 'Mikkel Høj', title: 'junior', weeklyCapacity: 37 },
  { name: 'Ida Lauritsen', title: 'dev', weeklyCapacity: 37 },
  { name: 'Nikolaj Brandt', title: 'senior', weeklyCapacity: 37 },
  { name: 'Signe Frost', title: 'dev', weeklyCapacity: 37 },
  { name: 'Kasper Lind', title: 'junior', weeklyCapacity: 37 },
  { name: 'Maja Skov', title: 'dev', weeklyCapacity: 37 },
  { name: 'Thomas Bech', title: 'senior', weeklyCapacity: 37 },
  { name: 'Julie Krogh', title: 'dev', weeklyCapacity: 37 },
  { name: 'Oliver Juhl', title: 'junior', weeklyCapacity: 37 },
  { name: 'Emma Winther', title: 'pm', weeklyCapacity: 37 },
  { name: 'Frederik Dam', title: 'dev', weeklyCapacity: 37 },
  { name: 'Laura Holt', title: 'dev', weeklyCapacity: 30 },
  { name: 'Christian Riis', title: 'senior', weeklyCapacity: 37 },
  { name: 'Sofie Kirk', title: 'junior', weeklyCapacity: 30 },
  { name: 'Mads Ravn', title: 'dev', weeklyCapacity: 37 },
];

/**
 * FTE-mønstre for de øvrige medarbejdere. Medarbejder nr. i får mønster i % længden og projekter i rotation,
 * så resultatet er det samme ved hver kørsel. Hver fjerde slutter efter uge 4, så der også er ledig tid længere fremme.
 */
const EXTRA_PATTERNS: number[][] = [[1.0], [0.6, 0.4], [0.5, 0.5], [0.4, 0.4, 0.2], [0.8], [0.6, 0.2], [0.5, 0.3]];

const PROJECTS: ProjectSeed[] = [
  {
    // Over budget: estimat 270 t, prognose 332 t
    name: 'Kundeportal',
    customer: 'Nordlys Energi',
    pricingModel: 'fixed',
    hourlyRate: 1100,
    packages: [
      { name: 'Login og brugere', category: 'Udvikling', responsible: 'jonas', status: 'done', estimate: 60, start: -70, end: -35, spent: 74, remaining: 0 },
      { name: 'Forbrugsoversigt', description: 'Grafer over forbrug pr. måned og år.', category: 'Udvikling', responsible: 'jonas', status: 'inProgress', estimate: 120, start: -40, end: 14, spent: 105, remaining: 45 },
      { name: 'Fakturaarkiv', category: 'Udvikling', responsible: 'freja', status: 'inProgress', estimate: 50, start: -10, end: 28, spent: 18, remaining: 40 },
      { name: 'Projektledelse', category: 'Projektledelse', responsible: 'mette', status: 'inProgress', estimate: 40, start: -70, end: 28, spent: 38, remaining: 12 },
    ],
  },
  {
    // Titelpriser med aftalt seniorpris. Under budget: estimat 310 t, prognose 306 t
    name: 'Booking-app',
    customer: 'Havnens Færger',
    pricingModel: 'byTitle',
    titleRates: { senior: 1300 },
    packages: [
      { name: 'Design af bookingflow', category: 'Design', responsible: 'sara', status: 'done', estimate: 40, start: -35, end: -14, spent: 36, remaining: 0 },
      { name: 'Betalingsintegration', category: 'Udvikling', responsible: 'sara', status: 'onHold', estimate: 80, start: -21, end: 21, spent: 30, remaining: 48, lastUpdate: 12 },
      { name: 'App til iOS og Android', category: 'Udvikling', responsible: 'ali', status: 'inProgress', estimate: 160, start: -7, end: 56, spent: 12, remaining: 150 },
      { name: 'Projektledelse', category: 'Projektledelse', responsible: 'mette', status: 'inProgress', estimate: 30, start: -35, end: 56, spent: 10, remaining: 20 },
    ],
  },
  {
    // Titelpriser uden aftalte priser (standardpriser). Under budget: estimat 124 t, prognose 123 t
    name: 'Lagerintegration',
    customer: 'Grøn Cykel ApS',
    pricingModel: 'byTitle',
    packages: [
      { name: 'Analyse af lagersystem', category: 'Analyse', responsible: 'jonas', status: 'done', estimate: 24, start: -28, end: -14, spent: 22, remaining: 0 },
      { name: 'Synkronisering af varer', category: 'Udvikling', responsible: 'jonas', status: 'inProgress', estimate: 70, start: -14, end: 21, spent: 25, remaining: 46, lastUpdate: 9 },
      { name: 'Overvågning og alarmer', category: 'Udvikling', responsible: 'freja', status: 'notStarted', estimate: 30, start: 7, end: 35, spent: 0, remaining: 30 },
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
      { name: 'Workshop med beboerrepræsentanter', category: 'Analyse', responsible: 'mette', status: 'done', estimate: 16, start: -84, end: -77, spent: 18, remaining: 0 },
      { name: 'Kravspecifikation', category: 'Analyse', responsible: 'sara', status: 'done', estimate: 40, start: -80, end: -60, spent: 44, remaining: 0 },
      { name: 'Analyse af ejendomssystemets API', category: 'Analyse', responsible: 'jonas', status: 'done', estimate: 24, start: -70, end: -56, spent: 20, remaining: 0 },
      // Design: afsluttet og i gang
      { name: 'Brugerrejser og wireframes', category: 'Design', responsible: 'sara', status: 'done', estimate: 40, start: -63, end: -42, spent: 46, remaining: 0 },
      { name: 'Visuelt design', category: 'Design', responsible: 'sara', status: 'inProgress', estimate: 60, start: -49, end: -14, spent: 52, remaining: 6 },
      { name: 'Designsystem', category: 'Design', responsible: 'freja', status: 'inProgress', estimate: 30, start: -35, end: 7, spent: 14, remaining: 18 },
      // Udvikling: én pakke afventer leverandøren, to er over budget
      { name: 'Login med MitID', category: 'Udvikling', responsible: 'jonas', status: 'inProgress', estimate: 50, start: -42, end: -7, spent: 48, remaining: 10 },
      { name: 'Fejlmeldinger', description: 'Beboere melder fejl med billeder; viceværten følger op.', category: 'Udvikling', responsible: 'ali', status: 'inProgress', estimate: 90, start: -35, end: 21, spent: 52, remaining: 45 },
      { name: 'Booking af fælleslokaler', category: 'Udvikling', responsible: 'freja', status: 'inProgress', estimate: 70, start: -21, end: 35, spent: 20, remaining: 50 },
      { name: 'Integration til ejendomssystem', description: 'Afventer adgang til leverandørens test-API.', category: 'Udvikling', responsible: 'jonas', status: 'onHold', estimate: 80, start: -28, end: 28, spent: 30, remaining: 60, lastUpdate: 15 },
      { name: 'Nyheder og opslag', category: 'Udvikling', responsible: 'emil', status: 'notStarted', estimate: 40, start: 7, end: 28, spent: 0, remaining: 40 },
      // Test: afsluttet og ikke startet
      { name: 'Testplan', category: 'Test', responsible: 'ali', status: 'done', estimate: 12, start: -14, end: -7, spent: 10, remaining: 0 },
      { name: 'Brugertest med beboere', category: 'Test', responsible: 'sara', status: 'notStarted', estimate: 24, start: 14, end: 28, spent: 0, remaining: 24 },
      { name: 'Tilgængelighedstest (WCAG)', category: 'Test', responsible: 'freja', status: 'notStarted', estimate: 20, start: 21, end: 35, spent: 0, remaining: 20 },
      // Drift: egen kategori
      { name: 'Hosting og overvågning', category: 'Drift', responsible: 'jonas', status: 'notStarted', estimate: 20, start: 28, end: 49, spent: 0, remaining: 20 },
      // Projektledelse
      { name: 'Projektledelse', category: 'Projektledelse', responsible: 'mette', status: 'inProgress', estimate: 80, start: -84, end: 49, spent: 52, remaining: 30 },
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
      { name: 'Redesign', category: 'Design', responsible: 'sara', status: 'done', estimate: 80, start: -120, end: -40, spent: 78, remaining: 0 },
      { name: 'Test og lancering', category: 'Test', responsible: 'ali', status: 'done', estimate: 20, start: -45, end: -31, spent: 22, remaining: 0 },
    ],
  },
];

/**
 * Allokeringer i FTE pr. medarbejder og projekt (#16). Hver medarbejder har 1,0 pr. uge at fordele.
 * from/to er uger relativt til denne uge (0 = denne uge, -2 = for to uger siden).
 * Håndlavet, så billedet er overskueligt: Jonas er bevidst overbooket i denne uge, Sara og Mette har ledig tid.
 */
const ALLOCATIONS: { employee: EmployeeKey; project: string; fte: number; from: number; to: number }[] = [
  { employee: 'jonas', project: 'Kundeportal', fte: 0.6, from: -2, to: 2 },
  { employee: 'jonas', project: 'Lagerintegration', fte: 0.4, from: -2, to: 3 },
  { employee: 'jonas', project: 'Beboerportal', fte: 0.3, from: 0, to: 0 }, // overbooking: 1,3 i denne uge
  { employee: 'jonas', project: 'Beboerportal', fte: 0.6, from: 3, to: 8 },
  { employee: 'jonas', project: 'Intern tid', fte: 0.4, from: 5, to: 8 }, // lavperiode: blå markering (#44)
  { employee: 'mette', project: 'Kundeportal', fte: 0.2, from: -2, to: 3 },
  { employee: 'mette', project: 'Booking-app', fte: 0.2, from: -2, to: 8 },
  { employee: 'mette', project: 'Beboerportal', fte: 0.4, from: -2, to: 8 },
  { employee: 'sara', project: 'Booking-app', fte: 0.4, from: -2, to: -1 }, // Sara er på 30 t = 0,8 FTE
  { employee: 'sara', project: 'Beboerportal', fte: 0.4, from: -2, to: 5 },
  { employee: 'sara', project: 'Ferie', fte: 0.4, from: 2, to: 2 }, // to dages ferie: fuldt planlagt den uge (#44)
  { employee: 'mette', project: 'Ferie', fte: 0.2, from: 1, to: 1 }, // én feriedag oven i 0,8 = fuldt planlagt
  { employee: 'ali', project: 'Kundeportal', fte: 0.2, from: -2, to: 0 },
  { employee: 'ali', project: 'Booking-app', fte: 0.4, from: -2, to: 8 },
  { employee: 'ali', project: 'Beboerportal', fte: 0.4, from: -2, to: 8 },
  { employee: 'freja', project: 'Kundeportal', fte: 0.5, from: -2, to: 4 },
  { employee: 'freja', project: 'Beboerportal', fte: 0.5, from: -2, to: 8 },
  { employee: 'freja', project: 'Lagerintegration', fte: 0.5, from: 5, to: 8 },
  { employee: 'emil', project: 'Booking-app', fte: 0.6, from: -2, to: 8 },
  { employee: 'emil', project: 'Lagerintegration', fte: 0.4, from: -2, to: 3 },
  { employee: 'emil', project: 'Beboerportal', fte: 0.4, from: 4, to: 8 },
];

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
const WEEK = 7 * DAY;
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
    // Referenceprojekterne "Intern tid" og "Ferie" fra migrationen bevares
    prisma.project.deleteMany({ where: { id: { notIn: SYSTEM_PROJECT_IDS } } }),
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

  const extraEmployeeIds: string[] = [];
  for (const employee of EXTRA_EMPLOYEES) {
    const created = await prisma.employee.create({
      data: { name: employee.name, titleId: titles.get(employee.title)!.id, weeklyCapacity: employee.weeklyCapacity },
    });
    extraEmployeeIds.push(created.id);
  }

  // Én allokering pr. medarbejder, arbejdspakke og uge (samme regel som @@unique i skemaet)
  const projectIds = new Map<string, string>();
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
    projectIds.set(projectSeed.name, project.id);

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

      // Brugt tid: fordel timerne på hverdage. Registreres af den ansvarlige. Prisen låses via resolveHourlyRate.
      const lastWorkday = endDate < today ? endDate : daysFromToday(-1);
      const days = weekdaysBetween(startDate, lastWorkday);
      const timeEntries: Prisma.TimeEntryCreateManyInput[] = [];
      const employee = employees.get(pkg.responsible)!;
      let left = pkg.spent;
      for (let i = 0; left > 0 && days.length > 0; i++) {
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
    }
  }

  // Referenceprojekterne (#44). upsert, så seed også virker, hvis de er blevet slettet.
  const systemProjects = [
    { id: INTERNAL_TIME_PROJECT_ID, name: 'Intern tid', kind: 'internal' as const },
    { id: ABSENCE_PROJECT_ID, name: 'Ferie', kind: 'absence' as const },
  ];
  for (const { id, name, kind } of systemProjects) {
    await prisma.project.upsert({ where: { id }, update: {}, create: { id, name, kind, customer: 'Better Developers' } });
    projectIds.set(name, id);
  }

  // Allokeringer i FTE pr. medarbejder, projekt og uge (#16)
  const thisMonday = mondayOf(today);
  const weeksFrom = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => new Date(thisMonday.getTime() + (from + i) * WEEK));

  // 1. Den håndlavede liste for de seks kernemedarbejdere
  const allocations: Prisma.AllocationCreateManyInput[] = ALLOCATIONS.flatMap(({ employee, project, fte, from, to }) =>
    weeksFrom(from, to).map((weekStart) => ({
      employeeId: employees.get(employee)!.id,
      projectId: projectIds.get(project)!,
      weekStart,
      fte,
    })),
  );

  // 2. Mønstre for de øvrige medarbejdere, fordelt på de aktive projekter i rotation
  const activeProjects = PROJECTS.filter((p) => !p.archivedDaysAgo).map((p) => projectIds.get(p.name)!);
  extraEmployeeIds.forEach((employeeId, i) => {
    const pattern = EXTRA_PATTERNS[i % EXTRA_PATTERNS.length];
    const lastWeek = i % 4 === 3 ? 4 : 8;
    // Mønstrene er for fuld tid. På deltid skaleres de, så 30 t (0,8 FTE) fx får 0,5 + 0,3 i stedet for 0,6 + 0,4.
    const scale = EXTRA_EMPLOYEES[i].weeklyCapacity / FULL_TIME_HOURS;
    pattern.forEach((fullTimeFte, j) => {
      const fte = Math.round(fullTimeFte * scale * 10) / 10;
      const projectId = activeProjects[(i + j) % activeProjects.length];
      for (const weekStart of weeksFrom(-2, lastWeek)) allocations.push({ employeeId, projectId, weekStart, fte });
    });
    // Den første, der slutter efter uge 4, sættes på Intern tid bagefter (lavperiode, blå markering). De andre forbliver ledige.
    if (i === 3) {
      for (const weekStart of weeksFrom(5, 8)) {
        allocations.push({ employeeId, projectId: INTERNAL_TIME_PROJECT_ID, weekStart, fte: Math.round(scale * 10) / 10 });
      }
    }
  });

  // 3. Endnu et bevidst eksempel på overbooking: den anden ekstra medarbejder (0,6 + 0,4) får 0,2 mere
  //    på sit første projekt i denne og næste uge, så summen bliver 1,2
  for (const allocation of allocations) {
    if (allocation.employeeId === extraEmployeeIds[1] && allocation.projectId === activeProjects[1]) {
      const week = (allocation.weekStart as Date).getTime();
      if (week === thisMonday.getTime() || week === thisMonday.getTime() + WEEK) allocation.fte = 0.8;
    }
  }

  // 4. Kun allokeringer inden for projektets periode: fra ugen, hvor første pakke starter, til ugen, hvor sidste slutter.
  //    Ingen kan arbejde på et projekt, der ikke er startet eller er slut.
  const periods = new Map(
    PROJECTS.map((p) => [
      projectIds.get(p.name)!,
      {
        first: mondayOf(daysFromToday(Math.min(...p.packages.map((pkg) => pkg.start)))).getTime(),
        last: mondayOf(daysFromToday(Math.max(...p.packages.map((pkg) => pkg.end)))).getTime(),
      },
    ]),
  );
  const withinPeriod = allocations.filter((a) => {
    const period = periods.get(a.projectId);
    // Intern tid og Ferie har ingen periode og kan altid allokeres (#44)
    if (!period) return true;
    const week = (a.weekStart as Date).getTime();
    return week >= period.first && week <= period.last;
  });

  await prisma.allocation.createMany({ data: withinPeriod });

  console.log(
    `Seed færdig: ${titles.size} titler, ${employees.size + extraEmployeeIds.length} medarbejdere, ${PROJECTS.length} projekter, ` +
      `${PROJECTS.reduce((sum, p) => sum + p.packages.length, 0)} arbejdspakker, ${counts.timeEntries} tidsregistreringer, ` +
      `${counts.remainingUpdates} resterende-opdateringer, ${withinPeriod.length} allokeringer`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
