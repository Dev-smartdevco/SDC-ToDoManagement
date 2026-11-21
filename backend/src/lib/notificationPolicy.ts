const SECURITY = new Set([
  "NEW_DEVICE_LOGIN",
  "PASSWORD_CHANGED",
  "SUSPICIOUS_LOGIN",
]);

export const DEFAULT_CATEGORIES: Record<string, boolean> = {
  Tasks: true,
  Comments: true,
  Mentions: true,
  Projects: true,
  Team: true,
  Calendar: true,
  Notes: true,
  Recognition: true,
  Reminders: true,
  System: true,
};

export const DEFAULT_REMINDERS = {
  task24h: true,
  task1h: true,
  taskAtDeadline: true,
  meeting24h: true,
  meeting15m: true,
  meetingAtStart: true,
  dailyReviewTime: "18:00",
  weeklyReviewDay: 5,
  weeklyReviewTime: "16:00",
  dailyPlanTime: "08:30",
};

export function categoryFor(type: string) {
  if (type.includes("MENTION")) return "Mentions";
  if (type.startsWith("TASK_COMMENT") || type === "COMMENT_ADDED") return "Comments";
  if (type.startsWith("TASK_") || type === "DEADLINE_SOON") return "Tasks";
  if (type.startsWith("PROJECT_")) return "Projects";
  if (type.startsWith("TEAM_")) return "Team";
  if (type.startsWith("MEETING_")) return "Calendar";
  if (type.startsWith("NOTE_")) return "Notes";
  if (type === "RECOGNITION" || type.startsWith("REWARD") || type === "LEVEL_UP" || type === "ACHIEVEMENT_UNLOCKED" || type === "STREAK") {
    return "Recognition";
  }
  if (type === "DAILY_PLAN" || type === "START_OF_DAY" || type === "END_OF_DAY" || type === "WEEKLY_REVIEW" || type === "INCOMPLETE_TASKS" || type === "FOCUS_COMPLETED") {
    return "Reminders";
  }
  return "System";
}

export function pushRoute(deepLink = "", taskId = "", projectId = "") {
  if (taskId) return `task:${taskId}`;
  if (projectId && deepLink.includes("/projects/")) return `project:${projectId}`;
  if (deepLink.startsWith("myos://tasks/")) return `task:${deepLink.slice("myos://tasks/".length)}`;
  if (deepLink.startsWith("myos://projects/")) return `project:${deepLink.slice("myos://projects/".length)}`;
  if (deepLink.startsWith("myos://")) return deepLink;
  return "notification";
}

export function fcmData(input: {
  notificationId: string;
  type: string;
  category: string;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  taskId?: string | null;
  projectId?: string | null;
  deepLink?: string | null;
  priority: string;
  sound: string;
  lockScreenPreview: string;
}) {
  const taskId = input.taskId ?? "";
  const projectId = input.projectId ?? "";
  const deepLink = input.deepLink ?? "";
  return {
    notificationId: input.notificationId,
    type: input.type,
    category: input.category,
    title: input.title,
    body: input.body,
    entityType: input.entityType ?? "",
    entityId: input.entityId ?? "",
    taskId,
    projectId,
    deepLink,
    route: pushRoute(deepLink, taskId, projectId),
    priority: input.priority,
    sound: input.sound,
    lockScreenPreview: input.lockScreenPreview,
  };
}

export function deepLinkFor(entityType?: string | null, entityId?: string | null, taskId?: string | null, projectId?: string | null) {
  if (entityType === "Task" && entityId) return `myos://tasks/${entityId}`;
  if (entityType === "Project" && entityId) return `myos://projects/${entityId}`;
  if (entityType === "Meeting" && entityId) return `myos://calendar/${entityId}`;
  if (entityType === "Note" && entityId) return `myos://notes/${entityId}`;
  if (taskId) return `myos://tasks/${taskId}`;
  if (projectId) return `myos://projects/${projectId}`;
  return "myos://notifications";
}

export function isSecurity(type: string) {
  return SECURITY.has(type);
}

export function allowsInApp(categories: Record<string, boolean> | null | undefined, type: string, inAppEnabled = true) {
  if (isSecurity(type)) return true;
  if (!inAppEnabled) return false;
  const category = categoryFor(type);
  if (!categories) return true;
  return categories[category] !== false;
}

export function allowsPush(categories: Record<string, boolean> | null | undefined, type: string, pushEnabled = true) {
  if (isSecurity(type)) return true;
  if (!pushEnabled) return false;
  return allowsInApp(categories, type, true);
}

export function quietHoursActive(now: Date, start?: string | null, end?: string | null, timeZone = "Africa/Cairo") {
  if (!start || !end || start === end) return false;
  const local = clockInZone(now, timeZone);
  const startMin = minutes(start);
  const endMin = minutes(end);
  const nowMin = local.hour * 60 + local.minute;
  if (startMin === endMin) return false;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin;
}

export function nextQuietEnd(now: Date, end: string, timeZone = "Africa/Cairo") {
  const local = clockInZone(now, timeZone);
  const endMin = minutes(end);
  const nowMin = local.hour * 60 + local.minute;
  const delta = endMin > nowMin ? endMin - nowMin : 24 * 60 - nowMin + endMin;
  return new Date(now.getTime() + delta * 60_000);
}

export const maxPushAttempts = 6;

export function retryDelayMs(attempt: number) {
  const step = Math.min(Math.max(attempt, 1), 6);
  return Math.min(60 * 60_000, 15_000 * 2 ** (step - 1));
}

export function deliveryOutcome(input: { ok: boolean; invalid: boolean; error?: string | null; attempts: number }) {
  if (input.ok) return { status: "SENT" as const, deactivate: false, delayMs: 0, error: null };
  const attempts = input.attempts + 1;
  if (input.invalid) {
    return { status: "DEAD" as const, deactivate: true, delayMs: 0, error: input.error ?? "Invalid device token", attempts };
  }
  if (attempts >= maxPushAttempts) {
    return { status: "DEAD" as const, deactivate: false, delayMs: 0, error: input.error ?? "Push delivery failed", attempts };
  }
  return {
    status: "PENDING" as const,
    deactivate: false,
    delayMs: retryDelayMs(attempts),
    error: input.error ?? "Push delivery failed",
    attempts,
  };
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

function clockInZone(now: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    return { hour, minute };
  } catch {
    return { hour: now.getUTCHours(), minute: now.getUTCMinutes() };
  }
}
