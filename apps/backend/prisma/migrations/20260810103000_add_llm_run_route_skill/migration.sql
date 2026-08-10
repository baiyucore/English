-- AlterTable
ALTER TABLE "LlmRun" ADD COLUMN "route" TEXT;
ALTER TABLE "LlmRun" ADD COLUMN "skillId" TEXT;

-- CreateIndex
CREATE INDEX "LlmRun_route_createdAt_idx" ON "LlmRun"("route", "createdAt");

-- CreateIndex
CREATE INDEX "LlmRun_skillId_createdAt_idx" ON "LlmRun"("skillId", "createdAt");
