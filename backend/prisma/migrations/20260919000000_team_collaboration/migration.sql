CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MEMBER', 'VIEWER');
CREATE TYPE "ProjectMemberRole" AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE "ActivityType" AS ENUM (
  'TASK_CREATED',
  'TASK_ASSIGNED',
  'USER_ADDED',
  'USER_REMOVED',
  'STATUS_CHANGED',
  'PRIORITY_CHANGED',
  'DUE_DATE_CHANGED',
  'COMMENT_ADDED',
  'TASK_COMPLETED',
  'PROJECT_MEMBER_ADDED',
  'PROJECT_MEMBER_REMOVED',
  'TASK_BLOCKED',
  'RECOGNITION_CREATED'
);
CREATE TYPE "NotificationType" AS ENUM (
  'TASK_ASSIGNED',
  'COMMENT_ADDED',
  'PROJECT_ADDED',
  'DEADLINE_SOON',
  'TASK_COMPLETED',
  'RECOGNITION'
);
CREATE TYPE "RecognitionVisibility" AS ENUM ('EVERYONE', 'TEAM', 'PROJECT');
CREATE TYPE "RewardRuleType" AS ENUM (
  'TASK_COMPLETED',
  'HIGH_PRIORITY_COMPLETED',
  'PROJECT_COMPLETED',
  'HELPING_TEAMMATE',
  'STREAK_7'
);
CREATE TYPE "AchievementCondition" AS ENUM (
  'TASKS_COMPLETED',
  'PROJECT_COMPLETED',
  'TEAM_PLAYER',
  'STREAK',
  'TOP_CONTRIBUTOR'
);

ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';

ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "xp" INTEGER NOT NULL DEFAULT 0;

UPDATE "User" SET "role" = 'SUPER_ADMIN';

ALTER TABLE "Task"
  ADD COLUMN "blockedReason" TEXT,
  ADD COLUMN "blockedById" TEXT,
  ADD COLUMN "blockedAt" TIMESTAMP(3);

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_blockedById_fkey"
  FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");

CREATE TABLE "ProjectMember" (
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ProjectMemberRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId", "userId")
);

CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

ALTER TABLE "ProjectMember"
  ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ProjectMember" ("projectId", "userId", "role", "joinedAt")
SELECT "id", "userId", 'OWNER', "createdAt" FROM "Project"
ON CONFLICT ("projectId", "userId") DO NOTHING;

CREATE TABLE "TaskAssignee" (
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId", "userId")
);

CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");

ALTER TABLE "TaskAssignee"
  ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "TaskAssignee" ("taskId", "userId", "isPrimary", "createdAt")
SELECT "id", "userId", true, "createdAt" FROM "Task"
ON CONFLICT ("taskId", "userId") DO NOTHING;

CREATE TABLE "TaskComment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");

ALTER TABLE "TaskComment"
  ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ActivityLog" (
  "id" TEXT NOT NULL,
  "type" "ActivityType" NOT NULL,
  "actorId" TEXT NOT NULL,
  "userId" TEXT,
  "taskId" TEXT,
  "projectId" TEXT,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX "ActivityLog_projectId_createdAt_idx" ON "ActivityLog"("projectId", "createdAt");
CREATE INDEX "ActivityLog_taskId_createdAt_idx" ON "ActivityLog"("taskId", "createdAt");

ALTER TABLE "ActivityLog"
  ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ActivityLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ActivityLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "taskId" TEXT,
  "projectId" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Achievement" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "icon" TEXT NOT NULL DEFAULT 'trophy',
  "condition" "AchievementCondition" NOT NULL,
  "threshold" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

CREATE TABLE "UserAchievement" (
  "userId" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("userId", "achievementId")
);

ALTER TABLE "UserAchievement"
  ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Recognition" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "projectId" TEXT,
  "taskId" TEXT,
  "achievementId" TEXT,
  "message" TEXT NOT NULL,
  "visibility" "RecognitionVisibility" NOT NULL DEFAULT 'EVERYONE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Recognition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Recognition_createdAt_idx" ON "Recognition"("createdAt");
CREATE INDEX "Recognition_recipientId_createdAt_idx" ON "Recognition"("recipientId", "createdAt");

ALTER TABLE "Recognition"
  ADD CONSTRAINT "Recognition_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Recognition_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Recognition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Recognition_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RewardRule" (
  "id" TEXT NOT NULL,
  "type" "RewardRuleType" NOT NULL,
  "points" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RewardRule_type_key" ON "RewardRule"("type");

CREATE TABLE "FileLink" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "taskId" TEXT,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FileLink_projectId_idx" ON "FileLink"("projectId");
CREATE INDEX "FileLink_taskId_idx" ON "FileLink"("taskId");

ALTER TABLE "FileLink"
  ADD CONSTRAINT "FileLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FileLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "FileLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SystemSetting" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

INSERT INTO "Achievement" ("id", "key", "name", "description", "icon", "condition", "threshold", "active", "createdAt")
VALUES
  (gen_random_uuid()::text, 'first_task', 'First Task', 'Complete your first task.', 'sparkles', 'TASKS_COMPLETED', 1, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'tasks_5', '5 Tasks Completed', 'Complete 5 tasks.', 'check-circle', 'TASKS_COMPLETED', 5, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'tasks_10', '10 Tasks Completed', 'Complete 10 tasks.', 'medal', 'TASKS_COMPLETED', 10, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'tasks_50', '50 Tasks Completed', 'Complete 50 tasks.', 'trophy', 'TASKS_COMPLETED', 50, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'project_completed', 'Project Completed', 'Complete a project.', 'flag', 'PROJECT_COMPLETED', 1, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'team_player', 'Team Player', 'Complete 5 tasks owned by teammates.', 'users', 'TEAM_PLAYER', 5, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'streak_7', '7-Day Activity Streak', 'Complete tasks on 7 consecutive days.', 'flame', 'STREAK', 7, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'top_contributor', 'Top Contributor', 'Lead the team in completed tasks this week.', 'star', 'TOP_CONTRIBUTOR', 1, true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RewardRule" ("id", "type", "points", "active", "createdAt")
VALUES
  (gen_random_uuid()::text, 'TASK_COMPLETED', 10, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'HIGH_PRIORITY_COMPLETED', 20, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'PROJECT_COMPLETED', 100, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'HELPING_TEAMMATE', 15, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'STREAK_7', 50, true, CURRENT_TIMESTAMP)
ON CONFLICT ("type") DO NOTHING;
