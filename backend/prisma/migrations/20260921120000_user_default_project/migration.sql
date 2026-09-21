-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultProjectId" TEXT;

-- Backfill: each user who owns or belongs to a former global-default project keeps it as their personal default
UPDATE "User" AS u
SET "defaultProjectId" = p.id
FROM "Project" AS p
WHERE p."isDefault" = true
  AND u."defaultProjectId" IS NULL
  AND (
    p."userId" = u.id
    OR EXISTS (
      SELECT 1 FROM "ProjectMember" AS m
      WHERE m."projectId" = p.id AND m."userId" = u.id
    )
  );

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_defaultProjectId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_defaultProjectId_fkey"
      FOREIGN KEY ("defaultProjectId") REFERENCES "Project"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "Project_isDefault_idx";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN IF EXISTS "isDefault";
