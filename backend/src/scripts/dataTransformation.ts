import 'dotenv/config'
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { finalization } from 'node:process';


const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const DAY_MS = 86400000
const DAYS_IN_MONTH = 30
const TODAY = Date.now()

async function getCommitMetrics(repository_id: string) {
    const repos = await prisma.repository.findMany() // get all repos in db
    const repo = repos[repos.length-1].id // get specific repo id
    // get commits for specific repo
    const commits = await prisma.repositoryArtifact.findMany({
        where: {repositoryId: repo, type: 'COMMIT'},
        orderBy: {githubCreatedAt: 'asc'},
    });
    const test = commits[commits.length-1]
    console.log(test)
    
    
    // const commitActivity = getActiveStatus(commits)
    // const commitCadence = getCommitCadence(commits)
    // const commitBusFactor = getCommitBusFactor(commits)

    // return {commitCadence, commitBusFactor}
}

function getCommitCadence(commits:any) {
    // commit cadence: avg days between commits
    const dates = commits.map(c => new Date(c.githubCreatedAt!).getTime()).sort((a:any,b:any)=>a-b)
    const gaps = dates.slice(1).map((d:any, i:any) => (d - dates[i]) / DAY_MS)
    const avgCadenceDays = gaps.reduce((a, b)=>a+b, 0) / gaps.length

    
    return {avgCadenceDays} 
}
async function getCommitBusFactor(commits: any) {
    // bus factor: contributors needed to cover 50% of commits
    const counts = new Map<string, number>();
    for (const c of commits) counts.set(c.authorLogin ?? 'unknown', (counts.get(c.authorLogin ?? 'unknown') ?? 0) + 1)
        const sorted = [...counts.values()].sort((a:any,b:any)=>b-a);
    const total = commits.length
    let cumilative = 0, busFactor = 0;
    for (const n of sorted) {cumilative += n; busFactor++; if (cumilative >= total/2) break;}
    return {busFactor, totalCommits: total, contributors: counts.size}}

function getActiveStatus(commits: any) {
    // active if last commit was < 1 month ago, inactive otherwise
    const finalIdx = commits.length - 1
    const lastCommit = commits[finalIdx].githubCreatedAt
    // const secondLastCommit = commits[finalIdx-1].githubCreatedAt
    const difference = ((TODAY - new Date(lastCommit).getTime()) / DAY_MS )
    const activeStatus = difference < DAYS_IN_MONTH
    // console.log(`Final:  ${lastCommit}, Now: ${today}, active: ${activeStatus}`)
    return activeStatus
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
        const gaps = sorted.slice(1).map((t, i) => (t - sorted[i]) / 86_400_000)
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

async function main() {
    const target = process.argv[2];
    if (!target) {
        throw new Error('Usage: dataTransformation.ts repository_id');
    }
    console.log("extracted data: ", await getCommitMetrics(target))
    await prisma.$disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1)
});