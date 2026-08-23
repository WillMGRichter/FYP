-- CreateEnum
CREATE TYPE "DataSensitivity" AS ENUM ('PUBLIC', 'CONTAINS_PII', 'SENSITIVE_SECURITY', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "CaptureVisibility" AS ENUM ('PUBLIC', 'PRIVATE_AUTHENTICATED', 'ORG_INTERNAL');

-- CreateEnum
CREATE TYPE "LegalBasis" AS ENUM ('PUBLIC_TASK_RESEARCH', 'LEGITIMATE_INTEREST', 'CONSENT');

-- CreateEnum
CREATE TYPE "SubjectRequestType" AS ENUM ('ACCESS', 'ERASURE', 'RECTIFICATION', 'OBJECTION');

-- CreateEnum
CREATE TYPE "SubjectRequestStatus" AS ENUM ('RECEIVED', 'IN_REVIEW', 'COMPLETED', 'REJECTED');

-- AlterTable
ALTER TABLE "CollectionRun" ADD COLUMN     "ethicsApprovalId" TEXT,
ADD COLUMN     "legalBasis" "LegalBasis" DEFAULT 'PUBLIC_TASK_RESEARCH';

-- AlterTable
ALTER TABLE "EntitySnapshot" ADD COLUMN     "containsPii" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "redacted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "redactedAt" TIMESTAMP(3),
ADD COLUMN     "redactedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "retentionExpiresAt" TIMESTAMP(3),
ADD COLUMN     "sensitivity" "DataSensitivity" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "visibilityAtCapture" "CaptureVisibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "GitHubToken" ADD COLUMN     "consentAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "revokedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "licenseName" TEXT,
ADD COLUMN     "licenseSpdxId" TEXT;

-- AlterTable
ALTER TABLE "RepositoryArtifact" ADD COLUMN     "authorContributorId" TEXT,
ADD COLUMN     "isSecurityAdvisory" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EthicsApproval" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "retentionPeriodDays" INTEGER,

    CONSTRAINT "EthicsApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributorIdentity" (
    "id" TEXT NOT NULL,
    "pseudonymId" TEXT NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "githubUserId" BIGINT,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "optedOutAt" TIMESTAMP(3),
    "erasureRequested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContributorIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSubjectRequest" (
    "id" TEXT NOT NULL,
    "contributorIdentityId" TEXT,
    "accountId" TEXT,
    "requestType" "SubjectRequestType" NOT NULL,
    "status" "SubjectRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "requestedVia" TEXT NOT NULL,
    "details" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,

    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "purpose" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EthicsApproval_referenceCode_key" ON "EthicsApproval"("referenceCode");

-- CreateIndex
CREATE INDEX "EthicsApproval_expiresAt_idx" ON "EthicsApproval"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContributorIdentity_pseudonymId_key" ON "ContributorIdentity"("pseudonymId");

-- CreateIndex
CREATE UNIQUE INDEX "ContributorIdentity_githubLogin_key" ON "ContributorIdentity"("githubLogin");

-- CreateIndex
CREATE UNIQUE INDEX "ContributorIdentity_githubUserId_key" ON "ContributorIdentity"("githubUserId");

-- CreateIndex
CREATE INDEX "ContributorIdentity_optedOut_idx" ON "ContributorIdentity"("optedOut");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_status_idx" ON "DataSubjectRequest"("status");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_contributorIdentityId_idx" ON "DataSubjectRequest"("contributorIdentityId");

-- CreateIndex
CREATE INDEX "AuditLog_accountId_idx" ON "AuditLog"("accountId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "CollectionRun_ethicsApprovalId_idx" ON "CollectionRun"("ethicsApprovalId");

-- CreateIndex
CREATE INDEX "EntitySnapshot_sensitivity_idx" ON "EntitySnapshot"("sensitivity");

-- CreateIndex
CREATE INDEX "EntitySnapshot_retentionExpiresAt_idx" ON "EntitySnapshot"("retentionExpiresAt");

-- CreateIndex
CREATE INDEX "RepositoryArtifact_authorContributorId_idx" ON "RepositoryArtifact"("authorContributorId");

-- AddForeignKey
ALTER TABLE "RepositoryArtifact" ADD CONSTRAINT "RepositoryArtifact_authorContributorId_fkey" FOREIGN KEY ("authorContributorId") REFERENCES "ContributorIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionRun" ADD CONSTRAINT "CollectionRun_ethicsApprovalId_fkey" FOREIGN KEY ("ethicsApprovalId") REFERENCES "EthicsApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_contributorIdentityId_fkey" FOREIGN KEY ("contributorIdentityId") REFERENCES "ContributorIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
