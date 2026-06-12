import 'dotenv/config';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

const app = Fastify({ logger: true });
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/fyp',
});
const prisma = new PrismaClient({ adapter });

const API_PREFIX = '/api';
const GITHUB_API = 'https://api.github.com';

type GitHubRepository = {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  html_url: string;
  description: string | null;
  default_branch: string | null;
  private: boolean;
  fork: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type GitHubIssue = {
  id: number;
  node_id: string;
  number: number;
  title: string;
  state: string;
  user: { login: string } | null;
  html_url: string;
  pull_request?: unknown;
  closed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type GitHubPullRequest = GitHubIssue & {
  merged_at: string | null;
};

type GitHubCommit = {
  node_id: string;
  sha: string;
  html_url: string;
  author: { login: string } | null;
  commit: {
    message: string;
    author: { date: string | null } | null;
    committer: { date: string | null } | null;
  };
};

type TokenPayload = {
  label?: string;
  token?: string;
};

type AccountPayload = {
  email?: string;
  displayName?: string;
  password?: string;
};

type LoginPayload = {
  email?: string;
  password?: string;
};

type SyncPayload = {
  owner?: string;
  name?: string;
  tokenId?: string;
};

type ExtensionSnapshotPayload = {
  repositoryFullName?: string;
  entityType?: 'REPOSITORY' | 'ISSUE' | 'PULL_REQUEST' | 'COMMIT';
  githubNodeId?: string;
  githubNumber?: number;
  githubSha?: string;
  payload?: unknown;
};

type AuthAccount = {
  id: string;
  email: string;
  displayName: string;
};

const parseDate = (value?: string | null) => (value ? new Date(value) : null);

const jsonForResponse = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_key, nestedValue) =>
      typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue,
    ),
  );

const tokenSecret = () => {
  const raw =
    process.env.GITHUB_TOKEN_SECRET ??
    process.env.DATABASE_URL ??
    'development-only-token-secret-change-me';
  return crypto.createHash('sha256').update(raw).digest();
};

const encryptToken = (token: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
};

