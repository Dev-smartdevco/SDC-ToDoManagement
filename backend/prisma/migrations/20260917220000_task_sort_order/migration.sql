-- AlterTable
ALTER TABLE "Task" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill unique order per user + parent
UPDATE "Task" AS t
SET "sortOrder" = sub.rn
FROM (
  SELECT
    id,
    (ROW_NUMBER() OVER (
      PARTITION BY "userId", COALESCE("parentTaskId", '')
      ORDER BY "createdAt" ASC, id ASC
    ) - 1)::INTEGER AS rn
  FROM "Task"
) AS sub
WHERE t.id = sub.id;

-- CreateIndex
CREATE INDEX "Task_userId_sortOrder_idx" ON "Task"("userId", "sortOrder");
