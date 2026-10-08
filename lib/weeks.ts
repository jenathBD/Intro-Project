// Uger mandag–søndag med ISO-ugenumre, som man bruger i Danmark.
// Alle datoer er UTC-midnat, samme format som @db.Date (fx Allocation.weekStart), så de kan sammenlignes direkte.

const DAY = 24 * 60 * 60 * 1000;

/** Mandag i den uge, date ligger i */
export function mondayOf(date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY);
}

export const addWeeks = (monday: Date, weeks: number) => new Date(monday.getTime() + weeks * 7 * DAY);

/** ISO 8601-ugenummer: uge 1 er den uge, årets første torsdag ligger i */
export function isoWeek(date: Date) {
  const thursday = new Date(mondayOf(date).getTime() + 3 * DAY);
  const firstThursday = mondayOf(new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4))).getTime() + 3 * DAY;
  return 1 + Math.round((thursday.getTime() - firstThursday) / (7 * DAY));
}

/** Til URL'en: "2026-10-05" */
export const toWeekParam = (monday: Date) => monday.toISOString().slice(0, 10);

/** Fra URL'en. Ugyldige værdier giver null; en dato midt i en uge giver ugens mandag. */
export function parseWeekParam(value: string | string[] | undefined) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : mondayOf(date);
}
