import 'dotenv/config'
import * as fs from 'node:fs'
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";


const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const DAY_MS = 86400000
const DAYS_IN_MONTH = 30
const TODAY = Date.now()

function getCommitCadence(commits:any) {
    // commit cadence: avg days between commits
    const dates = commits.map((c: any) => new Date(c.githubCreatedAt!).getTime()).sort((a:any,b:any)=>a-b)
    const gaps = dates.slice(1).map((d:any, i:any) => (d - dates[i]) / DAY_MS)
    const avgCadenceDays = gaps.reduce((a:number, b:number)=>a+b, 0) / gaps.length

    
    return {avgCadenceDays} 
}

function getCommitBusFactor(commits: any) {
    // bus factor: contributors needed to cover 50% of commits
    const counts = new Map<string, number>();
    for (const c of commits) counts.set(c.authorLogin ?? 'unknown', (counts.get(c.authorLogin ?? 'unknown') ?? 0) + 1)
    const sorted = [...counts.values()].sort((a:any,b:any)=>b-a);
    const total = commits.length
    let cumilative = 0, busFactor = 0;
    for (const n of sorted) {
        cumilative += n; busFactor++; if (cumilative >= total/2) break;
    }
    return { busFactor, totalCommits: total, contributors: counts.size }
}

function getActiveStatus(commits: any) {
    // active if last commit was < 1 month ago, inactive otherwise
    const finalIdx = commits.length - 1
    const lastCommit = commits[finalIdx].githubCreatedAt
    // const secondLastCommit = commits[finalIdx-1].githubCreatedAt
    const daysSinceLastCommit = ((TODAY - new Date(lastCommit).getTime()) / DAY_MS )
    const activeStatus = daysSinceLastCommit < DAYS_IN_MONTH
    // console.log(`Final:  ${lastCommit}, Now: ${today}, active: ${activeStatus}`)
    return { activeStatus, daysSinceLastCommit }
}

function getContributorInterest(commits: any) {
    // avg duration between contributor activity
    const byAuthor = new Map<string, number[]>()

    for (const c of commits) {
        if (!c.authorLogin || !c.githubCreatedAt) continue
        const ts = new Date(c.githubCreatedAt).getTime()
        if (!byAuthor.has(c.authorLogin)) byAuthor.set(c.authorLogin, [])
        byAuthor.get(c.authorLogin)!.push(ts)
    }

    const perAuthorAvgGapDays: { author: string; avgGapDays: number; commitCount: number }[] = []

    for (const [author, timestamps] of byAuthor) {
        if (timestamps.length < 2) continue // need at least 2 commits to have a gap
        const sorted = [...timestamps].sort((a, b) => a - b)
        const gaps = sorted.slice(1).map((t, i) => (t - sorted[i]) / DAY_MS)
        const avgGapDays = gaps.reduce((a, b) => a + b, 0) / gaps.length
        perAuthorAvgGapDays.push({ author, avgGapDays, commitCount: timestamps.length })
    }

      const overallAvgGapDays = perAuthorAvgGapDays.length
    ? perAuthorAvgGapDays.reduce((a, b) => a + b.avgGapDays, 0) / perAuthorAvgGapDays.length
    : NaN // no contributor had 2+ commits - can't measure return interval
 
    return {
        overallAvgGapDays,
        eligibleContributors: perAuthorAvgGapDays.length, // contributors with 2+ commits
        excludedSingleCommitContributors: byAuthor.size - perAuthorAvgGapDays.length,
        perAuthor: perAuthorAvgGapDays,
    }
}

function getContributorCount(commits: any) {
    // get number of contributors on a specific repository
    const authors = new Set(
        commits.map((c: any) => c.authorLogin).filter((a: string | null) => !!a)
    )
    return authors.size
}

async function getCommitMetrics(repository_id: string) {
    // compute commits metrics for one singular repo
    const commits = await prisma.repositoryArtifact.findMany({
        where: {repositoryId: repository_id, type: 'COMMIT'},
        orderBy: {githubCreatedAt: 'asc'},
    });
    
    const activity = getActiveStatus(commits)
    const cadence = getCommitCadence(commits)
    const busFactor = getCommitBusFactor(commits)
    const contributorInterest = getContributorInterest(commits)
    const contributorCount = getContributorCount(commits)
    
    return {
        commitCount: commits.length,
        avgCadenceDays: cadence.avgCadenceDays,
        busFactor: busFactor.busFactor,
        contributorCount,
        activeStatus: activity.activeStatus,
        daysSinceLastCommit: activity.daysSinceLastCommit,
        avgContributorReturnDays: contributorInterest.overallAvgGapDays,
        eligibleContributors: contributorInterest.eligibleContributors,
    }
}

async function runBatch() {
    // run commit metric analysis on all repos

    // get all repos
    const repos = await prisma.repository.findMany({
        select: { id: true, fullName: true },
    });
    console.log(`Found ${repos.length} repositories`)

    const rows: Record<string, any>[] = [];
    const failures: { fullName: string; error: string }[] = []

    for (const [i, repo] of repos.entries()) {
        const start = Date.now();
        try {
            const metrics = await getCommitMetrics(repo.id);
            const durationMs = Date.now() - start;
            rows.push({ repositoryId: repo.id, fullName: repo.fullName, ...metrics, durationMs});
        } catch (err: any) {
            failures.push({ fullName: repo.fullName, error: err.message});
            console.error(`[${i+1}/${repos.length}] ${repo.fullName} - FAILED: ${err.message}`);
        }
    }

    if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        const csvLines = [
            headers.join(','),
            ...rows.map(r => headers.map(h => {
                const v = r[h];
                if (v === null || v === undefined) return '';
                if (typeof v === 'string' && v.includes(',')) return `"${v}"`;
                return v;
            }).join(',')),
        ];
        fs.writeFileSync('repo_metrics.csv', csvLines.join('\n'));
        console.log(`\nWrote ${rows.length} rows to repo_metrics.csv`)
    }

    if (failures.length > 0 ) {
        fs.writeFileSync(`repo_metrics_failures.json`, JSON.stringify(failures, null, 2))
        console.log(`${failures.length} repo(s) failed - see repo_metrics_failures.json`)
    }
}


async function main() {
    await runBatch();
    await prisma.$disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1)
});