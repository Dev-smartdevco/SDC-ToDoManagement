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

export function retryDelayMs(attempt: number) {
  const step = Math.min(attempt, 6);
  return Math.min(60 * 60_000, 15_000 * 2 ** step);
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
