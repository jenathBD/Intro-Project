// Import fra GitHub (#24): hvad skal oprettes og opdateres i dashboardet ud fra repoets issues?
// Ren funktion uden database og netværk, så den kan testes (lib/github-sync.test.ts).
//
// Regler:
// - Et epic er et issue med labelen "epic" eller med sub-issues. Det bliver til et Epic, ikke en arbejdspakke.
// - Alle andre issues bliver til arbejdspakker, så der kan registreres tid på dem.
// - GitHub bestemmer titel, åben/lukket og PR'er. De opdateres ved hver sync.
// - Dashboardet bestemmer resten (estimat, datoer, kategori, epic, status). Det sættes kun, når pakken oprettes.
//   Undtagelse (#70): estimat og datoer fra projekttavlen udfyldes også senere, men kun hvor dashboardet er tomt.
// - Den ansvarlige foreslås ud fra issuets assignee, men kun hvis pakken ikke allerede har en ansvarlig.
// - Issues lukket som "not planned" oprettes ikke. Findes de allerede, opdateres de som alle andre.

import type { WorkPackageStatus } from '@/app/generated/prisma/client';

export type GithubPullRequest = { number: number; title: string; state: 'open' | 'closed' | 'merged'; url: string };

export type GithubIssue = {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  /** completed | not_planned | reopened | duplicate. null for åbne issues. */
  stateReason: string | null;
  labels: string[];
  assignees: string[];
  parentNumber: number | null;
  subIssueCount: number;
  pullRequests: GithubPullRequest[];
  /** Estimat og datoer fra projekttavlen (#70) */
  board: BoardValues;
};

/** Datoer som "YYYY-MM-DD" */
export type BoardValues = { estimate: number | null; startDate: string | null; endDate: string | null };

/** Felterne på projekttavlen, små bogstaver. GitHubs standardnavne; #51 skriver til dem, #70 læser fra dem. */
export const BOARD_FIELD_NAMES = {
  estimate: ['estimate'],
  start: ['start date', 'start'],
  end: ['target date', 'end date', 'slutdato'],
} as const;

/** Tavlens værdier ud fra issuets feltværdier. Står issuet på flere tavler, bruges den første værdi. */
export function boardValues(values: { field: string; number?: number | null; date?: string | null }[]): BoardValues {
  const find = (names: readonly string[], key: 'number' | 'date') =>
    values.find((v) => names.includes(v.field.toLowerCase()) && v[key] != null)?.[key] ?? null;
  return {
    estimate: find(BOARD_FIELD_NAMES.estimate, 'number') as number | null,
    startDate: find(BOARD_FIELD_NAMES.start, 'date') as string | null,
    endDate: find(BOARD_FIELD_NAMES.end, 'date') as string | null,
  };
}

/** Labels som "kategori: Udvikling" sætter kategorien på nye pakker. #51 skriver dem til GitHub. */
export const CATEGORY_LABEL_PREFIX = 'kategori:';

/** Kategorien, nye pakker får, når issuet ikke har en kategori-label */
export const DEFAULT_CATEGORY = 'Udvikling';

/** "Epic: Allokering" → "Allokering". Præfikset er overflødigt, når det står som epic i dashboardet. */
export const epicName = (title: string) => title.replace(/^epic\s*[:\-–]\s*/i, '').trim() || title;

export const isEpic = (issue: GithubIssue) =>
  issue.subIssueCount > 0 || issue.labels.some((label) => label.toLowerCase() === 'epic');

export function categoryFromLabels(labels: string[]): string | null {
  const label = labels.find((l) => l.toLowerCase().startsWith(CATEGORY_LABEL_PREFIX));
  return label ? label.slice(CATEGORY_LABEL_PREFIX.length).trim() || null : null;
}

export type ExistingState = {
  /** Epics i projektet, der allerede er koblet til et issue */
  epicNumbers: Set<number>;
  /** Arbejdspakker koblet til et issue: nummer → hvilke felter har pakken allerede i dashboardet? */
  workPackages: Map<number, ExistingPackage>;
  /** Medarbejdere med GitHub-login (små bogstaver) → medarbejder-id */
  employeeIdByLogin: Map<string, string>;
};

export type ExistingPackage = {
  hasResponsible: boolean;
  hasEstimate: boolean;
  hasStartDate: boolean;
  hasEndDate: boolean;
  /** Har pakken en vurdering af resterende? */
  hasRemaining: boolean;
};

/** Estimat og datoer fra tavlen. remainingHours er den første vurdering af resterende, når estimatet sættes. */
type FromBoard = { estimateHours?: number; startDate?: string; endDate?: string; remainingHours?: number };

export type PackageCreate = {
  number: number;
  name: string;
  description: string | null;
  status: WorkPackageStatus;
  categoryName: string;
  epicNumber: number | null;
  responsibleId: string | null;
  githubState: 'open' | 'closed';
  pullRequests: GithubPullRequest[];
} & FromBoard;

export type PackageUpdate = {
  number: number;
  name: string;
  githubState: 'open' | 'closed';
  pullRequests: GithubPullRequest[];
  /** Kun sat, når pakken mangler en ansvarlig, og issuets assignee er en kendt medarbejder */
  responsibleId?: string;
} & FromBoard;

