// Bemandingstjek (#45): har et kundeprojekt folk nok til at lave det resterende arbejde inden arbejdspakkernes deadlines?
// Ren funktion uden database, så den kan testes (lib/staffing.test.ts).
//
// For hver deadline (ugen, en arbejdspakke slutter i):
//   arbejde tilbage = resterende timer på åbne pakker med deadline til og med den uge
//   bemandet        = allokerede timer på projektet fra denne uge til og med den uge (FTE × 37 t)
//   ikke dækket     = arbejde tilbage − bemandet (hvis positivt)
//   mangler (FTE)   = ikke dækket fordelt på ugerne frem til deadline, i FTE
// Antagelse: de allokerede arbejder på pakkerne i rækkefølge efter deadline.

import { FULL_TIME_HOURS } from '@/lib/capacity';

const WEEK = 7 * 24 * 60 * 60 * 1000;

export type StaffingPackage = {
  name: string;
  /** Mandag i ugen, pakken slutter */
  deadlineWeek: Date;
  remainingHours: number;
  done: boolean;
};

export type Milestone = {
  /** Mandag i deadline-ugen. Pakker med deadline før denne uge (forsinkede) lægges i denne uge. */
  deadlineWeek: Date;
  /** Pakker med deadline i netop denne uge */
  packages: string[];
  /** Mindst én pakke havde deadline før denne uge */
  overdue: boolean;
  /** Antal uger fra denne uge til og med deadline-ugen */
  weeks: number;
  /** Arbejde tilbage, summeret til og med deadline */
  requiredHours: number;
  /** Bemandet: allokerede timer fra denne uge til og med deadline */
  plannedHours: number;
  /** Ikke dækket: arbejde, der ikke er folk til */
  shortfallHours: number;
  /** Mangler: ca. ekstra FTE pr. uge frem til deadline, rundet op, så det er nok */
  extraFtePerWeek: number;
  /** Kan afgive: ca. FTE pr. uge, der er til overs frem til deadline, rundet ned, så det er sikkert */
  spareFtePerWeek: number;
};

export type StaffingResult = {
  milestones: Milestone[];
  /** Den første deadline, hvor arbejdet ikke er dækket. null = fuldt bemandet */
  firstShortfall: Milestone | null;
  /** Det projektet kan afgive uden at komme bagud: det mindste overskud over alle deadlines. 0 ved mangel. */
  spareFtePerWeek: number;
};

/**
 * @param thisWeek mandag i den aktuelle uge
 * @param packages projektets arbejdspakker
 * @param fteByWeek samlet allokeret FTE på projektet pr. uge (nøgle: mandagens getTime())
 */
export function checkStaffing(thisWeek: Date, packages: StaffingPackage[], fteByWeek: Map<number, number>): StaffingResult {
  const start = thisWeek.getTime();
  const open = packages.filter((p) => !p.done && p.remainingHours > 0);

  // Gruppér efter deadline-uge. Forsinkede pakker (deadline før denne uge) skal laves nu.
  const byWeek = new Map<number, { packages: string[]; hours: number; overdue: boolean }>();
  for (const pkg of open) {
    const week = Math.max(pkg.deadlineWeek.getTime(), start);
    const group = byWeek.get(week) ?? { packages: [], hours: 0, overdue: false };
    group.packages.push(pkg.name);
    group.hours += pkg.remainingHours;
    group.overdue ||= pkg.deadlineWeek.getTime() < start;
    byWeek.set(week, group);
  }

  const milestones: Milestone[] = [];
  let requiredHours = 0;
  for (const week of [...byWeek.keys()].sort((a, b) => a - b)) {
    const group = byWeek.get(week)!;
    requiredHours += group.hours;

    // Bemandet: alle uger fra denne uge til og med deadline-ugen
    const weeks = Math.round((week - start) / WEEK) + 1;
    let plannedHours = 0;
    for (let i = 0; i < weeks; i++) plannedHours += (fteByWeek.get(start + i * WEEK) ?? 0) * FULL_TIME_HOURS;

    const balancePerWeek = (plannedHours - requiredHours) / weeks / FULL_TIME_HOURS;
    milestones.push({
      deadlineWeek: new Date(week),
      packages: group.packages,
      overdue: group.overdue,
      weeks,
      requiredHours: round(requiredHours),
      plannedHours: round(plannedHours),
      shortfallHours: round(Math.max(0, requiredHours - plannedHours)),
      // Op ved mangel (ellers dækker det ikke), ned ved overskud (ellers kommer man bagud)
      extraFtePerWeek: balancePerWeek < 0 ? Math.ceil(round(-balancePerWeek * 10)) / 10 : 0,
      spareFtePerWeek: balancePerWeek > 0 ? Math.floor(round(balancePerWeek * 10)) / 10 : 0,
    });
  }

  const firstShortfall = milestones.find((m) => m.shortfallHours > 0) ?? null;
  // Den strammeste deadline bestemmer, hvad der kan afgives
  const spareFtePerWeek = firstShortfall || milestones.length === 0 ? 0 : Math.min(...milestones.map((m) => m.spareFtePerWeek));

  return { milestones, firstShortfall, spareFtePerWeek };
}

// Én decimal, så summer af fx 0,1 FTE × 37 t ikke giver 3,7000000000000006
const round = (value: number) => Math.round(value * 10) / 10;
