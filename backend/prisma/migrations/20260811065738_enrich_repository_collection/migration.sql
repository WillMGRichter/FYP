-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "license" TEXT,
ADD COLUMN     "topics" TEXT[];

-- AlterTable
ALTER TABLE "RepositoryArtifact" ADD COLUMN     "additions" INTEGER,
ADD COLUMN     "changedFiles" INTEGER,
ADD COLUMN     "deletions" INTEGER;

-- CreateTable
CREATE TABLE "EntityComment" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "githubNodeId" TEXT,
    "authorLogin" TEXT,
    "body" TEXT,
    "githubCreatedAt" TIMESTAMP(3),
    "githubUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PullRequestReview" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "githubNodeId" TEXT,
    "authorLogin" TEXT,
    "state" TEXT,
    "body" TEXT,
    "submittedAt" TIMESTAMP(3),
    "githubCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PullRequestReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "githubNodeId" TEXT,
    "tagName" TEXT NOT NULL,
    "name" TEXT,
    "prerelease" BOOLEAN NOT NULL DEFAULT false,
    "draft" BOOLEAN NOT NULL DEFAULT false,
    "authorLogin" TEXT,
    "publishedAt" TIMESTAMP(3),
    "htmlUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contributor" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "contributions" INTEGER NOT NULL DEFAULT 0,
    "htmlUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contributor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityComment_repositoryId_idx" ON "EntityComment"("repositoryId");

-- CreateIndex
CREATE INDEX "EntityComment_authorLogin_idx" ON "EntityComment"("authorLogin");

-- CreateIndex
CREATE UNIQUE INDEX "EntityComment_artifactId_githubNodeId_key" ON "EntityComment"("artifactId", "githubNodeId");

-- CreateIndex
CREATE INDEX "PullRequestReview_repositoryId_idx" ON "PullRequestReview"("repositoryId");

-- CreateIndex
CREATE INDEX "PullRequestReview_authorLogin_idx" ON "PullRequestReview"("authorLogin");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequestReview_artifactId_githubNodeId_key" ON "PullRequestReview"("artifactId", "githubNodeId");

-- CreateIndex
CREATE INDEX "Release_publishedAt_idx" ON "Release"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Release_repositoryId_tagName_key" ON "Release"("repositoryId", "tagName");

-- CreateIndex
CREATE INDEX "Contributor_login_idx" ON "Contributor"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Contributor_repositoryId_login_key" ON "Contributor"("repositoryId", "login");

-- AddForeignKey
ALTER TABLE "EntityComment" ADD CONSTRAINT "EntityComment_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityComment" ADD CONSTRAINT "EntityComment_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "RepositoryArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PullRequestReview" ADD CONSTRAINT "PullRequestReview_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PullRequestReview" ADD CONSTRAINT "PullRequestReview_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "RepositoryArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contributor" ADD CONSTRAINT "Contributor_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
