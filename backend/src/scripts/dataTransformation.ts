import 'dotenv/config'
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";


const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function getCommitMetrics(repository_id: string) {
    const repos = await prisma.repository.findMany()
    const repo = repos[0].id
    console.log(repos[0])
    const test = await prisma.repositoryArtifact.findMany()
    const commits = await prisma.repositoryArtifact.findMany({
        where: {repositoryId: repo, type: 'COMMIT'},
        orderBy: {githubCreatedAt: 'asc'},
    });
    console.log(commits)
    const commitCadence = getCommitCadence(commits)
    const commitBusFactor = getCommitBusFactor(commits)

    return {commitCadence, commitBusFactor}
}

function getCommitCadence(commits:any) {
    // commit cadence: avg days between commits
    const dates = commits.map(c => new Date(c.githubCreatedAt!).getTime()).sort((a:any,b:any)=>a-b)
    const gaps = dates.slice(1).map((d:any, i:any) => (d - dates[i]) / 86_400_000)
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
}

function getReleaseCadence(releases: any) {
    // release cadence: avg duration between releases. Min x releases
}

function getCodeSize(commits: any) {
    // code size: how many lines of code are changed on average per commit
    // formula: 
    const avg = ""
    const med = ""
}

function getVolatileFiles(commits: any) {
    // Volative Files: files which are frequently updated
}

function getContributorInterest(commits: any) {
    // avg duration between contributor activity
}

function getContributorCount(commits: any) {
    // get number of contributors on a specific repository
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