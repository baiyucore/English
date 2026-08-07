-- DropIndex
DROP INDEX IF EXISTS "ChatPrompt_role_key";

-- AlterTable
ALTER TABLE "ChatPrompt" DROP COLUMN "role",
DROP COLUMN "label";
