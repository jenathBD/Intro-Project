// Tests af bemandingstjekket (#45). Kør med: npm test
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { checkStaffing, type StaffingPackage } from './staffing';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const thisWeek = new Date('2026-10-05T00:00:00Z'); // mandag uge 41
const week = (offset: number) => new Date(thisWeek.getTime() + offset * WEEK);

/** Samme FTE i ugerne fra og med 0 til og med lastWeek */
const fte = (perWeek: number, lastWeek: number) =>
  new Map(Array.from({ length: lastWeek + 1 }, (_, i) => [week(i).getTime(), perWeek]));

const pkg = (name: string, deadline: number, remainingHours: number, done = false): StaffingPackage => ({
  name,
  deadlineWeek: week(deadline),
  remainingHours,
  done,
});

describe('checkStaffing', () => {
  test('0,5 FTE i 4 uger = 74 t: 70 t arbejde tilbage er fuldt bemandet', () => {
    const result = checkStaffing(thisWeek, [pkg('A', 3, 70)], fte(0.5, 3));
    assert.equal(result.firstShortfall, null);
    assert.equal(result.milestones[0].plannedHours, 74);
  });

  test('0,5 FTE i 4 uger = 74 t: 120 t arbejde tilbage → 46 t ikke dækket, mangler ca. 0,4 FTE', () => {
    const { firstShortfall } = checkStaffing(thisWeek, [pkg('A', 3, 120)], fte(0.5, 3));
    assert.ok(firstShortfall);
    assert.equal(firstShortfall.requiredHours, 120);
    assert.equal(firstShortfall.plannedHours, 74);
    assert.equal(firstShortfall.shortfallHours, 46);
    // 46 t / 4 uger / 37 t = 0,31 → rundes op til 0,4, så det er nok (0,3 ville kun give 44,4 t)
    assert.equal(firstShortfall.extraFtePerWeek, 0.4);
  });

  test('deadlines summeres: senere deadlines skal også dække arbejdet fra de tidligere', () => {
    // A: 60 t til uge 1 (2 uger), B: 40 t til uge 3 (4 uger), 0,5 FTE = 18,5 t pr. uge
    const { milestones, firstShortfall } = checkStaffing(thisWeek, [pkg('A', 1, 60), pkg('B', 3, 40)], fte(0.5, 3));
    assert.deepEqual(
      milestones.map((m) => [m.packages, m.requiredHours, m.plannedHours, m.shortfallHours]),
      [
        [['A'], 60, 37, 23],
        [['B'], 100, 74, 26],
      ],
    );
    assert.deepEqual(firstShortfall?.packages, ['A']);
  });

  test('en tidlig mangel kan være dækket senere, men den første mangel er projektets problem', () => {
    // A: 50 t til uge 0 med 1,0 FTE (37 t) mangler 13 t; B: 10 t til uge 3 → 60 t mod 148 t er fint
    const { milestones, firstShortfall } = checkStaffing(thisWeek, [pkg('A', 0, 50), pkg('B', 3, 10)], fte(1, 3));
    assert.equal(milestones[1].shortfallHours, 0);
    assert.equal(firstShortfall?.shortfallHours, 13);
  });

  test('forsinkede pakker (deadline før denne uge) skal laves nu', () => {
    const { firstShortfall } = checkStaffing(thisWeek, [pkg('Forsinket', -2, 20)], new Map());
    assert.ok(firstShortfall);
    assert.equal(firstShortfall.deadlineWeek.getTime(), thisWeek.getTime());
    assert.equal(firstShortfall.overdue, true);
    assert.equal(firstShortfall.shortfallHours, 20);
  });

  test('afsluttede pakker og pakker uden resterende tæller ikke med', () => {
    const result = checkStaffing(thisWeek, [pkg('Færdig', 2, 30, true), pkg('Tom', 2, 0)], new Map());
    assert.deepEqual(result.milestones, []);
    assert.equal(result.firstShortfall, null);
  });

  test('kan afgive: 1,0 FTE i 4 uger = 148 t, 74 t arbejde → 0,5 FTE til overs', () => {
    const result = checkStaffing(thisWeek, [pkg('A', 3, 74)], fte(1, 3));
    assert.equal(result.spareFtePerWeek, 0.5);
  });

  test('kan afgive bestemmes af den strammeste deadline og rundes ned', () => {
    // 1,0 FTE: uge 0 har 37 t og kræver 30 t (0,18 til overs → 0,1); uge 3 har 148 t og kræver 40 t (0,7 til overs)
    const result = checkStaffing(thisWeek, [pkg('A', 0, 30), pkg('B', 3, 10)], fte(1, 3));
    assert.deepEqual(result.milestones.map((m) => m.spareFtePerWeek), [0.1, 0.7]);
    assert.equal(result.spareFtePerWeek, 0.1);
  });

  test('et projekt, der mangler folk, kan ikke afgive noget', () => {
    const result = checkStaffing(thisWeek, [pkg('A', 3, 120)], fte(0.5, 3));
    assert.equal(result.spareFtePerWeek, 0);
  });

  test('ingen kommatalsfejl: 0,1 FTE i 3 uger = 11,1 t', () => {
    const { milestones } = checkStaffing(thisWeek, [pkg('A', 2, 11.1)], fte(0.1, 2));
    assert.equal(milestones[0].plannedHours, 11.1);
    assert.equal(milestones[0].shortfallHours, 0);
  });
});
