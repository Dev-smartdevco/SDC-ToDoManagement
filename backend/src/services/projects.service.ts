import { type ProjectStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { categorySelect, projectSelect } from "../lib/category.js";
import { serializeTaggedTask } from "../lib/taskProgress.js";
import {
  getUserDefaultProjectId,
  setUserDefaultProject,
  withNestedProjectDefaultFlag,
  withProjectDefaultFlag,
} from "../lib/defaultProject.js";
import { categoryStats } from "./categories.service.js";
import {
  assertCanManageProject,
  assertWrite,
  getAccessibleProject,
  projectAccessWhere,
  publicUserSelect,
  type Actor,
} from "../lib/access.js";
import { onProjectCompleted } from "./rewards.service.js";
import { pageResult, pageWindow } from "../lib/paging.js";

const taskPreviewInclude = {
  project: { select: projectSelect },
  category: { select: categorySelect },
  tags: { include: { tag: true } },
  subtasks: { select: { id: true, title: true, status: true }, orderBy: { sortOrder: "asc" as const } },
};

function serializeTask<
  T extends {
    tags: { tag: { id: string; name: string } }[];
    subtasks?: { id: string; title: string; status: string }[];
    project?: { id: string } | null;
  },
>(task: T, defaultProjectId: string | null) {
  return withNestedProjectDefaultFlag(serializeTaggedTask(task), defaultProjectId);
}

export async function listProjects(actor: Actor, query: { page?: number; limit?: number; pageSize?: number } = {}) {
  const { page, pageSize, skip } = pageWindow(query);
  const where = projectAccessWhere(actor);
  const [projects, total, defaultProjectId] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip,
      take: pageSize,
      include: {
        _count: {
          select: {
            tasks: true,
            notes: true,
            categories: true,
          },
        },
      },
    }),
    prisma.project.count({ where }),
    getUserDefaultProjectId(actor.id),
  ]);

  if (!projects.length) return pageResult([], total, page, pageSize);

  const stats = await prisma.task.groupBy({
    by: ["projectId", "status"],
    where: {
      parentTaskId: null,
      projectId: { in: projects.map((project) => project.id) },
    },
    _count: { _all: true },
  });

  return pageResult(
    projects
    .map((project) => {
      const related = stats.filter((s) => s.projectId === project.id);
      const total = related.reduce((sum, s) => sum + s._count._all, 0);
      const done = related.filter((s) => s.status === "DONE").reduce((sum, s) => sum + s._count._all, 0);
      const open = related
        .filter((s) => s.status !== "DONE" && s.status !== "CANCELLED")
        .reduce((sum, s) => sum + s._count._all, 0);
      return withProjectDefaultFlag(
        {
          ...project,
          taskCount: total,
          noteCount: project._count.notes,
          categoryCount: project._count.categories,
          openTasks: open,
          completedTasks: done,
          progress: total === 0 ? 0 : Math.round((done / total) * 100),
        },
        defaultProjectId,
      );
    })
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt.getTime() - b.createdAt.getTime()),
    total,
    page,
    pageSize,
  );
}

