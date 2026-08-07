-- AlterTable
DELETE FROM "ChatPrompt";

ALTER TABLE "ChatPrompt" ADD COLUMN "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ChatPrompt_userId_idx" ON "ChatPrompt"("userId");

-- AddForeignKey
ALTER TABLE "ChatPrompt" ADD CONSTRAINT "ChatPrompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
