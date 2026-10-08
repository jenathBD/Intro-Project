import 'server-only';

import { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/db';
import { categoryLabel, type GithubIssue, type GithubPullRequest, planGithubSync, planIssueChanges } from '@/lib/github-sync';
import { requireSession } from '@/lib/session';

// GitHub-integrationen: import (#24) og skrivning (#51). Tokenet ligger kun på serveren (GITHUB_TOKEN i .env)
// og sendes aldrig til browseren. Selve reglerne står i lib/github-sync.ts.

const ISSUES_QUERY = `
  query ($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      issues(first: 100, after: $after, orderBy: { field: CREATED_AT, direction: ASC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number title body state stateReason
          labels(first: 20) { nodes { name } }
          assignees(first: 5) { nodes { login } }
          parent { number }
          subIssuesSummary { total }
          closedByPullRequestsReferences(first: 10, includeClosedPrs: true) { nodes { number title state url } }
        }
      }
    }
  }`;

type IssueNode = {
  number: number;
  title: string;
  body: string;
  state: 'OPEN' | 'CLOSED';
  stateReason: string | null;
  labels: { nodes: { name: string }[] };
  assignees: { nodes: { login: string }[] };
  parent: { number: number } | null;
  subIssuesSummary: { total: number };
  closedByPullRequestsReferences: { nodes: { number: number; title: string; state: 'OPEN' | 'CLOSED' | 'MERGED'; url: string }[] };
};

type GraphqlResponse<T> = { data?: T; errors?: { type?: string; message: string }[] };

/** Fejl med en besked, der kan vises for brugeren som den er */
class GithubError extends Error {}

const NO_WRITE_ACCESS = 'Tokenet må ikke skrive til GitHub. Det skal have skriveadgang til Issues og til projekttavlen (Projects).';

// Fælles svarbehandling. HTTP-fejl bliver til beskeder, brugeren kan forstå.
async function githubFetch(token: string, url: string, init: { method: string; body?: unknown }): Promise<Response> {
  const response = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    // Altid friske data. Cachen er dashboardets egen database.
    cache: 'no-store',
  });
  if (response.status === 401) throw new GithubError('GitHub afviste tokenet. Tjek GITHUB_TOKEN i .env.');
  if (response.status === 403) throw new GithubError(NO_WRITE_ACCESS);
  return response;
}

async function githubGraphql<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<GraphqlResponse<T>> {
  const response = await githubFetch(token, 'https://api.github.com/graphql', { method: 'POST', body: { query, variables } });
  if (!response.ok) throw new GithubError(`GitHub svarede ikke som forventet (HTTP ${response.status}). Prøv igen om lidt.`);
  const result: GraphqlResponse<T> = await response.json();
  // GraphQL svarer 200, også når tokenet mangler rettigheder
  if (result.errors?.some((e) => e.type === 'FORBIDDEN' || /not accessible by|insufficient scopes/i.test(e.message))) {
    throw new GithubError(NO_WRITE_ACCESS);
  }
  return result;
}

/** REST-kald. allow: statuskoder, der ikke er fejl her, fx 404, når en label allerede er fjernet. */
async function githubRest<T = unknown>(token: string, method: string, path: string, body?: unknown, allow: number[] = []): Promise<T | null> {
  const response = await githubFetch(token, `https://api.github.com${path}`, { method, body });
  if (!response.ok && !allow.includes(response.status)) {
    throw new GithubError(`GitHub svarede ikke som forventet (HTTP ${response.status}). Prøv igen om lidt.`);
  }
  return response.ok && response.status !== 204 ? ((await response.json()) as T) : null;
}

