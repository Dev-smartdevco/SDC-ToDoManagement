-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Project_isDefault_idx" ON "Project"("isDefault");
