import 'dotenv/config'
import * as crypto from 'node:crypto';
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

function hashPayload(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

// what is T?
async function fetchAllPages<T>(url: string): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
        const res = await fetch(nextUrl, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN_SECRET}`,
                Accept: 'application/vnd.github+json',
                // what is application/vnd.github+json?
            },
        });
    
        if (!res.ok) {
            throw new Error(`GitHJub API ${res.status}: ${await res.text()}`)
        }
        
        // get remaining limit for fetching
        const remaining = res.headers.get('x-ratelimit-remaining');
        if (remaining && parseInt(remaining, 10) < 5) {
            const resetAt = parseInt(res.headers.get('x-ratelimit-reset') || '0', 10) * 1000;
            const waitMs = resetAt - Date.now();
            if (waitMs > 0) {
                console.log(`Rate limit low, waiting ${Math.ceil(waitMs / 1000)}s...`)
                await new Promise((r) => setTimeout(r, waitMs))
            }
        }

        const data = await(res.json()) as T[];
        results.push(...data);

        const linkHeader = res.headers.get('link');
        const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
        nextUrl = nextMatch ? nextMatch[1] : null;
    }

    return results;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN_SECRET}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// Look up or create the Repository row, keyed on the real githubId/fullName.
async function ensureRepository(owner: string, repo: string) {
  const data = await fetchJson<any>(`${BASE}/repos/${owner}/${repo}`);
 
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

/**
 * Ensure a RepositoryArtifact row exists for this entity 
 * (the "identity" row one per issue/PR/commit, regardless of how many times it's been captured),
 * then insert a new EntitySnapshot only if the payload actually changed.
 */
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
    update: {}, // identical content already recorded — no-op
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


/**
 * Fetch and persist all commits for a repo
 */

async function backfillCommits(owner:string, repo:string, repositoryId: string) {
    const commits = await fetchAllPages<any>(`${BASE}/repos/${owner}/${repo}/commits?per_page=100`);
 
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


async function main() {
    const target = process.argv[2]; // get owner/repo from command line
    if (!target || !target.includes('/')) {
        throw new Error('Usage: backfill.ts <owner>/<repo>');
    }
    const [owner, repo] = target.split('/');
    
    const repository = await ensureRepository(owner, repo);
    console.log(`Repository ${repository.fullName} ready (id: ${repository.id})`);
    
    await backfillCommits(owner, repo, repository.id)
    
    await prisma.$disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
})