// Opretter et issue og lægger det på de projekttavler, der er koblet til repoet (#25).
// Uden tavle kan estimat og datoer ikke skrives, men issuet oprettes stadig.
async function createIssue(token: string, repo: string, issue: { title: string; body: string; labels: string[] }) {
  const created = await githubRest<{ number: number; node_id: string }>(token, 'POST', `/repos/${repo}/issues`, issue);
  if (!created) throw new GithubError('GitHub oprettede ikke issuet. Prøv igen om lidt.');

  const [owner, name] = repo.split('/');
  const { data } = await githubGraphql<{ repository: { projectsV2: { nodes: { id: string }[] } } | null }>(
    token,
    'query ($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { projectsV2(first: 10) { nodes { id } } } }',
    { owner, name },
  );
  const projects = data?.repository?.projectsV2.nodes ?? [];
  if (projects.length > 0) {
    const mutations = projects.map(
      (project, i) => `m${i}: addProjectV2ItemById(input: { projectId: ${JSON.stringify(project.id)}, contentId: ${JSON.stringify(created.node_id)} }) { item { id } }`,
    );
    await githubGraphql(token, `mutation { ${mutations.join('\n')} }`);
  }
  return created.number;
}

// Opretter epicet som issue med labelen "epic", hvis det ikke allerede har et (#25). Returnerer issuenummeret.
async function ensureEpicIssue(token: string, repo: string, epic: { id: string; name: string; githubNumber: number | null }) {
  if (epic.githubNumber !== null) return epic.githubNumber;
  const number = await createIssue(token, repo, { title: epic.name, body: '', labels: ['epic'] });
  await prisma.epic.update({ where: { id: epic.id }, data: { githubNumber: number } });
  return number;
}

