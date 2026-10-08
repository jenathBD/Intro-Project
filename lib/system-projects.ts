// Referenceprojekter oprettet af migrationen project_kind (#44). Faste id'er, så seed kan bevare dem.

/** Internt projekt uden arbejdspakker til lavperioder */
export const INTERNAL_TIME_PROJECT_ID = 'intern-tid';

/** Fraværsprojekt til ferie og helligdage (1 dag = 0,2 FTE) */
export const ABSENCE_PROJECT_ID = 'ferie';

export const SYSTEM_PROJECT_IDS = [INTERNAL_TIME_PROJECT_ID, ABSENCE_PROJECT_ID];
