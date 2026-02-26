-- CreateTable
CREATE TABLE "public"."JobRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "message" TEXT,
    "jsonResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobRun_orgId_startedAt_idx" ON "public"."JobRun"("orgId", "startedAt");

-- CreateIndex
CREATE INDEX "JobRun_jobType_startedAt_idx" ON "public"."JobRun"("jobType", "startedAt");

-- CreateIndex
CREATE INDEX "JobRun_status_startedAt_idx" ON "public"."JobRun"("status", "startedAt");

-- AddForeignKey
ALTER TABLE "public"."JobRun" ADD CONSTRAINT "JobRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
