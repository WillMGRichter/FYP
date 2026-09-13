import 'dotenv/config'
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
// install prismaPg + dotenv node packages

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const GITHUB_TOKEN_SECRET = `${process.env.GITHUB_TOKEN_SECRET}`;
const BASE = 'https://api.github.com';

if (!GITHUB_TOKEN_SECRET) {
    throw new Error('GITHUB_TOKEN_SECRET env var is required for backfill')
}

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------
// Every request attempt (success, retry, or final failure) is written as one
// JSON line to logs/extraction-<repo>-<timestamp>.log, plus a running summary
// per entity type (commits/issues/pull_requests) so we can see afterwards
// whether extraction reliability depends on repo scale.

type LogEvent = {
  ts: string;
  repo: string;
  entityType: string;
  url: string;
  attempt: number;
  status: 'success' | 'retry' | 'failure';
  httpStatus?: number;
  latencyMs?: number;
  error?: string;
};

class ExtractionLogger {
  private logPath: string;
  private summary: Record<string, { attempted: number; succeeded: number; failed: number; retries: number; durationMs?: number }> = {};

  constructor(repoLabel: string) {
    const dir = path.resolve(process.cwd(), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    this.logPath = path.join(dir, `extraction-${repoLabel.replace('/', '_')}-${ts}.log`);
  }

  private ensure(entityType: string) {
    if (!this.summary[entityType]) {
      this.summary[entityType] = { attempted: 0, succeeded: 0, failed: 0, retries: 0 };
    }
    return this.summary[entityType];
  }

  log(event: LogEvent) {
    fs.appendFileSync(this.logPath, JSON.stringify(event) + '\n');
    const s = this.ensure(event.entityType);
    if (event.attempt === 1) s.attempted += 1;
    if (event.status === 'success') s.succeeded += 1;
    if (event.status === 'retry') s.retries += 1;
    if (event.status === 'failure') s.failed += 1;
  }

  // Records how long a whole phase (e.g. all of backfillCommits) took, in ms.
  // Separate from the per-request `latencyMs` in log(), which times individual
  // API calls — this times the end-to-end phase including every page, retry,
  // and DB write.
  recordDuration(entityType: string, durationMs: number) {
    fs.appendFileSync(this.logPath, JSON.stringify({
      ts: new Date().toISOString(), entityType, status: 'phase_complete', durationMs,
    }) + '\n');
    this.ensure(entityType).durationMs = durationMs;
  }

  writeSummary() {
    const summaryPath = this.logPath.replace('.log', '.summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(this.summary, null, 2));
    console.log(`\nExtraction summary (${this.logPath}):`);
    console.table(this.summary);
    return summaryPath;
  }
}

// Wraps an async phase (backfillCommits/Issues/PullRequests) with a wall-clock
// timer and records it into the logger's summary under `entityType`.
async function timed<T>(entityType: string, logger: ExtractionLogger, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const durationMs = Date.now() - start;
    logger.recordDuration(entityType, durationMs);
    console.log(`  ${entityType} took ${(durationMs / 1000).toFixed(1)}s`);
  }
}

// ---------------------------------------------------------------------------
// Retry wrapper
// ---------------------------------------------------------------------------
// Retries on transient failures: 5xx (incl. the 504s seen on larger repos),
// 429 (secondary rate limit), and network-level errors (ECONNRESET etc).
// Uses exponential backoff with jitter, capped at maxDelayMs.
// Does NOT retry on 4xx (other than 429) — those are permanent (bad token,
// repo not found, etc) and should fail fast.

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: {
    logger: ExtractionLogger;
    repo: string;
    entityType: string;
    url: string;
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<T> {
  const { logger, repo, entityType, url, maxRetries = 5, baseDelayMs = 1000, maxDelayMs = 30_000 } = opts;
  let attempt = 0;

  while (true) {
    attempt += 1;
    const start = Date.now();
    try {
      const result = await fn(attempt);
      logger.log({
        ts: new Date().toISOString(),
        repo, entityType, url, attempt,
        status: 'success',
        latencyMs: Date.now() - start,
      });
      return result;
    } catch (err: any) {
      const httpStatus = err?.httpStatus as number | undefined;
      const retryable = httpStatus ? RETRYABLE_STATUS.has(httpStatus) : true; // network errors: retry
      const exhausted = attempt > maxRetries;

      logger.log({
        ts: new Date().toISOString(),
        repo, entityType, url, attempt,
        status: retryable && !exhausted ? 'retry' : 'failure',
        httpStatus,
        latencyMs: Date.now() - start,
        error: err?.message,
      });

      if (!retryable || exhausted) {
        throw err;
      }

      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.random() * backoff * 0.3;
      const waitMs = backoff + jitter;
      console.log(`  [retry] ${entityType} attempt ${attempt} failed (${httpStatus ?? err?.message}), waiting ${Math.round(waitMs)}ms...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

function hashPayload(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function rawFetch(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN_SECRET}`,
      Accept: 'application/vnd.github+json',
    },
  });

  // Proactive rate-limit throttling (unchanged from original, still useful
  // alongside retries — this avoids tripping the limit in the first place).
  const remaining = res.headers.get('x-ratelimit-remaining');
  if (remaining && parseInt(remaining, 10) < 5) {
    const resetAt = parseInt(res.headers.get('x-ratelimit-reset') || '0', 10) * 1000;
    const waitMs = resetAt - Date.now();
    if (waitMs > 0) {
      console.log(`Rate limit low, waiting ${Math.ceil(waitMs / 1000)}s...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  if (!res.ok) {
    const body = await res.text();
    const error: any = new Error(`GitHub API ${res.status}: ${body}`);
    error.httpStatus = res.status;
    throw error;
  }
  return res;
}

async function fetchAllPages<T>(url: string, logger: ExtractionLogger, repo: string, entityType: string): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const currentUrl = nextUrl;
    const res = await withRetry(() => rawFetch(currentUrl), { logger, repo, entityType, url: currentUrl });
    const data = (await res.json()) as T[];
    results.push(...data);

    const linkHeader = res.headers.get('link');
    const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = nextMatch ? nextMatch[1] : null;
  }

  return results;
}

async function fetchJson<T>(url: string, logger: ExtractionLogger, repo: string, entityType: string): Promise<T> {
  const res = await withRetry(() => rawFetch(url), { logger, repo, entityType, url });
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Same DB logic as before (unchanged)
// ---------------------------------------------------------------------------

async function ensureRepository(owner: string, repo: string, logger: ExtractionLogger) {
  const data = await fetchJson<any>(`${BASE}/repos/${owner}/${repo}`, logger, `${owner}/${repo}`, 'repository');

  return prisma.repository.upsert({
    where: { fullName: data.full_name },
    update: {
      description: data.description,
      defaultBranch: data.default_branch,
      isPrivate: data.private,
      isFork: data.fork,
      language: data.language,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      pushedAt: data.pushed_at,
      githubUpdatedAt: data.updated_at,
    },
    create: {
      githubId: data.id,
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      htmlUrl: data.html_url,
      description: data.description,
      defaultBranch: data.default_branch,
      isPrivate: data.private,
      isFork: data.fork,
      language: data.language,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      pushedAt: data.pushed_at,
      githubCreatedAt: data.created_at,
      githubUpdatedAt: data.updated_at,
    },
  });
}

async function recordSnapshot(params: {
  repositoryId: string;
  type: 'COMMIT' | 'ISSUE' | 'PULL_REQUEST' | 'REPOSITORY';
  githubNodeId: string;
  githubNumber?: number | null;
  githubSha?: string | null;
  title?: string | null;
  state?: string | null;
  authorLogin?: string | null;
  htmlUrl?: string | null;
  mergedAt?: string | null;
  closedAt?: string | null;
  githubCreatedAt?: string | null;
  githubUpdatedAt?: string | null;
  payload: unknown;
}) {
  const artifact = await prisma.repositoryArtifact.upsert({
    where: {
      repositoryId_type_githubNodeId: {
        repositoryId: params.repositoryId,
        type: params.type,
        githubNodeId: params.githubNodeId,
      },
    },
    update: {
      title: params.title,
      state: params.state,
      htmlUrl: params.htmlUrl,
      mergedAt: params.mergedAt,
      closedAt: params.closedAt,
      githubUpdatedAt: params.githubUpdatedAt,
    },
    create: {
      repositoryId: params.repositoryId,
      type: params.type,
      githubNodeId: params.githubNodeId,
      githubNumber: params.githubNumber ?? null,
      githubSha: params.githubSha ?? null,
      title: params.title,
      state: params.state,
      authorLogin: params.authorLogin,
      htmlUrl: params.htmlUrl,
      mergedAt: params.mergedAt,
      closedAt: params.closedAt,
      githubCreatedAt: params.githubCreatedAt,
      githubUpdatedAt: params.githubUpdatedAt,
    },
  });

  const payloadHash = hashPayload(params.payload);

  await prisma.entitySnapshot.upsert({
    where: {
      repositoryId_artifactId_entityType_payloadHash: {
        repositoryId: params.repositoryId,
        artifactId: artifact.id,
        entityType: params.type,
        payloadHash,
      },
    },
    update: {},
    create: {
      repositoryId: params.repositoryId,
      artifactId: artifact.id,
      entityType: params.type,
      source: 'API_BACKFILL',
      payload: params.payload as any,
      payloadHash,
    },
  });
}

async function backfillCommits(owner: string, repo: string, repositoryId: string, logger: ExtractionLogger) {
  const commits = await fetchAllPages<any>(`${BASE}/repos/${owner}/${repo}/commits?per_page=100`, logger, `${owner}/${repo}`, 'commits');

  for (const c of commits) {
    await recordSnapshot({
      repositoryId,
      type: 'COMMIT',
      githubNodeId: c.node_id,
      githubSha: c.sha,
      title: c.commit.message.split('\n')[0],
      authorLogin: c.author?.login ?? c.commit.author?.name ?? null,
      htmlUrl: c.html_url,
      githubCreatedAt: c.commit.author?.date ?? null,
      payload: {
        sha: c.sha,
        message: c.commit.message,
        author: c.author?.login ?? c.commit.author?.name,
        url: c.html_url,
        timestamp: c.commit.author?.date,
      },
    });
  }

  console.log(`Backfilled ${commits.length} commits`);
}

async function backfillIssues(owner: string, repo: string, repositoryId: string, logger: ExtractionLogger) {
  const issues = await fetchAllPages<any>(`${BASE}/repos/${owner}/${repo}/issues?state=all&per_page=100`, logger, `${owner}/${repo}`, 'issues');
  const trueIssues = issues.filter((i) => !i.pull_request);

  for (const i of trueIssues) {
    await recordSnapshot({
      repositoryId,
      type: 'ISSUE',
      githubNodeId: i.node_id,
      githubNumber: i.number,
      title: i.title,
      state: i.state,
      authorLogin: i.user?.login ?? null,
      htmlUrl: i.html_url,
      closedAt: i.closed_at,
      githubCreatedAt: i.created_at,
      githubUpdatedAt: i.updated_at,
      payload: {
        number: i.number,
        title: i.title,
        state: i.state,
        author: i.user?.login,
        body: i.body,
        labels: i.labels.map((l: any) => (typeof l === 'string' ? l : l.name)),
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        url: i.html_url,
      },
    });
  }

  console.log(`Backfilled ${trueIssues.length} issues`);
}

async function backfillPullRequests(owner: string, repo: string, repositoryId: string, logger: ExtractionLogger) {
  const prList = await fetchAllPages<any>(`${BASE}/repos/${owner}/${repo}/pulls?state=all&per_page=100`, logger, `${owner}/${repo}`, 'pull_requests');

  for (const p of prList) {
    const detail = await fetchJson<any>(`${BASE}/repos/${owner}/${repo}/pulls/${p.number}`, logger, `${owner}/${repo}`, 'pull_requests');

    await recordSnapshot({
      repositoryId,
      type: 'PULL_REQUEST',
      githubNodeId: p.node_id,
      githubNumber: p.number,
      title: p.title,
      state: p.state,
      authorLogin: p.user?.login ?? null,
      htmlUrl: p.html_url,
      mergedAt: p.merged_at,
      closedAt: p.closed_at,
      githubCreatedAt: p.created_at,
      githubUpdatedAt: p.updated_at,
      payload: {
        number: p.number,
        title: p.title,
        state: p.state,
        author: p.user?.login,
        body: p.body,
        labels: p.labels.map((l: any) => l.name),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        url: p.html_url,
        isDraft: p.draft,
        changedFiles: detail.changed_files,
        additions: detail.additions,
        deletions: detail.deletions,
        commentsCount: detail.comments,
      },
    });
  }

  console.log(`Backfilled ${prList.length} pull requests`);
}

async function main() {
  const target = process.argv[2];
  if (!target || !target.includes('/')) {
    throw new Error('Usage: backfill.ts <owner>/<repo>');
  }
  const [owner, repo] = target.split('/');
  const logger = new ExtractionLogger(target);

  const overallStart = Date.now();
  const repository = await ensureRepository(owner, repo, logger);
  console.log(`Repository ${repository.fullName} ready (id: ${repository.id})`);

  await timed('commits', logger, () => backfillCommits(owner, repo, repository.id, logger));
  await timed('issues', logger, () => backfillIssues(owner, repo, repository.id, logger));
  await timed('pull_requests', logger, () => backfillPullRequests(owner, repo, repository.id, logger));

  const totalMs = Date.now() - overallStart;
  console.log(`\nTotal extraction time: ${(totalMs / 1000).toFixed(1)}s`);

  logger.writeSummary();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// usage: pnpm exec tsx src/scripts/backfill.ts <owner>/<repo>
// need to install tsx via pnpm add -D tsx