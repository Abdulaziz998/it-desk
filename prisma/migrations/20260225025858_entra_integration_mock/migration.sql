-- CreateEnum
CREATE TYPE "public"."IntegrationProvider" AS ENUM ('entra');

-- CreateEnum
CREATE TYPE "public"."IntegrationActionStatus" AS ENUM ('SUCCESS', 'FAILED');

-- AlterEnum
ALTER TYPE "public"."AccessRequestStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "public"."AccessRequest" ADD COLUMN     "appRoleName" TEXT,
ADD COLUMN     "targetGroupId" TEXT,
ADD COLUMN     "targetUpn" TEXT;

-- CreateTable
CREATE TABLE "public"."EntraIntegration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "public"."IntegrationProvider" NOT NULL DEFAULT 'entra',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntraIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntegrationActionLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "public"."IntegrationProvider" NOT NULL,
    "action" TEXT NOT NULL,
    "targetUpn" TEXT,
    "targetGroupId" TEXT,
    "accessRequestId" TEXT,
    "status" "public"."IntegrationActionStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntraIntegration_orgId_idx" ON "public"."EntraIntegration"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "EntraIntegration_orgId_provider_key" ON "public"."EntraIntegration"("orgId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationActionLog_orgId_provider_status_createdAt_idx" ON "public"."IntegrationActionLog"("orgId", "provider", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationActionLog_orgId_accessRequestId_idx" ON "public"."IntegrationActionLog"("orgId", "accessRequestId");

-- AddForeignKey
ALTER TABLE "public"."EntraIntegration" ADD CONSTRAINT "EntraIntegration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegrationActionLog" ADD CONSTRAINT "IntegrationActionLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegrationActionLog" ADD CONSTRAINT "IntegrationActionLog_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "public"."AccessRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
