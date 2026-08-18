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

/**
 * Parse an optional ISO date string into a Date or null.
 * @param value - ISO date string or null
 * @returns Date object or null
 */
const parseDate = (value?: string | null) => (value ? new Date(value) : null);

/**
 * Serialise a value to JSON, converting BigInt values to strings.
 * Required because JSON.stringify does not support BigInt.
 * @param value - The value to serialise
 * @returns JSON-safe object
 */
const jsonForResponse = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_key, nestedValue) =>
      typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue,
    ),
  );

/**
 * Derive a 256-bit AES key from the GITHUB_TOKEN_SECRET environment variable.
 * Falls back to DATABASE_URL or a development-only constant.
 * @returns 32-byte Buffer suitable for AES-256-GCM
 */
const tokenSecret = () => {
  const raw =
    process.env.GITHUB_TOKEN_SECRET ??
    process.env.DATABASE_URL ??
    'development-only-token-secret-change-me';
  return crypto.createHash('sha256').update(raw).digest();
};

/**
 * Encrypt a GitHub token using AES-256-GCM.
 * Output format: base64(iv).base64(authTag).base64(ciphertext)
 * @param token - Plaintext token to encrypt
 * @returns Encrypted token string
 */
const encryptToken = (token: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
};

/**
 * Decrypt a token previously encrypted with encryptToken.
 * @param encryptedToken - Token in base64(iv).base64(authTag).base64(ciphertext) format
 * @returns Plaintext token
 */