const decryptToken = (encryptedToken: string) => {
  const [iv, authTag, encrypted] = encryptedToken.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenSecret(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

const payloadHash = (payload: unknown) =>
  crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

const sessionTokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const passwordHash = (password: string) => {
  const salt = crypto.randomBytes(16).toString('base64');
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('base64');
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
};

const verifyPassword = (password: string, storedHash: string) => {
  const [algorithm, iterationsText, salt, hash] = storedHash.split('$');
  if (algorithm !== 'pbkdf2_sha256' || !iterationsText || !salt || !hash) return false;

  const candidate = crypto
    .pbkdf2Sync(password, salt, Number(iterationsText), 32, 'sha256')
    .toString('base64');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(candidate));
};

const publicAccount = (account: AuthAccount) => ({
  id: account.id,
  email: account.email,
  displayName: account.displayName,
});

async function createSession(accountId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await prisma.accountSession.create({
    data: {
      accountId,
      tokenHash: sessionTokenHash(token),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

async function getOptionalAccount(request: { headers: { authorization?: string } }) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
  if (!token) return null;

  const session = await prisma.accountSession.findUnique({
    where: { tokenHash: sessionTokenHash(token) },
    include: { account: true },
  });

  if (!session || session.expiresAt < new Date()) return null;

  return publicAccount(session.account);
}

async function requireAccount(request: { headers: { authorization?: string } }, reply: { code: (status: number) => { send: (payload: unknown) => unknown } }) {
  const account = await getOptionalAccount(request);
  if (!account) {
    reply.code(401).send({ error: 'Sign in to use account features.' });
    return null;
  }

  return account;
}

async function refreshContributions(input: {
  accountId: string;
  repositoryId: string;
  githubLogin?: string | null;
  issues: GitHubIssue[];
  pulls: GitHubPullRequest[];
  commits: GitHubCommit[];
}) {
  if (!input.githubLogin) return;

  const commitsCount = input.commits.filter((commit) => commit.author?.login === input.githubLogin).length;
  const issuesCount = input.issues.filter((issue) => issue.user?.login === input.githubLogin).length;
  const pullsCount = input.pulls.filter((pull) => pull.user?.login === input.githubLogin).length;

  if (commitsCount + issuesCount + pullsCount === 0) return;

  await prisma.accountContribution.upsert({
    where: {
      accountId_repositoryId_githubLogin: {
        accountId: input.accountId,
        repositoryId: input.repositoryId,
        githubLogin: input.githubLogin,
      },
    },
    update: {
      commitsCount,
      issuesCount,
      pullsCount,
      lastObservedAt: new Date(),
    },
    create: {
      accountId: input.accountId,
      repositoryId: input.repositoryId,
      githubLogin: input.githubLogin,
      commitsCount,
      issuesCount,
      pullsCount,
      lastObservedAt: new Date(),
    },
  });
}

async function githubFetch<T>(path: string, token?: string): Promise<{ data: T; response: Response }> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'FYP-GitHub-Research-Tool',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(data.message ?? `GitHub request failed with status ${response.status}`);
  }

  return { data, response };
}

async function getToken(tokenId?: string, accountId?: string) {
  if (!tokenId) return undefined;

  const token = await prisma.gitHubToken.findFirst({
    where: {
      id: tokenId,
      ...(accountId ? { accountId } : {}),
    },
  });
  if (!token) {
    throw new Error('Selected GitHub token was not found.');
  }

  return {
    id: token.id,
    raw: decryptToken(token.encryptedToken),
  };
}

async function createSnapshot(input: {
  repositoryId: string;
  artifactId?: string;
  entityType: 'REPOSITORY' | 'ISSUE' | 'PULL_REQUEST' | 'COMMIT';
  source: string;
  payload: unknown;
  collectionRunId?: string;
}) {
  const hash = payloadHash(input.payload);
  const existing = await prisma.entitySnapshot.findFirst({
    where: {
      repositoryId: input.repositoryId,
      artifactId: input.artifactId ?? null,
      entityType: input.entityType,
      payloadHash: hash,
    },
  });

  if (existing) {
    await prisma.entitySnapshot.update({
      where: { id: existing.id },
      data: {
        capturedAt: new Date(),
        collectionRunId: input.collectionRunId,
      },
    });
    return;
  }

  await prisma.entitySnapshot.create({
    data: {
      repositoryId: input.repositoryId,
      artifactId: input.artifactId,
      entityType: input.entityType,
      source: input.source,
      payload: input.payload as object,
      payloadHash: hash,
      collectionRunId: input.collectionRunId,
    },
  });
}

app.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;
  if (origin) {
  reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Vary', 'Origin');
  }
  reply.header('Access-Control-Allow-Headers', 'content-type, authorization');
  reply.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');

  if (request.method === 'OPTIONS') {
    return reply.code(204).send();
  }
});

app.get('/', async () => ({ message: 'Backend running' }));

app.get(`${API_PREFIX}/health`, async () => ({
  ok: true,
  service: 'github-research-backend',
}));

app.post<{ Body: AccountPayload }>(`${API_PREFIX}/auth/register`, async (request, reply) => {
  const email = request.body.email?.trim().toLowerCase();
  const displayName = request.body.displayName?.trim();
  const password = request.body.password ?? '';

  if (!email || !displayName || password.length < 8) {
    return reply.code(400).send({ error: 'Email, display name, and an 8+ character password are required.' });
  }

  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    return reply.code(409).send({ error: 'An account with that email already exists.' });
  }

  const account = await prisma.account.create({
    data: {
      email,
      displayName,
      passwordHash: passwordHash(password),
    },
  });
  const session = await createSession(account.id);

  return reply.code(201).send(jsonForResponse({ account: publicAccount(account), session }));
});

