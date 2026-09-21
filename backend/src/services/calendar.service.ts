import type { TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { myTaskWhere, projectAccessWhere, taskAccessWhere, type Actor } from "../lib/access.js";
import { addDaysIso, todayIso } from "../lib/dates.js";

export async function calendar(
  actor: Actor,
  query: {
    from?: string;
    to?: string;
    scope?: "mine" | "team";
    projectId?: string;
    memberId?: string;
    status?: TaskStatus;
  },
) {
  const from = query.from ?? todayIso();
  const to = query.to ?? addDaysIso(from, 31);
  const access = query.scope === "team" ? taskAccessWhere(actor) : myTaskWhere(actor);

  const [tasks, meetings] = await Promise.all([
    prisma.task.findMany({
      where: {
        parentTaskId: null,
        dueDate: { gte: from, lte: to },
        projectId: query.projectId || undefined,
        status: query.status,
        AND: [
          access,
          query.memberId
            ? { OR: [{ userId: query.memberId }, { assignees: { some: { userId: query.memberId } } }] }
            : {},
        ],
      },
      orderBy: [{ project: { isDefault: "desc" } }, { dueDate: "asc" }, { dueTime: "asc" }],
      include: {
        project: { select: { id: true, name: true, color: true, isDefault: true } },
        assignees: { include: { user: { select: { id: true, name: true } } } },
      },
    }),
    prisma.timeBlock.findMany({
      where: {
        date: { gte: from, lte: to },
        userId: query.scope === "team" ? query.memberId || undefined : actor.id,
        project: query.scope === "team" ? { AND: [projectAccessWhere(actor)] } : undefined,
        projectId: query.projectId || undefined,
      },
      orderBy: [{ project: { isDefault: "desc" } }, { date: "asc" }, { startTime: "asc" }],
      include: { project: { select: { id: true, name: true, color: true, isDefault: true } } },
    }),
  ]);

  return {
    from,
    to,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      status: task.status,
      priority: task.priority,
      project: task.project,
      assignees: task.assignees.map((row) => row.user),
      kind: "task" as const,
    })),
    meetings: meetings.map((item) => ({
      id: item.id,
      title: item.title,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      project: item.project,
      kind: "meeting" as const,
    })),
  };
}
