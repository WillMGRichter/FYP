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

async function getToken(tokenId?: string) {
  if (!tokenId) return undefined;

  const token = await prisma.gitHubToken.findUnique({ where: { id: tokenId } });
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
  reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (request.method === 'OPTIONS') {
    return reply.code(204).send();
  }
});

app.get('/', async () => ({ message: 'Backend running' }));

app.get(`${API_PREFIX}/health`, async () => ({
  ok: true,
  service: 'github-research-backend',
}));

app.get(`${API_PREFIX}/github/tokens`, async () => {
  const tokens = await prisma.gitHubToken.findMany({
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

app.get(`${API_PREFIX}/repositories`, async () => {
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
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
    },
  });

  return jsonForResponse({ repositories });
});

app.get(`${API_PREFIX}/collections`, async () => {
  const runs = await prisma.collectionRun.findMany({
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
  const owner = request.body.owner?.trim();
  const name = request.body.name?.trim();

  if (!owner || !name) {
    return reply.code(400).send({ error: 'Repository owner and name are required.' });
  }

  const selectedToken = await getToken(request.body.tokenId);
  const run = await prisma.collectionRun.create({
    data: {
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
