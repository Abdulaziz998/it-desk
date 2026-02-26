-- CreateEnum
CREATE TYPE "public"."OrganizationPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "public"."OrganizationPlanStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'UNPAID');

-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "plan" "public"."OrganizationPlan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "planStatus" "public"."OrganizationPlanStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "public"."OrganizationSetting" ADD COLUMN     "auditLogRetentionDays" INTEGER NOT NULL DEFAULT 90;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "public"."Organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeSubscriptionId_key" ON "public"."Organization"("stripeSubscriptionId");