export async function getProject(actor: Actor, id: string) {
  const [project, defaultProjectId] = await Promise.all([
    getAccessibleProject(actor, id),
    getUserDefaultProjectId(actor.id),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  const [openTasks, completedTasks, notes, categories, members, files, activity] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: id, parentTaskId: null, status: { in: ["INBOX", "TODO", "IN_PROGRESS", "BLOCKED"] } },
      relationLoadStrategy: "join",
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      take: 20,
      include: taskPreviewInclude,
    }),
    prisma.task.findMany({
      where: { projectId: id, parentTaskId: null, status: "DONE" },
      relationLoadStrategy: "join",
      orderBy: [{ completedAt: "desc" }, { id: "asc" }],
      take: 20,
      include: taskPreviewInclude,
    }),
    prisma.note.findMany({
      where: { projectId: id },
      include: { category: { select: categorySelect }, user: { select: publicUserSelect } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 20,
    }),
    categoryStats(project.userId, id),
    prisma.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: publicUserSelect } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.fileLink.findMany({
      where: { projectId: id },
      include: { user: { select: publicUserSelect } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.activityLog.findMany({
      where: { projectId: id },
      include: { actor: { select: publicUserSelect } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const blockedTasks = openTasks.filter((task) => task.status === "BLOCKED");

  const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < today);
  const upcomingTasks = openTasks.filter((task) => task.dueDate && task.dueDate > today).slice(0, 20);
  const total = openTasks.length + completedTasks.length;
  const progress = total === 0 ? 0 : Math.round((completedTasks.length / total) * 100);

  return withProjectDefaultFlag(
    {
      ...project,
      progress,
      openTasks: openTasks.map((task) => serializeTask(task, defaultProjectId)),
      completedTasks: completedTasks.map((task) => serializeTask(task, defaultProjectId)),
      overdueTasks: overdueTasks.map((task) => serializeTask(task, defaultProjectId)),
      upcomingTasks: upcomingTasks.map((task) => serializeTask(task, defaultProjectId)),
      notes,
      categories,
      members,
      files,
      activity,
      blockedTasks: blockedTasks.map((task) => serializeTask(task, defaultProjectId)),
      dueSoon: upcomingTasks.length,
      todoCount: openTasks.filter((task) => task.status === "TODO" || task.status === "INBOX").length,
      inProgressCount: openTasks.filter((task) => task.status === "IN_PROGRESS").length,
      blockedCount: blockedTasks.length,
    },
    defaultProjectId,
  );
}

export async function createProject(
  actor: Actor,
  data: {
    name: string;
    description?: string | null;
    status?: ProjectStatus;
    icon?: string;
    color?: string;
    isDefault?: boolean;
  },
) {
  assertWrite(actor);
  const project = await prisma.project.create({
    data: {
      userId: actor.id,
      name: data.name,
      description: data.description ?? null,
      status: data.status ?? "ACTIVE",
      icon: data.icon ?? "folder",
      color: data.color ?? "#3A96D4",
    },
  });
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: actor.id, role: "OWNER" },
  });
  if (data.isDefault) {
    await setUserDefaultProject(actor.id, project.id);
  }
  return withProjectDefaultFlag(project, data.isDefault ? project.id : await getUserDefaultProjectId(actor.id));
}

export async function updateProject(
  actor: Actor,
  id: string,
  data: {
    name?: string;
    description?: string | null;
    status?: ProjectStatus;
    icon?: string;
    color?: string;
    isDefault?: boolean;
  },
) {
  assertWrite(actor);
  const existing = await getAccessibleProject(actor, id);

  // Per-user preference: any member with access can set their own default
  if (data.isDefault === true) {
    await setUserDefaultProject(actor.id, id);
  } else if (data.isDefault === false) {
    const current = await getUserDefaultProjectId(actor.id);
    if (current === id) await setUserDefaultProject(actor.id, null);
  }

  const projectPatch = {
    name: data.name,
    description: data.description,
    status: data.status,
    icon: data.icon,
    color: data.color,
  };
  const hasProjectUpdates = Object.values(projectPatch).some((value) => value !== undefined);

  if (!hasProjectUpdates) {
    return withProjectDefaultFlag(existing, await getUserDefaultProjectId(actor.id));
  }

  assertCanManageProject(actor, existing);
  const updated = await prisma.project.update({
    where: { id },
    data: projectPatch,
  });
  if (data.status && data.status !== existing.status) {
    const members = await prisma.projectMember.findMany({ where: { projectId: id }, select: { userId: true } });
    const { notifyUsers } = await import("../lib/events.js");
    const type = data.status === "COMPLETED" ? "PROJECT_COMPLETED" : data.status === "ARCHIVED" ? "PROJECT_ARCHIVED" : "PROJECT_STATUS_CHANGED";
    void notifyUsers({
      userIds: [existing.userId, ...members.map((row) => row.userId)],
      type,
      title: "Project update",
      body: `${updated.name} is now ${data.status}.`,
      actorId: actor.id,
      projectId: id,
      entityType: "Project",
      entityId: id,
      eventId: `project-status:${id}:${data.status}`,
    });
    if (data.status === "COMPLETED") await onProjectCompleted(existing.userId);
  }
  return withProjectDefaultFlag(updated, await getUserDefaultProjectId(actor.id));
}

export async function deleteProject(actor: Actor, id: string) {
  assertWrite(actor);
  const existing = await getAccessibleProject(actor, id);
  assertCanManageProject(actor, existing);
  await prisma.project.delete({ where: { id } });
  return { ok: true };
}
