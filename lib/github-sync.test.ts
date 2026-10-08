// Tests af importen fra GitHub (#24). Kør med: npm test
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { categoryFromLabels, type ExistingState, type GithubIssue, isEpic, parseGithubRepo, planGithubSync } from './github-sync';

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
    existing.workPackages.set(2, { hasResponsible: false });
    const plan = planGithubSync(
      [issue(1, { state: 'closed', stateReason: 'not_planned' }), issue(2, { state: 'closed', stateReason: 'not_planned' })],
      existing,
    );
    assert.deepEqual(plan.skipped, [1]);
    assert.deepEqual(plan.updatePackages.map((p) => [p.number, p.githubState]), [[2, 'closed']]);
  });

  test('eksisterende pakker får kun titel, åben/lukket og PR\'er fra GitHub', () => {
    const existing = nothing();
    existing.workPackages.set(45, { hasResponsible: true });
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
    existing.workPackages.set(1, { hasResponsible: true });
    existing.workPackages.set(2, { hasResponsible: false });
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
