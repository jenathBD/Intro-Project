// Tests af importen fra GitHub (#24). Kør med: npm test
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  boardValues,
  categoryFromLabels,
  type ExistingPackage,
  type ExistingState,
  type GithubIssue,
  isEpic,
  parseGithubRepo,
  planGithubSync,
  planIssueChanges,
} from './github-sync';

const issue = (number: number, overrides: Partial<GithubIssue> = {}): GithubIssue => ({
  number,
  title: `Issue ${number}`,
  body: '',
  state: 'open',
  stateReason: null,
  labels: [],
  assignees: [],
  parentNumber: null,
  subIssueCount: 0,
  pullRequests: [],
  board: { estimate: null, startDate: null, endDate: null },
  ...overrides,
});

/** En eksisterende pakke, der som standard har alt udfyldt i dashboardet */
const wp = (overrides: Partial<ExistingPackage> = {}): ExistingPackage => ({
  hasResponsible: true,
  hasEstimate: true,
  hasStartDate: true,
  hasEndDate: true,
  hasRemaining: true,
  ...overrides,
});

const nothing = (): ExistingState => ({ epicNumbers: new Set(), workPackages: new Map(), employeeIdByLogin: new Map() });

describe('isEpic', () => {
  test('labelen "epic" eller sub-issues gør et issue til et epic', () => {
    assert.equal(isEpic(issue(1, { labels: ['Epic'] })), true);
    assert.equal(isEpic(issue(2, { subIssueCount: 3 })), true);
    assert.equal(isEpic(issue(3, { labels: ['feature'] })), false);
  });
});

describe('categoryFromLabels', () => {
  test('læser "kategori: Navn" uanset store og små bogstaver', () => {
    assert.equal(categoryFromLabels(['feature', 'Kategori: Analyse']), 'Analyse');
    assert.equal(categoryFromLabels(['feature']), null);
    assert.equal(categoryFromLabels(['kategori:']), null);
  });
});

describe('planGithubSync', () => {
  test('epics bliver til epics, og deres sub-issues til pakker under dem', () => {
    const plan = planGithubSync(
      [issue(4, { title: 'Epic: Allokering', labels: ['epic'], subIssueCount: 1 }), issue(45, { parentNumber: 4 })],
      nothing(),
    );
    // "Epic:" fjernes fra navnet
    assert.deepEqual(plan.epics, [{ number: 4, name: 'Allokering', isNew: true }]);
    assert.deepEqual(plan.createPackages.map((p) => [p.number, p.epicNumber]), [[45, 4]]);
  });

  test('en forælder, der ikke er et epic, giver ingen epic-kobling', () => {
    const plan = planGithubSync([issue(10, { parentNumber: 99 })], nothing());
    assert.equal(plan.createPackages[0].epicNumber, null);
  });

  test('nye pakker: lukket = afsluttet, kategori fra label ellers Udvikling, beskrivelse fra brødteksten', () => {
    const plan = planGithubSync(
      [
        issue(1, { state: 'closed', stateReason: 'completed', labels: ['kategori: Test'], body: '  Tjek login  ' }),
        issue(2),
      ],
      nothing(),
    );
    assert.deepEqual(
      plan.createPackages.map((p) => [p.number, p.status, p.categoryName, p.description]),
      [
        [1, 'done', 'Test', 'Tjek login'],
        [2, 'notStarted', 'Udvikling', null],
      ],
    );
  });

  test('issues lukket som "not planned" oprettes ikke, men findes de, opdateres de', () => {
    const existing = nothing();
    existing.workPackages.set(2, wp({ hasResponsible: false }));
    const plan = planGithubSync(
      [issue(1, { state: 'closed', stateReason: 'not_planned' }), issue(2, { state: 'closed', stateReason: 'not_planned' })],
      existing,
    );
    assert.deepEqual(plan.skipped, [1]);
    assert.deepEqual(plan.updatePackages.map((p) => [p.number, p.githubState]), [[2, 'closed']]);
  });

  test('eksisterende pakker får kun titel, åben/lukket og PR\'er fra GitHub', () => {
    const existing = nothing();
    existing.workPackages.set(45, wp());
    const pr = { number: 52, title: 'Bemandingstjek', state: 'merged' as const, url: 'https://github.com/o/r/pull/52' };
    const plan = planGithubSync([issue(45, { title: 'Ny titel', state: 'closed', stateReason: 'completed', pullRequests: [pr] })], existing);
    assert.deepEqual(plan.updatePackages, [{ number: 45, name: 'Ny titel', githubState: 'closed', pullRequests: [pr] }]);
    assert.deepEqual(plan.createPackages, []);
  });

  test('den ansvarlige foreslås ud fra den første kendte assignee', () => {
    const existing = nothing();
    existing.employeeIdByLogin.set('jenathbd', 'emp-1');
    const plan = planGithubSync([issue(1, { assignees: ['ukendt', 'JenathBD'] }), issue(2, { assignees: ['ukendt'] })], existing);
    assert.deepEqual(plan.createPackages.map((p) => p.responsibleId), ['emp-1', null]);
  });

  test('en eksisterende ansvarlig overskrives ikke', () => {
    const existing = nothing();
    existing.employeeIdByLogin.set('jenathbd', 'emp-1');
    existing.workPackages.set(1, wp());
    existing.workPackages.set(2, wp({ hasResponsible: false }));
    const plan = planGithubSync([issue(1, { assignees: ['jenathbd'] }), issue(2, { assignees: ['jenathbd'] })], existing);
    assert.deepEqual(plan.updatePackages.map((p) => p.responsibleId), [undefined, 'emp-1']);
  });

  test('kendte epics er ikke nye', () => {
    const existing = nothing();
    existing.epicNumbers.add(4);
    const plan = planGithubSync([issue(4, { labels: ['epic'] })], existing);
    assert.deepEqual(plan.epics, [{ number: 4, name: 'Issue 4', isNew: false }]);
  });
});