app.post<{ Body: LoginPayload }>(`${API_PREFIX}/auth/login`, async (request, reply) => {
  const email = request.body.email?.trim().toLowerCase();
  const password = request.body.password ?? '';

  if (!email || !password) {
    return reply.code(400).send({ error: 'Email and password are required.' });
  }

  const account = await prisma.account.findUnique({ where: { email } });
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return reply.code(401).send({ error: 'Email or password is incorrect.' });
  }

  const session = await createSession(account.id);
  return jsonForResponse({ account: publicAccount(account), session });
});

app.get(`${API_PREFIX}/auth/me`, async (request) => {
  const account = await getOptionalAccount(request);
  return { account };
});

app.post(`${API_PREFIX}/auth/logout`, async (request) => {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
  if (token) {
    await prisma.accountSession.deleteMany({ where: { tokenHash: sessionTokenHash(token) } });
  }
  return { ok: true };
});

app.get(`${API_PREFIX}/github/tokens`, async (request) => {
  const account = await getOptionalAccount(request);
  const tokens = await prisma.gitHubToken.findMany({
    where: account ? { accountId: account.id } : { accountId: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      label: true,
      githubLogin: true,
      tokenPreview: true,
      scopes: true,
      rateLimit: true,
      rateRemaining: true,
      rateResetAt: true,
      lastValidatedAt: true,
      createdAt: true,
    },
  });

  return jsonForResponse({ tokens });
});

app.post<{ Body: TokenPayload }>(`${API_PREFIX}/github/tokens`, async (request, reply) => {
  const account = await requireAccount(request, reply);
  if (!account) return;

  const token = request.body.token?.trim();
  if (!token) {
    return reply.code(400).send({ error: 'A GitHub API token is required.' });
  }

  const { data: user, response } = await githubFetch<{
    id: number;
    login: string;
  }>('/user', token);

  const scopes = response.headers.get('x-oauth-scopes')?.split(',').map((scope) => scope.trim()).filter(Boolean) ?? [];
  const rateLimit = Number(response.headers.get('x-ratelimit-limit') ?? 0);
  const rateRemaining = Number(response.headers.get('x-ratelimit-remaining') ?? 0);
  const reset = Number(response.headers.get('x-ratelimit-reset') ?? 0);

  const saved = await prisma.gitHubToken.create({
    data: {
      accountId: account.id,
      label: request.body.label?.trim() || `${user.login} token`,
      githubLogin: user.login,
      githubUserId: BigInt(user.id),
      encryptedToken: encryptToken(token),
      tokenPreview: `${token.slice(0, 4)}...${token.slice(-4)}`,
      scopes,
      rateLimit,
      rateRemaining,
      rateResetAt: reset ? new Date(reset * 1000) : null,
      lastValidatedAt: new Date(),
    },
    select: {
      id: true,
      label: true,
      githubLogin: true,
      tokenPreview: true,
      scopes: true,
      rateLimit: true,
      rateRemaining: true,
      rateResetAt: true,
      lastValidatedAt: true,
    },
  });

  return reply.code(201).send(jsonForResponse({ token: saved }));
});

app.get(`${API_PREFIX}/repositories`, async (request) => {
  const account = await getOptionalAccount(request);
  const repositories = await prisma.repository.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: {
          artifacts: true,
          snapshots: true,
          collectionRuns: true,
        },
      },
      collectionRuns: {
        where: account ? { accountId: account.id } : undefined,
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
      starredBy: {
        where: account ? { accountId: account.id } : { accountId: '__none__' },
        select: { id: true, note: true, createdAt: true },
      },
    },
  });

  return jsonForResponse({
    repositories: repositories.map((repository) => ({
      ...repository,
      isStarred: repository.starredBy.length > 0,
      star: repository.starredBy[0] ?? null,
      starredBy: undefined,
    })),
  });
});

