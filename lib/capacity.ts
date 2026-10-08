// Belægning i FTE (#16). Hver medarbejder har 1,0 FTE pr. uge at fordele på tværs af projekterne.
// Ren funktion, så ugegridet og forsiden (#20) bruger samme regel.

/** Fuld tid. Over dette er en medarbejder overbooket. */
export const FULL_TIME = 1;

/** Under denne FTE regnes en uge som underbooket */
export const UNDERBOOKED_BELOW = 0.8;

export type BookingLevel = 'over' | 'under' | 'ok';

export function bookingLevel(fte: number): BookingLevel {
  if (fte > FULL_TIME) return 'over';
  if (fte < UNDERBOOKED_BELOW) return 'under';
  return 'ok';
}
