import type { TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { myTaskWhere, projectAccessWhere, taskAccessWhere, type Actor } from "../lib/access.js";
import { addDaysIso, todayIso } from "../lib/dates.js";
import {
  getUserDefaultProjectId,
  sortByUserDefaultProject,
  withNestedProjectDefaultFlag,
} from "../lib/defaultProject.js";

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

  const [tasks, meetings, defaultProjectId] = await Promise.all([
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
      relationLoadStrategy: "join",
      orderBy: [{ dueDate: "asc" }, { dueTime: "asc" }, { id: "asc" }],
      take: 150,
      include: {
        project: { select: { id: true, name: true, color: true } },
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
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: { project: { select: { id: true, name: true, color: true } } },
    }),
    getUserDefaultProjectId(actor.id),
  ]);

  return {
    from,
    to,
    tasks: sortByUserDefaultProject(
      tasks.map((task) =>
        withNestedProjectDefaultFlag(
          {
            id: task.id,
            title: task.title,
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            status: task.status,
            priority: task.priority,
            project: task.project,
            assignees: task.assignees.map((row) => row.user),
            kind: "task" as const,
          },
          defaultProjectId,
        ),
      ),
      defaultProjectId,
    ),
    meetings: sortByUserDefaultProject(
      meetings.map((item) =>
        withNestedProjectDefaultFlag(
          {
            id: item.id,
            title: item.title,
            date: item.date,
            startTime: item.startTime,
            endTime: item.endTime,
            project: item.project,
            kind: "meeting" as const,
          },
          defaultProjectId,
        ),
      ),
      defaultProjectId,
    ),
  };
}
