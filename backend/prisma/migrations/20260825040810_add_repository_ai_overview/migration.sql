-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "aiCommitsOverview" TEXT,
ADD COLUMN     "aiCommitsOverviewGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "aiIssuesOverview" TEXT,
ADD COLUMN     "aiIssuesOverviewGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "aiPullsOverview" TEXT,
ADD COLUMN     "aiPullsOverviewGeneratedAt" TIMESTAMP(3);
