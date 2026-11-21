ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_REASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_UNASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_DUE_DATE_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_PRIORITY_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_STATUS_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_REOPENED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_DELETED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_BLOCKED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_UNBLOCKED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_MENTIONED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_COMMENT_REPLIED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_ATTACHMENT_ADDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_CHECKLIST_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_MEMBER_REMOVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_STATUS_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_DEADLINE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_ARCHIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TEAM_MEMBER_JOINED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TEAM_MEMBER_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TEAM_TASK_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TEAM_MEMBER_BLOCKED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TEAM_ACTIVITY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEETING_INVITATION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEETING_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEETING_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEETING_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEETING_STARTING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NOTE_SHARED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NOTE_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NOTE_MENTIONED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NOTE_COMMENT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REWARD_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEVEL_UP';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACHIEVEMENT_UNLOCKED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STREAK';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DAILY_PLAN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'START_OF_DAY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'END_OF_DAY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WEEKLY_REVIEW';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INCOMPLETE_TASKS';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FOCUS_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_DEVICE_LOGIN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PASSWORD_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUSPICIOUS_LOGIN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEVICE_REGISTERED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SYSTEM_ANNOUNCEMENT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SYSTEM_MAINTENANCE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SYNC_ERROR';

CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS', 'WEB');

ALTER TABLE "Notification" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'System';
ALTER TABLE "Notification" ADD COLUMN "entityType" TEXT;
ALTER TABLE "Notification" ADD COLUMN "entityId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "deepLink" TEXT;
ALTER TABLE "Notification" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'Normal';
ALTER TABLE "Notification" ADD COLUMN "eventId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "metadata" JSONB;
ALTER TABLE "Notification" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Notification_eventId_key" ON "Notification"("eventId");
CREATE INDEX "Notification_userId_category_createdAt_idx" ON "Notification"("userId", "category", "createdAt");

CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Device_token_key" ON "Device"("token");
CREATE INDEX "Device_userId_active_idx" ON "Device"("userId", "active");
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sound" BOOLEAN NOT NULL DEFAULT true,
    "vibration" BOOLEAN NOT NULL DEFAULT true,
    "quietStart" TEXT,
    "quietEnd" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
    "lockScreenPreview" BOOLEAN NOT NULL DEFAULT true,
    "categories" JSONB NOT NULL,
    "reminders" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "deviceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ScheduledReminder" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fireAt" TIMESTAMP(3) NOT NULL,
    "taskId" TEXT,
    "projectId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "deepLink" TEXT,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduledReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduledReminder_eventId_key" ON "ScheduledReminder"("eventId");
CREATE INDEX "ScheduledReminder_fireAt_sent_cancelled_idx" ON "ScheduledReminder"("fireAt", "sent", "cancelled");
CREATE INDEX "ScheduledReminder_taskId_idx" ON "ScheduledReminder"("taskId");

ALTER TABLE "Note" ADD COLUMN "sharedWith" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "TimeBlock" ADD COLUMN "participantIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