async function fetchIssues(repo: string, token: string): Promise<GithubIssue[]> {
  const [owner, name] = repo.split('/');
  const issues: GithubIssue[] = [];
  let after: string | null = null;

  do {
    type Page = { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: IssueNode[] };
    const result: GraphqlResponse<{ repository: { issues: Page } | null }> = await githubGraphql(token, ISSUES_QUERY, { owner, name, after });
    const { data, errors } = result;
    const page: Page | undefined = data?.repository?.issues;
    if (!page) {
      // Typisk NOT_FOUND: repoet findes ikke, eller tokenet har ikke adgang til det
      const notFound = errors?.some((e) => e.type === 'NOT_FOUND');
      throw new GithubError(
        notFound
          ? `Repoet ${repo} findes ikke, eller tokenet har ikke adgang til det.`
          : 'GitHub svarede ikke som forventet. Prøv igen om lidt.',
      );
    }

    for (const node of page.nodes) {
      issues.push({
        number: node.number,
        title: node.title,
        body: node.body,
        state: node.state === 'OPEN' ? 'open' : 'closed',
        stateReason: node.stateReason?.toLowerCase() ?? null,
        labels: node.labels.nodes.map((l) => l.name),
        assignees: node.assignees.nodes.map((a) => a.login),
        parentNumber: node.parent?.number ?? null,
        subIssueCount: node.subIssuesSummary.total,
        pullRequests: node.closedByPullRequestsReferences.nodes.map(
          (pr): GithubPullRequest => ({ number: pr.number, title: pr.title, state: pr.state.toLowerCase() as GithubPullRequest['state'], url: pr.url }),
        ),
      });
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);

  return issues;
}

export type SyncResult = { ok: true; message: string } | { ok: false; error: string };

// Henter projektets issues fra GitHub og opretter eller opdaterer epics og arbejdspakker.
export async function syncProjectFromGithub(projectId: string): Promise<SyncResult> {
  await requireSession();

  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: 'GitHub er ikke sat op: GITHUB_TOKEN mangler i .env.' };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      githubRepo: true,
      archivedAt: true,
      epics: { where: { githubNumber: { not: null } }, select: { githubNumber: true } },
      workPackages: { where: { githubNumber: { not: null } }, select: { githubNumber: true, responsibleId: true } },
    },
  });
  if (!project) return { ok: false, error: 'Projektet findes ikke længere. Genindlæs siden.' };
  if (project.archivedAt) return { ok: false, error: 'Projektet er arkiveret. Genaktivér det for at hente fra GitHub.' };
  if (!project.githubRepo) return { ok: false, error: 'Projektet har intet GitHub-repo. Tilføj det under "Redigér projekt".' };

  let issues: GithubIssue[];
  try {
    issues = await fetchIssues(project.githubRepo, token);
  } catch (error) {
    if (error instanceof GithubError) return { ok: false, error: error.message };
    console.error('GitHub-sync fejlede', error);
    return { ok: false, error: 'Vi kunne ikke hente fra GitHub. Prøv igen om lidt.' };
  }

  const employees = await prisma.employee.findMany({ where: { githubLogin: { not: null } }, select: { id: true, githubLogin: true } });
  const plan = planGithubSync(issues, {
    epicNumbers: new Set(project.epics.map((e) => e.githubNumber!)),
    workPackages: new Map(project.workPackages.map((wp) => [wp.githubNumber!, { hasResponsible: wp.responsibleId !== null }])),
    employeeIdByLogin: new Map(employees.map((e) => [e.githubLogin!.toLowerCase(), e.id])),
  });

  const syncedAt = new Date();
  const pullRequests = (prs: GithubPullRequest[]) => prs as unknown as Prisma.InputJsonValue;

  await prisma.$transaction(
    async (tx) => {
      // Epics først, så nye pakker kan kobles til dem
      const epicIdByNumber = new Map<number, string>();
      for (const epic of plan.epics) {
        const saved = await tx.epic.upsert({
          where: { projectId_githubNumber: { projectId, githubNumber: epic.number } },
          update: { name: epic.name },
          create: { projectId, githubNumber: epic.number, name: epic.name },
          select: { id: true },
        });
        epicIdByNumber.set(epic.number, saved.id);
      }

      // Kategorierne for nye pakker. upsert på det unikke navn, som når en kategori oprettes i formularen.
      const categoryIdByName = new Map<string, string>();
      for (const name of new Set(plan.createPackages.map((p) => p.categoryName))) {
        const category = await tx.workPackageCategory.upsert({ where: { name }, update: {}, create: { name }, select: { id: true } });
        categoryIdByName.set(name, category.id);
      }

      await tx.workPackage.createMany({
        data: plan.createPackages.map((p) => ({
          projectId,
          githubNumber: p.number,
          name: p.name,
          description: p.description,
          status: p.status,
          categoryId: categoryIdByName.get(p.categoryName)!,
          epicId: p.epicNumber === null ? null : epicIdByNumber.get(p.epicNumber)!,
          responsibleId: p.responsibleId,
          githubState: p.githubState,
          githubPullRequests: pullRequests(p.pullRequests),
          githubSyncedAt: syncedAt,
        })),
      });

      for (const p of plan.updatePackages) {
        await tx.workPackage.update({
          where: { projectId_githubNumber: { projectId, githubNumber: p.number } },
          data: {
            name: p.name,
            githubState: p.githubState,
            githubPullRequests: pullRequests(p.pullRequests),
            githubSyncedAt: syncedAt,
            ...(p.responsibleId ? { responsibleId: p.responsibleId } : {}),
          },
        });
      }

      await tx.project.update({ where: { id: projectId }, data: { githubSyncedAt: syncedAt } });
    },
    // Et stort repo giver mange opdateringer. Standarden på 5 sekunder kan være for lidt.
    { timeout: 30_000 },
  );

  const newEpics = plan.epics.filter((e) => e.isNew).length;
  const parts = [
    `${plan.createPackages.length} nye arbejdspakker`,
    `${plan.updatePackages.length} opdateret`,
    newEpics > 0 && `${newEpics} nye epics`,
  ].filter(Boolean);
  return { ok: true, message: `Hentet fra GitHub: ${parts.join(', ')}.` };
}

// ---------------------------------------------------------------------------
// Skrivning til GitHub (#51)
// ---------------------------------------------------------------------------

/** Felterne på projekttavlen. Navnene er GitHubs standard; mangler et felt på tavlen, springes det over. */
const BOARD_FIELDS = {
  estimate: { names: ['estimate'], dataType: 'NUMBER' },
  start: { names: ['start date', 'start'], dataType: 'DATE' },
  end: { names: ['target date', 'end date', 'slutdato'], dataType: 'DATE' },
} as const;

const ISSUE_FOR_PUSH_QUERY = `
  query ($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      issue(number: $number) {
        databaseId
        labels(first: 50) { nodes { name } }
        parent { number }
        projectItems(first: 10) {
          nodes {
            id
            project { id fields(first: 50) { nodes { ... on ProjectV2FieldCommon { id name dataType } } } }
          }
        }
      }
    }
  }`;