app.get(`${API_PREFIX}/collections`, async (request) => {
  const account = await getOptionalAccount(request);
  const runs = await prisma.collectionRun.findMany({
    where: account ? { accountId: account.id } : { accountId: null },
    orderBy: { startedAt: 'desc' },
    take: 25,
    include: {
      repository: {
        select: {
          fullName: true,
          htmlUrl: true,
        },
      },
      token: {
        select: {
          label: true,
          githubLogin: true,
        },
      },
    },
  });

  return jsonForResponse({ runs });
});

app.post<{ Body: SyncPayload }>(`${API_PREFIX}/repositories/sync`, async (request, reply) => {
  const account = await getOptionalAccount(request);
  const owner = request.body.owner?.trim();
  const name = request.body.name?.trim();

  if (!owner || !name) {
    return reply.code(400).send({ error: 'Repository owner and name are required.' });
  }

  const selectedToken = await getToken(request.body.tokenId, account?.id);
  const run = await prisma.collectionRun.create({
    data: {
      accountId: account?.id,
      tokenId: selectedToken?.id,
      status: 'RUNNING',
      source: 'github_api',
    },
  });

  try {
    const { data: repoPayload } = await githubFetch<GitHubRepository>(`/repos/${owner}/${name}`, selectedToken?.raw);
    const repository = await prisma.repository.upsert({
      where: { githubId: BigInt(repoPayload.id) },
      update: {
        owner: repoPayload.owner.login,
        name: repoPayload.name,
        fullName: repoPayload.full_name,
        htmlUrl: repoPayload.html_url,
        description: repoPayload.description,
        defaultBranch: repoPayload.default_branch,
        isPrivate: repoPayload.private,
        isFork: repoPayload.fork,
        language: repoPayload.language,
        stars: repoPayload.stargazers_count,
        forks: repoPayload.forks_count,
        openIssues: repoPayload.open_issues_count,
        pushedAt: parseDate(repoPayload.pushed_at),
        githubCreatedAt: parseDate(repoPayload.created_at),
        githubUpdatedAt: parseDate(repoPayload.updated_at),
        collectedAt: new Date(),
      },
      create: {
        githubId: BigInt(repoPayload.id),
        owner: repoPayload.owner.login,
        name: repoPayload.name,
        fullName: repoPayload.full_name,
        htmlUrl: repoPayload.html_url,
        description: repoPayload.description,
        defaultBranch: repoPayload.default_branch,
        isPrivate: repoPayload.private,
        isFork: repoPayload.fork,
        language: repoPayload.language,
        stars: repoPayload.stargazers_count,
        forks: repoPayload.forks_count,
        openIssues: repoPayload.open_issues_count,
        pushedAt: parseDate(repoPayload.pushed_at),
        githubCreatedAt: parseDate(repoPayload.created_at),
        githubUpdatedAt: parseDate(repoPayload.updated_at),
      },
    });

    await prisma.collectionRun.update({
      where: { id: run.id },
      data: { repositoryId: repository.id },
    });

    await createSnapshot({
      repositoryId: repository.id,
      entityType: 'REPOSITORY',
      source: 'github_api',
      payload: repoPayload,
      collectionRunId: run.id,
    });

    const [{ data: issuePayloads }, { data: pullPayloads }, { data: commitPayloads }] = await Promise.all([
      githubFetch<GitHubIssue[]>(`/repos/${owner}/${name}/issues?state=all&per_page=30`, selectedToken?.raw),
      githubFetch<GitHubPullRequest[]>(`/repos/${owner}/${name}/pulls?state=all&per_page=30`, selectedToken?.raw),
      githubFetch<GitHubCommit[]>(`/repos/${owner}/${name}/commits?per_page=30`, selectedToken?.raw),
    ]);

    const issues = issuePayloads.filter((issue) => !issue.pull_request);

    for (const issue of issues) {
      const artifact = await prisma.repositoryArtifact.upsert({
        where: {
          repositoryId_type_githubNodeId: {
            repositoryId: repository.id,
            type: 'ISSUE',
            githubNodeId: issue.node_id,
          },
        },
        update: {
          githubNumber: issue.number,
          title: issue.title,
          state: issue.state,
          authorLogin: issue.user?.login,
          htmlUrl: issue.html_url,
          closedAt: parseDate(issue.closed_at),
          githubCreatedAt: parseDate(issue.created_at),
          githubUpdatedAt: parseDate(issue.updated_at),
          collectedAt: new Date(),
        },
        create: {
          repositoryId: repository.id,
          type: 'ISSUE',
          githubNodeId: issue.node_id,
          githubNumber: issue.number,
          title: issue.title,
          state: issue.state,
          authorLogin: issue.user?.login,
          htmlUrl: issue.html_url,
          closedAt: parseDate(issue.closed_at),
          githubCreatedAt: parseDate(issue.created_at),
          githubUpdatedAt: parseDate(issue.updated_at),
        },
      });

      await createSnapshot({
        repositoryId: repository.id,
        artifactId: artifact.id,
        entityType: 'ISSUE',
        source: 'github_api',
        payload: issue,
        collectionRunId: run.id,
      });
    }

    for (const pull of pullPayloads) {
      const artifact = await prisma.repositoryArtifact.upsert({
        where: {
          repositoryId_type_githubNodeId: {
            repositoryId: repository.id,
            type: 'PULL_REQUEST',
            githubNodeId: pull.node_id,
          },
        },
        update: {
          githubNumber: pull.number,
          title: pull.title,
          state: pull.state,
          authorLogin: pull.user?.login,
          htmlUrl: pull.html_url,
          mergedAt: parseDate(pull.merged_at),
          closedAt: parseDate(pull.closed_at),
          githubCreatedAt: parseDate(pull.created_at),
          githubUpdatedAt: parseDate(pull.updated_at),
          collectedAt: new Date(),
        },
        create: {
          repositoryId: repository.id,
          type: 'PULL_REQUEST',
          githubNodeId: pull.node_id,
          githubNumber: pull.number,
          title: pull.title,
          state: pull.state,
          authorLogin: pull.user?.login,
          htmlUrl: pull.html_url,
          mergedAt: parseDate(pull.merged_at),
          closedAt: parseDate(pull.closed_at),
          githubCreatedAt: parseDate(pull.created_at),
          githubUpdatedAt: parseDate(pull.updated_at),
        },
      });

      await createSnapshot({
        repositoryId: repository.id,
        artifactId: artifact.id,
        entityType: 'PULL_REQUEST',
        source: 'github_api',
        payload: pull,
        collectionRunId: run.id,
      });
    }

    for (const commit of commitPayloads) {
      const artifact = await prisma.repositoryArtifact.upsert({
        where: {
          repositoryId_type_githubNodeId: {
            repositoryId: repository.id,
            type: 'COMMIT',
            githubNodeId: commit.node_id,
          },
        },
        update: {
          githubSha: commit.sha,
          title: commit.commit.message.split('\n')[0],
          authorLogin: commit.author?.login,
          htmlUrl: commit.html_url,
          githubCreatedAt: parseDate(commit.commit.author?.date),
          githubUpdatedAt: parseDate(commit.commit.committer?.date),
          collectedAt: new Date(),
        },
        create: {
          repositoryId: repository.id,
          type: 'COMMIT',
          githubNodeId: commit.node_id,
          githubSha: commit.sha,
          title: commit.commit.message.split('\n')[0],
          authorLogin: commit.author?.login,
          htmlUrl: commit.html_url,
          githubCreatedAt: parseDate(commit.commit.author?.date),
          githubUpdatedAt: parseDate(commit.commit.committer?.date),
        },
      });

      await createSnapshot({
        repositoryId: repository.id,
        artifactId: artifact.id,
        entityType: 'COMMIT',
        source: 'github_api',
        payload: commit,
        collectionRunId: run.id,
      });
    }

    const accountGithubLogin =
      account && selectedToken
        ? (
            await prisma.gitHubToken.findFirst({
              where: { id: selectedToken.id, accountId: account.id },
              select: { githubLogin: true },
            })
          )?.githubLogin
        : null;

    if (account) {
      await refreshContributions({
        accountId: account.id,
        repositoryId: repository.id,
        githubLogin: accountGithubLogin,
        issues,
        pulls: pullPayloads,
        commits: commitPayloads,
      });
    }

    const completed = await prisma.collectionRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        issuesCount: issues.length,
        pullsCount: pullPayloads.length,
        commitsCount: commitPayloads.length,
      },
      include: {
        repository: true,
      },
    });

    return reply.code(201).send(jsonForResponse({ run: completed }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown collection failure';
    await prisma.collectionRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: message,
      },
    });

    return reply.code(502).send({ error: message });
  }
});

