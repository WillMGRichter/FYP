-- AlterTable
ALTER TABLE "CollectionRun" ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "GitHubToken" ADD COLUMN     "accountId" TEXT;

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StarredRepository" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StarredRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountContribution" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "commitsCount" INTEGER NOT NULL DEFAULT 0,
    "issuesCount" INTEGER NOT NULL DEFAULT 0,
    "pullsCount" INTEGER NOT NULL DEFAULT 0,
    "lastObservedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AccountSession_tokenHash_key" ON "AccountSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountSession_accountId_idx" ON "AccountSession"("accountId");

-- CreateIndex
CREATE INDEX "AccountSession_expiresAt_idx" ON "AccountSession"("expiresAt");

-- CreateIndex
CREATE INDEX "StarredRepository_repositoryId_idx" ON "StarredRepository"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "StarredRepository_accountId_repositoryId_key" ON "StarredRepository"("accountId", "repositoryId");

-- CreateIndex
CREATE INDEX "AccountContribution_accountId_idx" ON "AccountContribution"("accountId");

-- CreateIndex
CREATE INDEX "AccountContribution_githubLogin_idx" ON "AccountContribution"("githubLogin");

-- CreateIndex
CREATE UNIQUE INDEX "AccountContribution_accountId_repositoryId_githubLogin_key" ON "AccountContribution"("accountId", "repositoryId", "githubLogin");

-- CreateIndex
CREATE INDEX "CollectionRun_accountId_idx" ON "CollectionRun"("accountId");

-- CreateIndex
CREATE INDEX "GitHubToken_accountId_idx" ON "GitHubToken"("accountId");

-- AddForeignKey
ALTER TABLE "AccountSession" ADD CONSTRAINT "AccountSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubToken" ADD CONSTRAINT "GitHubToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionRun" ADD CONSTRAINT "CollectionRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarredRepository" ADD CONSTRAINT "StarredRepository_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarredRepository" ADD CONSTRAINT "StarredRepository_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountContribution" ADD CONSTRAINT "AccountContribution_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountContribution" ADD CONSTRAINT "AccountContribution_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