type IssueForPush = {
  databaseId: number;
  labels: { nodes: { name: string }[] };
  parent: { number: number } | null;
  projectItems: {
    nodes: { id: string; project: { id: string; fields: { nodes: { id?: string; name?: string; dataType?: string }[] } } }[];
  };
};

export type PushResult = { ok: true } | { ok: false; error: string };

// Skriver arbejdspakkens estimat, datoer, kategori og epic til dens issue og projekttavlen.
// Gør intet, hvis pakken ikke har et issue, eller GitHub ikke er sat op.
export async function pushWorkPackageToGithub(workPackageId: string): Promise<PushResult> {
  await requireSession();

  const wp = await prisma.workPackage.findUnique({
    where: { id: workPackageId },
    select: {
      githubNumber: true,
      estimateHours: true,
      startDate: true,
      endDate: true,
      category: { select: { name: true } },
      epic: { select: { id: true, name: true, githubNumber: true } },
      project: { select: { githubRepo: true, epics: { where: { githubNumber: { not: null } }, select: { githubNumber: true } } } },
    },
  });
  const repo = wp?.project.githubRepo;
  if (!wp || !repo || wp.githubNumber === null) return { ok: true };

  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: 'GITHUB_TOKEN mangler i .env.' };

  try {
    const [owner, name] = repo.split('/');
    const { data } = await githubGraphql<{ repository: { issue: IssueForPush | null } | null }>(token, ISSUE_FOR_PUSH_QUERY, {
      owner,
      name,
      number: wp.githubNumber,
    });
    const issue = data?.repository?.issue;
    if (!issue) return { ok: false, error: `Issue #${wp.githubNumber} findes ikke i ${repo}.` };

    // 1. Kategori som label og epic som sub-issue-relation. Et epic, der kun findes i dashboardet
    //    (fx oprettet med "+ Nyt epic"), oprettes først som issue (#25).
    const epicNumber = wp.epic ? await ensureEpicIssue(token, repo, wp.epic) : null;
    const changes = planIssueChanges(
      { labels: issue.labels.nodes.map((l) => l.name), parentNumber: issue.parent?.number ?? null },
      wp.category.name,
      epicNumber,
      new Set(wp.project.epics.map((e) => e.githubNumber!)),
    );
    const issuePath = `/repos/${repo}/issues/${wp.githubNumber}`;
    for (const label of changes.removeLabels) {
      await githubRest(token, 'DELETE', `${issuePath}/labels/${encodeURIComponent(label)}`, undefined, [404]);
    }
    // GitHub opretter labelen, hvis den ikke findes i repoet
    if (changes.addLabels.length > 0) await githubRest(token, 'POST', `${issuePath}/labels`, { labels: changes.addLabels });
    if (changes.parent && 'set' in changes.parent) {
      // replace_parent flytter issuet, hvis det allerede er sub-issue af et andet epic
      await githubRest(token, 'POST', `/repos/${repo}/issues/${changes.parent.set}/sub_issues`, {
        sub_issue_id: issue.databaseId,
        replace_parent: true,
      });
    } else if (changes.parent) {
      await githubRest(token, 'DELETE', `/repos/${repo}/issues/${changes.parent.remove}/sub_issue`, { sub_issue_id: issue.databaseId }, [404]);
    }

    // 2. Estimat og datoer på hver projekttavle, issuet står på. Tomme værdier ryddes på tavlen.
    const date = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;
    const values = { estimate: wp.estimateHours === null ? null : Number(wp.estimateHours), start: date(wp.startDate), end: date(wp.endDate) };
    const mutations: string[] = [];
    for (const item of issue.projectItems.nodes) {
      for (const [key, spec] of Object.entries(BOARD_FIELDS) as [keyof typeof BOARD_FIELDS, (typeof BOARD_FIELDS)[keyof typeof BOARD_FIELDS]][]) {
        const field = item.project.fields.nodes.find(
          (f) => f.dataType === spec.dataType && (spec.names as readonly string[]).includes(f.name?.toLowerCase() ?? ''),
        );
        if (!field?.id) continue;
        const target = `projectId: ${JSON.stringify(item.project.id)}, itemId: ${JSON.stringify(item.id)}, fieldId: ${JSON.stringify(field.id)}`;
        const value = values[key];
        mutations.push(
          value === null
            ? `m${mutations.length}: clearProjectV2ItemFieldValue(input: { ${target} }) { clientMutationId }`
            : `m${mutations.length}: updateProjectV2ItemFieldValue(input: { ${target}, value: { ${spec.dataType === 'NUMBER' ? 'number' : 'date'}: ${JSON.stringify(value)} } }) { clientMutationId }`,
        );
      }
    }
    if (mutations.length > 0) {
      const { errors } = await githubGraphql(token, `mutation { ${mutations.join('\n')} }`);
      if (errors?.length) {
        console.error('GitHub: opdatering af projekttavlen fejlede', errors);
        return { ok: false, error: 'Felterne på projekttavlen kunne ikke opdateres. Prøv at gemme igen.' };
      }
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof GithubError) return { ok: false, error: error.message };
    console.error('GitHub: skrivning fejlede', error);
    return { ok: false, error: 'Vi kunne ikke nå GitHub. Prøv at gemme igen om lidt.' };
  }
}