app.post<{ Params: { id: string }; Body: { note?: string } }>(`${API_PREFIX}/repositories/:id/star`, async (request, reply) => {
  const account = await requireAccount(request, reply);
  if (!account) return;

  const repository = await prisma.repository.findUnique({ where: { id: request.params.id } });
  if (!repository) {
    return reply.code(404).send({ error: 'Repository was not found.' });
  }

  const star = await prisma.starredRepository.upsert({
    where: {
      accountId_repositoryId: {
        accountId: account.id,
        repositoryId: repository.id,
      },
    },
    update: {
      note: request.body.note?.trim() || null,
    },
    create: {
      accountId: account.id,
      repositoryId: repository.id,
      note: request.body.note?.trim() || null,
    },
  });

  return jsonForResponse({ star });
});

app.delete<{ Params: { id: string } }>(`${API_PREFIX}/repositories/:id/star`, async (request, reply) => {
  const account = await requireAccount(request, reply);
  if (!account) return;

  await prisma.starredRepository.deleteMany({
    where: {
      accountId: account.id,
      repositoryId: request.params.id,
    },
  });

  return { ok: true };
});

app.get(`${API_PREFIX}/account/contributions`, async (request, reply) => {
  const account = await requireAccount(request, reply);
  if (!account) return;

  const contributions = await prisma.accountContribution.findMany({
    where: { accountId: account.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      repository: {
        select: {
          fullName: true,
          htmlUrl: true,
          language: true,
        },
      },
    },
  });

  return jsonForResponse({ contributions });
});