describe('parseGithubRepo', () => {
  test('accepterer owner/name, github.com-adresser og .git', () => {
    assert.equal(parseGithubRepo('jenathBD/Intro-Project'), 'jenathBD/Intro-Project');
    assert.equal(parseGithubRepo(' https://github.com/jenathBD/Intro-Project/ '), 'jenathBD/Intro-Project');
    assert.equal(parseGithubRepo('github.com/jenathBD/Intro-Project.git'), 'jenathBD/Intro-Project');
  });

  test('afviser det, der ikke er et repo', () => {
    assert.equal(parseGithubRepo('Intro-Project'), null);
    assert.equal(parseGithubRepo('https://github.com/jenathBD/Intro-Project/issues/24'), null);
    assert.equal(parseGithubRepo(''), null);
  });
});

describe('planIssueChanges', () => {
  const epics = new Set([4, 6]);

  test('tilføjer kategori-labelen og fjerner den gamle', () => {
    const changes = planIssueChanges({ labels: ['feature', 'kategori: Analyse'], parentNumber: 4 }, 'Udvikling', 4, epics);
    assert.deepEqual(changes, { addLabels: ['kategori: Udvikling'], removeLabels: ['kategori: Analyse'], parent: null });
  });

  test('gør intet, når labels og forælder allerede passer (også med andre store og små bogstaver)', () => {
    const changes = planIssueChanges({ labels: ['Kategori: udvikling'], parentNumber: 4 }, 'Udvikling', 4, epics);
    assert.deepEqual(changes, { addLabels: [], removeLabels: [], parent: null });
  });

  test('flytter issuet til et andet epic', () => {
    assert.deepEqual(planIssueChanges({ labels: [], parentNumber: 4 }, 'Test', 6, epics).parent, { set: 6 });
    assert.deepEqual(planIssueChanges({ labels: [], parentNumber: null }, 'Test', 6, epics).parent, { set: 6 });
  });

  test('fjerner kun en forælder, som er et af projektets epics', () => {
    assert.deepEqual(planIssueChanges({ labels: [], parentNumber: 4 }, 'Test', null, epics).parent, { remove: 4 });
    assert.equal(planIssueChanges({ labels: [], parentNumber: 99 }, 'Test', null, epics).parent, null);
  });
});

describe('estimat og datoer fra tavlen (#70)', () => {
  const board = { estimate: 8, startDate: '2026-10-13', endDate: '2026-10-19' };

  test('boardValues finder felterne uanset store og små bogstaver og springer tomme over', () => {
    assert.deepEqual(
      boardValues([
        { field: 'Estimate', number: null },
        { field: 'Estimate', number: 8 },
        { field: 'Start date', date: '2026-10-13' },
        { field: 'Target Date', date: '2026-10-19' },
        { field: 'Status' },
      ]),
      board,
    );
  });

  test('nye pakker får estimat, datoer og resterende fra tavlen', () => {
    const plan = planGithubSync([issue(1, { board }), issue(2, { board, state: 'closed', stateReason: 'completed' })], nothing());
    assert.deepEqual(
      plan.createPackages.map((p) => [p.estimateHours, p.startDate, p.endDate, p.remainingHours]),
      [
        [8, '2026-10-13', '2026-10-19', 8],
        // Lukket: intet tilbage
        [8, '2026-10-13', '2026-10-19', 0],
      ],
    );
  });

  test('uden værdier på tavlen sættes intet', () => {
    const plan = planGithubSync([issue(1)], nothing());
    assert.equal('estimateHours' in plan.createPackages[0], false);
  });

  test('eksisterende pakker får kun tavlens værdier i de felter, der er tomme i dashboardet', () => {
    const existing = nothing();
    existing.workPackages.set(1, wp({ hasEstimate: false, hasRemaining: false }));
    existing.workPackages.set(2, wp({ hasEndDate: false }));
    existing.workPackages.set(3, wp());
    existing.workPackages.set(4, wp({ hasEstimate: false }));
    const plan = planGithubSync([issue(1, { board }), issue(2, { board }), issue(3, { board }), issue(4, { board })], existing);
    const fromBoard = plan.updatePackages.map(({ estimateHours, startDate, endDate, remainingHours }) => ({ estimateHours, startDate, endDate, remainingHours }));
    assert.deepEqual(fromBoard, [
      { estimateHours: 8, startDate: undefined, endDate: undefined, remainingHours: 8 },
      { estimateHours: undefined, startDate: undefined, endDate: '2026-10-19', remainingHours: undefined },
      { estimateHours: undefined, startDate: undefined, endDate: undefined, remainingHours: undefined },
      // Har allerede en vurdering af resterende: den bevares
      { estimateHours: 8, startDate: undefined, endDate: undefined, remainingHours: undefined },
    ]);
  });
});