const decryptToken = (encryptedToken: string) => {
  const [iv, authTag, encrypted] = encryptedToken.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenSecret(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

/**
 * Compute a SHA-256 hash of a JSON-serialisable payload for deduplication.
 */
const payloadHash = (payload: unknown) =>
  crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

/**
 * Compute a SHA-256 hash of a session token for secure storage.
 */
const sessionTokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Hash a password using PBKDF2 with SHA-256 and a random salt.
 * Output format: pbkdf2_sha256$iterations$salt$hash
 * @param password - Plaintext password
 * @returns Storable hash string
 */
const passwordHash = (password: string) => {
  const salt = crypto.randomBytes(16).toString('base64');
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('base64');
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
};

/**
 * Verify a password against a stored PBKDF2 hash.
 * Uses timing-safe comparison to prevent timing attacks.
 * @param password - Plaintext password to verify
 * @param storedHash - Hash in pbkdf2_sha256$iterations$salt$hash format
 * @returns True if the password matches
 */
const verifyPassword = (password: string, storedHash: string) => {
  const [algorithm, iterationsText, salt, hash] = storedHash.split('$');
  if (algorithm !== 'pbkdf2_sha256' || !iterationsText || !salt || !hash) return false;

  const candidate = crypto
    .pbkdf2Sync(password, salt, Number(iterationsText), 32, 'sha256')
    .toString('base64');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(candidate));
};

/**
 * Strip sensitive fields (e.g. passwordHash) from an account object.
 */
const publicAccount = (account: AuthAccount) => ({
  id: account.id,
  email: account.email,
  displayName: account.displayName,
});

/**
 * Create a new session for the given account.
 * The session token is returned in plaintext; only its hash is stored.
 * @param accountId - ID of the account
 * @returns Object containing the plaintext token and expiration date
 */
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

/**
 * Resolve the account from the request's Bearer token, if present and valid.
 * @param request - Fastify request object
 * @returns The public account object, or null if not authenticated
 */
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

/**
 * Require a valid session. Sends 401 and returns null if not authenticated.
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @returns The public account object, or null (and a 401 response) if not authenticated
 */
async function requireAccount(request: { headers: { authorization?: string } }, reply: { code: (status: number) => { send: (payload: unknown) => unknown } }) {
  const account = await getOptionalAccount(request);
  if (!account) {
    reply.code(401).send({ error: 'Sign in to use account features.' });
    return null;
  }

  return account;
}

/**
 * Upsert contribution counts for an account on a repository.
 * Only updates if the account's GitHub login matches any artifact authors.
 */
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

/**
 * Make an authenticated request to the GitHub REST API.
 * @param path - API path (e.g. /repos/owner/name)
 * @param token - Optional Bearer token for authenticated requests
 * @returns Parsed response data and the raw Response object
 */
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

/**
 * Retrieve and decrypt a GitHub token by ID, optionally scoped to an account.
 * @param tokenId - ID of the token record
 * @param accountId - Optional account ID for access scoping
 * @returns Decrypted token record, or undefined if no tokenId given
 */
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

/**
 * Create or update an entity snapshot.
 * Uses payload hash for deduplication to avoid storing identical snapshots.
 */
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

/** CORS preflight and header injection hook for all routes. */
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

/** Register a new account and return a session. */
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

/** Authenticate with email and password, returning a session. */
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

/** Return the currently authenticated account, or null. */
app.get(`${API_PREFIX}/auth/me`, async (request) => {
  const account = await getOptionalAccount(request);
  return { account };
});

/** Invalidate the current session. */
app.post(`${API_PREFIX}/auth/logout`, async (request) => {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
  if (token) {
    await prisma.accountSession.deleteMany({ where: { tokenHash: sessionTokenHash(token) } });
  }
  return { ok: true };
});

/** List saved GitHub tokens for the current account. */
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

/** Save and validate a new GitHub token. Validates against the GitHub /user endpoint. */
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

/**
 * Load a repository with its artifacts and all entity snapshots.
 * Artifact-linked snapshots and repository-level snapshots (artifactId null) are
 * returned together so clients can render the full collected dataset.
 * @param id - Repository record ID
 */
async function loadRepositoryWithSnapshots(id: string) {
  return prisma.repository.findUnique({
    where: { id },
    include: {
      artifacts: {
        orderBy: [{ type: 'asc' }, { githubNumber: 'asc' }],
        include: {
          snapshots: {
            orderBy: { capturedAt: 'desc' },
            select: { id: true, source: true, capturedAt: true, payload: true },
          },
        },
      },
      snapshots: {
        where: { artifactId: null },
        orderBy: { capturedAt: 'desc' },
        select: { id: true, source: true, capturedAt: true, payload: true },
      },
    },
  });
}

/**
 * Escape a value for CSV output, quoting and doubling embedded quotes.
 * @param value - Raw cell value
 * @returns CSV-safe quoted cell
 */
const csvCell = (value: string | number | null | undefined) => {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

/** Detail endpoint: repository metadata, artifacts, and collected snapshots. */
app.get<{ Params: { id: string } }>(`${API_PREFIX}/repositories/:id`, async (request, reply) => {
  const repository = await loadRepositoryWithSnapshots(request.params.id);
  if (!repository) {
    return reply.code(404).send({ error: 'Repository was not found.' });
  }

  return jsonForResponse({ repository });
});

/** Export endpoint: download all collected data for a repository as JSON or CSV. */
app.get<{ Params: { id: string }; Querystring: { format?: string } }>(
  `${API_PREFIX}/repositories/:id/export`,
  async (request, reply) => {
    const repository = await loadRepositoryWithSnapshots(request.params.id);
    if (!repository) {
      return reply.code(404).send({ error: 'Repository was not found.' });
    }

    const filename = `${repository.fullName.replace(/\//g, '-')}-data`;

    if (request.query.format === 'csv') {
      const header = 'entityType,source,githubNumber,githubSha,title,state,authorLogin,htmlUrl,capturedAt,payload';
      const rows = [header];

      for (const artifact of repository.artifacts) {
        for (const snapshot of artifact.snapshots) {
          rows.push(
            [
              artifact.type,
              snapshot.source,
              artifact.githubNumber,
              artifact.githubSha,
              artifact.title,
              artifact.state,
              artifact.authorLogin,
              artifact.htmlUrl,
              snapshot.capturedAt.toISOString(),
              JSON.stringify(snapshot.payload),
            ]
              .map(csvCell)
              .join(','),
          );
        }
      }

      for (const snapshot of repository.snapshots) {
        rows.push(
          [
            'REPOSITORY',
            snapshot.source,
            null,
            null,
            repository.fullName,
            null,
            null,
            repository.htmlUrl,
            snapshot.capturedAt.toISOString(),
            JSON.stringify(snapshot.payload),
          ]
            .map(csvCell)
            .join(','),
        );
      }

      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return reply.send(rows.join('\n'));
    }

    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}.json"`);
    return reply.send(
      JSON.stringify(
        jsonForResponse({ exportedAt: new Date().toISOString(), repository }),
        null,
        2,
      ),
    );
  },
);

/** List all repositories in the snapshot store with counts and star status. */
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

/** List recent collection runs for the current account. */
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

/**
 * Trigger a full collection run: fetches repository metadata, issues,
 * pull requests, and commits from GitHub and persists them as snapshots.
 */
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

/** Star a repository for the current account with an optional note. */
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

/** Remove a star from a repository. */
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

/** List contribution summaries for the current account. */
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

/** Aggregate analytics across all repositories for MSR research. */
app.get(`${API_PREFIX}/analytics`, async () => {
  const repositories = await prisma.repository.findMany({
    select: {
      id: true,
      language: true,
      stars: true,
      forks: true,
      openIssues: true,
      githubCreatedAt: true,
      githubUpdatedAt: true,
      createdAt: true,
    },
  });

  const artifacts = await prisma.repositoryArtifact.findMany({
    select: {
      type: true,
      state: true,
      authorLogin: true,
      repositoryId: true,
      githubCreatedAt: true,
    },
  });

  const snapshots = await prisma.entitySnapshot.findMany({
    select: {
      entityType: true,
      source: true,
      repositoryId: true,
    },
  });

  // --- Repository overview ---
  const repoCount = repositories.length;
  const starsArr = repositories.map((r) => r.stars).sort((a, b) => a - b);
  const forksArr = repositories.map((r) => r.forks).sort((a, b) => a - b);
  const openIssuesArr = repositories.map((r) => r.openIssues).sort((a, b) => a - b);

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  const repoOverview = {
    total: repoCount,
    stars: {
      min: starsArr[0] ?? 0,
      max: starsArr[starsArr.length - 1] ?? 0,
      median: median(starsArr),
      average: repoCount > 0 ? Math.round(starsArr.reduce((a, b) => a + b, 0) / repoCount) : 0,
    },
    forks: {
      min: forksArr[0] ?? 0,
      max: forksArr[forksArr.length - 1] ?? 0,
      median: median(forksArr),
      average: repoCount > 0 ? Math.round(forksArr.reduce((a, b) => a + b, 0) / repoCount) : 0,
    },
    openIssues: {
      min: openIssuesArr[0] ?? 0,
      max: openIssuesArr[openIssuesArr.length - 1] ?? 0,
      median: median(openIssuesArr),
      average: repoCount > 0 ? Math.round(openIssuesArr.reduce((a, b) => a + b, 0) / repoCount) : 0,
    },
  };

  // --- Language distribution ---
  const languageMap = new Map<string, number>();
  for (const repo of repositories) {
    const lang = repo.language ?? 'Unknown';
    languageMap.set(lang, (languageMap.get(lang) ?? 0) + 1);
  }
  const languageDistribution = [...languageMap.entries()]
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);

  // --- Artifact breakdown ---
  const artifactTypeCounts = { REPOSITORY: 0, ISSUE: 0, PULL_REQUEST: 0, COMMIT: 0 };
  const issueStates = { open: 0, closed: 0 };
  const prStates = { open: 0, closed: 0, merged: 0 };

  for (const artifact of artifacts) {
    artifactTypeCounts[artifact.type] = (artifactTypeCounts[artifact.type] ?? 0) + 1;

    if (artifact.type === 'ISSUE') {
      if (artifact.state === 'open') issueStates.open++;
      else issueStates.closed++;
    } else if (artifact.type === 'PULL_REQUEST') {
      if (artifact.state === 'merged') prStates.merged++;
      else if (artifact.state === 'open') prStates.open++;
      else prStates.closed++;
    }
  }

  // --- Contributor metrics ---
  const authorMap = new Map<string, { commits: number; issues: number; pulls: number; repos: Set<string> }>();
  for (const artifact of artifacts) {
    if (!artifact.authorLogin) continue;
    let entry = authorMap.get(artifact.authorLogin);
    if (!entry) {
      entry = { commits: 0, issues: 0, pulls: 0, repos: new Set() };
      authorMap.set(artifact.authorLogin, entry);
    }
    entry.repos.add(artifact.repositoryId);
    if (artifact.type === 'COMMIT') entry.commits++;
    else if (artifact.type === 'ISSUE') entry.issues++;
    else if (artifact.type === 'PULL_REQUEST') entry.pulls++;
  }

  const uniqueAuthors = authorMap.size;
  const topContributors = [...authorMap.entries()]
    .map(([login, data]) => ({
      login,
      commits: data.commits,
      issues: data.issues,
      pulls: data.pulls,
      total: data.commits + data.issues + data.pulls,
      repositories: data.repos.size,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  // --- Collection source comparison ---
  const sourceMap = new Map<string, number>();
  for (const snapshot of snapshots) {
    sourceMap.set(snapshot.source, (sourceMap.get(snapshot.source) ?? 0) + 1);
  }
  const collectionSources = [...sourceMap.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  const entityTypeSourceBreakdown = snapshots.reduce(
    (acc, s) => {
      const key = `${s.entityType}:${s.source}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // --- Temporal stats (per year) ---
  const repoCreationByYear = new Map<string, number>();
  const issueCreationByYear = new Map<string, number>();
  const prCreationByYear = new Map<string, number>();
  const commitByYear = new Map<string, number>();

  for (const repo of repositories) {
    if (repo.githubCreatedAt) {
      const year = repo.githubCreatedAt.getFullYear().toString();
      repoCreationByYear.set(year, (repoCreationByYear.get(year) ?? 0) + 1);
    }
  }

  for (const artifact of artifacts) {
    if (!artifact.githubCreatedAt) continue;
    const year = artifact.githubCreatedAt.getFullYear().toString();
    if (artifact.type === 'ISSUE') issueCreationByYear.set(year, (issueCreationByYear.get(year) ?? 0) + 1);
    else if (artifact.type === 'PULL_REQUEST') prCreationByYear.set(year, (prCreationByYear.get(year) ?? 0) + 1);
    else if (artifact.type === 'COMMIT') commitByYear.set(year, (commitByYear.get(year) ?? 0) + 1);
  }

  const toYearlyArray = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year));

  return jsonForResponse({
    repositoryOverview: repoOverview,
    languageDistribution,
    artifactBreakdown: {
      byType: artifactTypeCounts,
      issues: issueStates,
      pullRequests: prStates,
      totalArtifacts: artifacts.length,
      totalSnapshots: snapshots.length,
    },
    contributorMetrics: {
      uniqueAuthors,
      topContributors,
    },
    collectionSources,
    entityTypeSourceBreakdown,
    temporal: {
      repositoriesByYear: toYearlyArray(repoCreationByYear),
      issuesByYear: toYearlyArray(issueCreationByYear),
      pullRequestsByYear: toYearlyArray(prCreationByYear),
      commitsByYear: toYearlyArray(commitByYear),
    },
  });
});

/** Receive a snapshot from the browser extension and persist it. */
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
