import 'server-only';

import { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/db';
import { type GithubIssue, type GithubPullRequest, planGithubSync } from '@/lib/github-sync';
import { requireSession } from '@/lib/session';

// GitHub-integrationen (#24). Tokenet ligger kun på serveren (GITHUB_TOKEN i .env) og sendes aldrig til browseren.
// Selve reglerne for, hvad der oprettes og opdateres, står i lib/github-sync.ts.

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

type IssuesResponse = {
  data?: { repository: { issues: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: IssueNode[] } } | null };
  errors?: { type?: string; message: string }[];
};

/** Fejl med en besked, der kan vises for brugeren som den er */
class GithubError extends Error {}

async function fetchIssues(repo: string, token: string): Promise<GithubIssue[]> {
  const [owner, name] = repo.split('/');
  const issues: GithubIssue[] = [];
  let after: string | null = null;

  do {
    const response: Response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: ISSUES_QUERY, variables: { owner, name, after } }),
      // Altid friske data. Cachen er dashboardets egen database.
      cache: 'no-store',
    });
    if (response.status === 401) throw new GithubError('GitHub afviste tokenet. Tjek GITHUB_TOKEN i .env.');
    if (!response.ok) throw new GithubError(`GitHub svarede ikke som forventet (HTTP ${response.status}). Prøv igen om lidt.`);

    const { data, errors }: IssuesResponse = await response.json();
    const page = data?.repository?.issues;
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
