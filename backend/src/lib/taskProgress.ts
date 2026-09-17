import type { TaskStatus } from "@prisma/client";

export type SubtaskLike = { status: string };

export function taskProgress(subtasks: SubtaskLike[] | undefined) {
  const items = (subtasks ?? []).filter((item) => item.status !== "CANCELLED");
  const total = items.length;
  const completed = items.filter((item) => item.status === "DONE").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, percent };
}

export function parentStatusFromSubtasks(current: TaskStatus, subtasks: SubtaskLike[]): TaskStatus | null {
  const items = subtasks.filter((item) => item.status !== "CANCELLED");
  if (!items.length) return null;
  const completed = items.filter((item) => item.status === "DONE").length;
  if (completed === items.length) return "DONE";
  if (completed === 0) return current === "INBOX" ? "INBOX" : "TODO";
  return "IN_PROGRESS";
}

export function serializeTaggedTask<
  T extends { tags: { tag: { id: string; name: string } }[]; subtasks?: Array<{ id: string; title: string; status: string }> },
>(task: T) {
  const { tags, ...rest } = task;
  const subtasks = task.subtasks ?? [];
  return {
    ...rest,
    tags: tags.map((item) => item.tag),
    subtasks,
    subtaskProgress: taskProgress(subtasks),
  };
}