app.post<{ Body: ExtensionSnapshotPayload }>(`${API_PREFIX}/extension/snapshots`, async (request, reply) => {
  const { repositoryFullName, entityType, payload } = request.body;

  if (!repositoryFullName || !entityType || !payload) {
    return reply.code(400).send({ error: 'repositoryFullName, entityType, and payload are required.' });
  }

  const repository = await prisma.repository.findUnique({
    where: { fullName: repositoryFullName },
  });

  if (!repository) {
    return reply.code(404).send({ error: 'Repository must be synced before extension snapshots can be attached.' });
  }

  const artifact =
    entityType === 'REPOSITORY'
      ? null
      : await prisma.repositoryArtifact.upsert({
          where: {
            repositoryId_type_githubNodeId: {
              repositoryId: repository.id,
              type: entityType,
              githubNodeId: request.body.githubNodeId ?? `${entityType}:${request.body.githubNumber ?? request.body.githubSha}`,
            },
          },
          update: {
            githubNumber: request.body.githubNumber,
            githubSha: request.body.githubSha,
            collectedAt: new Date(),
          },
          create: {
            repositoryId: repository.id,
            type: entityType,
            githubNodeId: request.body.githubNodeId ?? `${entityType}:${request.body.githubNumber ?? request.body.githubSha}`,
            githubNumber: request.body.githubNumber,
            githubSha: request.body.githubSha,
          },
        });

  await createSnapshot({
    repositoryId: repository.id,
    artifactId: artifact?.id,
    entityType,
    source: 'browser_extension',
    payload,
  });

  return reply.code(201).send({ ok: true });
});

const start = async () => {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
};

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
