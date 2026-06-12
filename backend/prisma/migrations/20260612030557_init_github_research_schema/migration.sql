-- CreateEnum
CREATE TYPE "GitHubEntityType" AS ENUM ('REPOSITORY', 'ISSUE', 'PULL_REQUEST', 'COMMIT');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "GitHubToken" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "githubLogin" TEXT,
    "githubUserId" BIGINT,
    "encryptedToken" TEXT NOT NULL,
    "tokenPreview" TEXT NOT NULL,
    "scopes" TEXT[],
    "rateLimit" INTEGER,
    "rateRemaining" INTEGER,
    "rateResetAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "githubId" BIGINT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "description" TEXT,
    "defaultBranch" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isFork" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "openIssues" INTEGER NOT NULL DEFAULT 0,
    "pushedAt" TIMESTAMP(3),
    "githubCreatedAt" TIMESTAMP(3),
    "githubUpdatedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryArtifact" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "type" "GitHubEntityType" NOT NULL,
    "githubNodeId" TEXT,
    "githubNumber" INTEGER,
    "githubSha" TEXT,
    "title" TEXT,
    "state" TEXT,
    "authorLogin" TEXT,
    "htmlUrl" TEXT,
    "mergedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "githubCreatedAt" TIMESTAMP(3),
    "githubUpdatedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepositoryArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitySnapshot" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "artifactId" TEXT,
    "entityType" "GitHubEntityType" NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectionRunId" TEXT,

    CONSTRAINT "EntitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionRun" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT,
    "tokenId" TEXT,
    "status" "CollectionStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'github_api',
    "requestedBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "issuesCount" INTEGER NOT NULL DEFAULT 0,
    "pullsCount" INTEGER NOT NULL DEFAULT 0,
    "commitsCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GitHubToken_githubLogin_idx" ON "GitHubToken"("githubLogin");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_githubId_key" ON "Repository"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_fullName_key" ON "Repository"("fullName");

-- CreateIndex
CREATE INDEX "Repository_owner_name_idx" ON "Repository"("owner", "name");

-- CreateIndex
CREATE INDEX "Repository_language_idx" ON "Repository"("language");

-- CreateIndex
CREATE INDEX "RepositoryArtifact_repositoryId_type_idx" ON "RepositoryArtifact"("repositoryId", "type");

-- CreateIndex
CREATE INDEX "RepositoryArtifact_authorLogin_idx" ON "RepositoryArtifact"("authorLogin");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryArtifact_repositoryId_type_githubNodeId_key" ON "RepositoryArtifact"("repositoryId", "type", "githubNodeId");

-- CreateIndex
CREATE INDEX "EntitySnapshot_repositoryId_entityType_idx" ON "EntitySnapshot"("repositoryId", "entityType");

-- CreateIndex
CREATE INDEX "EntitySnapshot_capturedAt_idx" ON "EntitySnapshot"("capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EntitySnapshot_repositoryId_artifactId_entityType_payloadHa_key" ON "EntitySnapshot"("repositoryId", "artifactId", "entityType", "payloadHash");

-- CreateIndex
CREATE INDEX "CollectionRun_status_idx" ON "CollectionRun"("status");

-- CreateIndex
CREATE INDEX "CollectionRun_startedAt_idx" ON "CollectionRun"("startedAt");

-- AddForeignKey
ALTER TABLE "RepositoryArtifact" ADD CONSTRAINT "RepositoryArtifact_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitySnapshot" ADD CONSTRAINT "EntitySnapshot_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitySnapshot" ADD CONSTRAINT "EntitySnapshot_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "RepositoryArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitySnapshot" ADD CONSTRAINT "EntitySnapshot_collectionRunId_fkey" FOREIGN KEY ("collectionRunId") REFERENCES "CollectionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionRun" ADD CONSTRAINT "CollectionRun_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionRun" ADD CONSTRAINT "CollectionRun_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "GitHubToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