// Opretter et issue for en arbejdspakke uden issue (#25): navn og beskrivelse, kategori som label, og på
// repoets projekttavler. Bagefter skrives epic, estimat og datoer som ved gem (#51).
export async function createIssueForWorkPackage(workPackageId: string): Promise<PushResult & { number?: number }> {
  await requireSession();

  const wp = await prisma.workPackage.findUnique({
    where: { id: workPackageId },
    select: { name: true, description: true, githubNumber: true, category: { select: { name: true } }, project: { select: { githubRepo: true } } },
  });
  if (!wp) return { ok: false, error: 'Arbejdspakken findes ikke længere. Genindlæs siden.' };
  if (wp.githubNumber !== null) return { ok: true, number: wp.githubNumber };
  const repo = wp.project.githubRepo;
  if (!repo) return { ok: false, error: 'Projektet har intet GitHub-repo. Tilføj det under "Redigér projekt".' };

  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: 'GITHUB_TOKEN mangler i .env.' };

  let number: number;
  try {
    number = await createIssue(token, repo, {
      title: wp.name,
      body: wp.description ?? '',
      labels: [categoryLabel(wp.category.name)],
    });
  } catch (error) {
    if (error instanceof GithubError) return { ok: false, error: error.message };
    console.error('GitHub: oprettelse af issue fejlede', error);
    return { ok: false, error: 'Vi kunne ikke oprette issuet. Prøv igen om lidt.' };
  }

  await prisma.workPackage.update({
    where: { id: workPackageId },
    data: { githubNumber: number, githubState: 'open', githubPullRequests: [], githubSyncedAt: new Date() },
  });

  // Issuet findes nu. Fejler resten, er pakken stadig koblet, og det rettes, næste gang den gemmes.
  const pushed = await pushWorkPackageToGithub(workPackageId);
  return pushed.ok ? { ok: true, number } : { ok: false, number, error: `Issue #${number} er oprettet, men ${pushed.error.charAt(0).toLowerCase()}${pushed.error.slice(1)}` };
}

// Opretter et epic, der kun findes i dashboardet, som issue med labelen "epic" (#25)
export async function createIssueForEpic(epicId: string): Promise<PushResult & { number?: number }> {
  await requireSession();

  const epic = await prisma.epic.findUnique({
    where: { id: epicId },
    select: { id: true, name: true, githubNumber: true, project: { select: { githubRepo: true } } },
  });
  if (!epic) return { ok: false, error: 'Epicet findes ikke længere. Genindlæs siden.' };
  const repo = epic.project.githubRepo;
  if (!repo) return { ok: false, error: 'Projektet har intet GitHub-repo. Tilføj det under "Redigér projekt".' };

  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: 'GITHUB_TOKEN mangler i .env.' };

  try {
    return { ok: true, number: await ensureEpicIssue(token, repo, epic) };
  } catch (error) {
    if (error instanceof GithubError) return { ok: false, error: error.message };
    console.error('GitHub: oprettelse af epic fejlede', error);
    return { ok: false, error: 'Vi kunne ikke oprette epicet på GitHub. Prøv igen om lidt.' };
  }
}
