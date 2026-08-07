-- CreateEnum
CREATE TYPE "LlmRunStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "LlmRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "conversationId" TEXT,
    "scene" TEXT NOT NULL DEFAULT '自由对话',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "firstTokenMs" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "costCents" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityScore" INTEGER,
    "status" "LlmRunStatus" NOT NULL DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmRun_createdAt_idx" ON "LlmRun"("createdAt");

-- CreateIndex
CREATE INDEX "LlmRun_userId_createdAt_idx" ON "LlmRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LlmRun_model_createdAt_idx" ON "LlmRun"("model", "createdAt");

-- CreateIndex
CREATE INDEX "LlmRun_status_idx" ON "LlmRun"("status");

-- AddForeignKey
ALTER TABLE "LlmRun" ADD CONSTRAINT "LlmRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