// Tavlens værdier, der må bruges: kun felter, der er tomme i dashboardet. Får pakken et estimat og har den
// ingen vurdering af resterende, starter resterende som estimatet (0 for lukkede issues), som når en pakke oprettes.
function fromBoard(issue: GithubIssue, current: Omit<ExistingPackage, 'hasResponsible'>): FromBoard {
  const { estimate, startDate, endDate } = issue.board;
  const result: FromBoard = {};
  if (estimate !== null && !current.hasEstimate) {
    result.estimateHours = estimate;
    if (!current.hasRemaining) result.remainingHours = issue.state === 'closed' ? 0 : estimate;
  }
  if (startDate !== null && !current.hasStartDate) result.startDate = startDate;
  if (endDate !== null && !current.hasEndDate) result.endDate = endDate;
  return result;
}

const NOTHING_IN_DASHBOARD = { hasEstimate: false, hasStartDate: false, hasEndDate: false, hasRemaining: false };

export type SyncPlan = {
  /** Epics oprettes eller får titlen fra GitHub */
  epics: { number: number; name: string; isNew: boolean }[];
  createPackages: PackageCreate[];
  updatePackages: PackageUpdate[];
  /** Issues lukket som "not planned", der ikke oprettes */
  skipped: number[];
};

export function planGithubSync(issues: GithubIssue[], existing: ExistingState): SyncPlan {
  const epicIssues = issues.filter(isEpic);
  const epicNumbers = new Set(epicIssues.map((issue) => issue.number));
  const plan: SyncPlan = {
    epics: epicIssues.map((issue) => ({ number: issue.number, name: epicName(issue.title), isNew: !existing.epicNumbers.has(issue.number) })),
    createPackages: [],
    updatePackages: [],
    skipped: [],
  };

  for (const issue of issues) {
    if (epicNumbers.has(issue.number)) continue;

    // Første assignee, der er en kendt medarbejder
    const responsibleId =
      issue.assignees.map((login) => existing.employeeIdByLogin.get(login.toLowerCase())).find(Boolean) ?? null;
    const current = existing.workPackages.get(issue.number);

    if (current) {
      plan.updatePackages.push({
        number: issue.number,
        name: issue.title,
        githubState: issue.state,
        pullRequests: issue.pullRequests,
        ...(!current.hasResponsible && responsibleId ? { responsibleId } : {}),
        ...fromBoard(issue, current),
      });
    } else if (issue.state === 'closed' && issue.stateReason === 'not_planned') {
      plan.skipped.push(issue.number);
    } else {
      plan.createPackages.push({
        number: issue.number,
        name: issue.title,
        description: issue.body.trim() || null,
        // Lukkede issues er færdige. Åbne starter som "Ikke startet"; status styres derefter i dashboardet.
        status: issue.state === 'closed' ? 'done' : 'notStarted',
        categoryName: categoryFromLabels(issue.labels) ?? DEFAULT_CATEGORY,
        // Kun når forælderen er et epic i samme repo
        epicNumber: issue.parentNumber !== null && epicNumbers.has(issue.parentNumber) ? issue.parentNumber : null,
        responsibleId,
        githubState: issue.state,
        pullRequests: issue.pullRequests,
        ...fromBoard(issue, NOTHING_IN_DASHBOARD),
      });
    }
  }

  return plan;
}

/**
 * "owner/name" fra det, brugeren skriver: "owner/name", "github.com/owner/name" eller en URL (evt. med .git).
 * null, hvis det ikke ligner et repo.
 */
export function parseGithubRepo(value: string): string | null {
  const match = value
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')
    .match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/);
  return match ? `${match[1]}/${match[2]}` : null;
}

// ---------------------------------------------------------------------------
// Skrivning til GitHub (#51): dashboardet er kilden til kategori og epic.
// ---------------------------------------------------------------------------

export const categoryLabel = (categoryName: string) => `${CATEGORY_LABEL_PREFIX} ${categoryName}`;

export type IssueChanges = {
  addLabels: string[];
  removeLabels: string[];
  /** Ny forælder (epic), eller fjern den nuværende. null = ingen ændring. */
  parent: { set: number } | { remove: number } | null;
};

/**
 * @param current issuets labels og forælder på GitHub
 * @param categoryName pakkens kategori i dashboardet
 * @param epicNumber issuenummeret på pakkens epic. null = intet epic, eller et epic uden issue
 * @param projectEpicNumbers projektets epics med issue. Kun dem fjernes som forælder, så en forælder,
 *   dashboardet ikke kender, får lov at blive.
 */
export function planIssueChanges(
  current: { labels: string[]; parentNumber: number | null },
  categoryName: string,
  epicNumber: number | null,
  projectEpicNumbers: Set<number>,
): IssueChanges {
  const wanted = categoryLabel(categoryName);
  const isCategoryLabel = (label: string) => label.toLowerCase().startsWith(CATEGORY_LABEL_PREFIX);
  const hasWanted = current.labels.some((label) => label.toLowerCase() === wanted.toLowerCase());

  let parent: IssueChanges['parent'] = null;
  if (epicNumber !== null && current.parentNumber !== epicNumber) parent = { set: epicNumber };
  else if (epicNumber === null && current.parentNumber !== null && projectEpicNumbers.has(current.parentNumber)) {
    parent = { remove: current.parentNumber };
  }

  return {
    addLabels: hasWanted ? [] : [wanted],
    removeLabels: current.labels.filter((label) => isCategoryLabel(label) && label.toLowerCase() !== wanted.toLowerCase()),
    parent,
  };
}
