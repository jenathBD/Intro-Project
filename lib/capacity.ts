// Belægning i FTE (#16, #17). 1,0 FTE er fuld tid (37 t). En medarbejder på deltid har mindre end 1,0 at fordele.
// Ren funktion, så ugegridet og forsiden (#20) bruger samme regel.

/** Timer pr. uge, som 1,0 FTE svarer til */
export const FULL_TIME_HOURS = 37;

/** Under denne andel af sin kapacitet har en medarbejder ledig tid */
export const UNDERBOOKED_BELOW = 0.8;

/** Medarbejderens kapacitet i FTE, afrundet til 0,1: 37 t = 1,0 og 30 t = 0,8 */
export const capacityFte = (weeklyCapacity: number) => Math.round((weeklyCapacity / FULL_TIME_HOURS) * 10) / 10;

export type BookingLevel = 'over' | 'under' | 'ok';

/** fte er den samlede allokering i en uge; capacity er medarbejderens kapacitet i FTE */
export function bookingLevel(fte: number, capacity: number): BookingLevel {
  if (fte > capacity) return 'over';
  if (fte < capacity * UNDERBOOKED_BELOW) return 'under';
  return 'ok';
}
