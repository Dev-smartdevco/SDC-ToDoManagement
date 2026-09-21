import { type ProjectStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { categorySelect, projectSelect } from "../lib/category.js";
import { serializeTaggedTask } from "../lib/taskProgress.js";
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

const taskPreviewInclude = {
  project: { select: projectSelect },
  category: { select: categorySelect },
  tags: { include: { tag: true } },
  subtasks: { select: { id: true, title: true, status: true }, orderBy: { sortOrder: "asc" as const } },
};

function serializeTask<T extends { tags: { tag: { id: string; name: string } }[]; subtasks?: { id: string; title: string; status: string }[] }>(task: T) {
  return serializeTaggedTask(task);
}

export async function listProjects(actor: Actor) {
  const projects = await prisma.project.findMany({
    where: projectAccessWhere(actor),
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: {
          tasks: true,
          notes: true,
          categories: true,
        },
      },
    },
  });

  if (!projects.length) return [];

  const stats = await prisma.task.groupBy({
    by: ["projectId", "status"],
    where: {
      parentTaskId: null,
      projectId: { in: projects.map((project) => project.id) },
    },
    _count: { _all: true },
  });

  return projects.map((project) => {
    const related = stats.filter((s) => s.projectId === project.id);
    const total = related.reduce((sum, s) => sum + s._count._all, 0);
    const done = related.filter((s) => s.status === "DONE").reduce((sum, s) => sum + s._count._all, 0);
    const open = related
      .filter((s) => s.status !== "DONE" && s.status !== "CANCELLED")
      .reduce((sum, s) => sum + s._count._all, 0);
    return {
      ...project,
      taskCount: total,
      noteCount: project._count.notes,
      categoryCount: project._count.categories,
      openTasks: open,
      completedTasks: done,
      progress: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  });
}

export async function getProject(actor: Actor, id: string) {
  const project = await getAccessibleProject(actor, id);
  const today = new Date().toISOString().slice(0, 10);

  const [openTasks, completedTasks, notes, categories, members, files, activity] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: id, parentTaskId: null, status: { in: ["INBOX", "TODO", "IN_PROGRESS", "BLOCKED"] } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 120,
      include: taskPreviewInclude,
    }),
    prisma.task.findMany({
      where: { projectId: id, parentTaskId: null, status: "DONE" },
      orderBy: { completedAt: "desc" },
      take: 30,
      include: taskPreviewInclude,
    }),
    prisma.note.findMany({
      where: { projectId: id },
      include: { category: { select: categorySelect }, user: { select: publicUserSelect } },
      orderBy: { updatedAt: "desc" },
      take: 40,
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

  return {
    ...project,
    progress,
    openTasks: openTasks.map(serializeTask),
    completedTasks: completedTasks.map(serializeTask),
    overdueTasks: overdueTasks.map(serializeTask),
    upcomingTasks: upcomingTasks.map(serializeTask),
    notes,
    categories,
    members,
    files,
    activity,
    blockedTasks: blockedTasks.map(serializeTask),
    dueSoon: upcomingTasks.length,
    todoCount: openTasks.filter((task) => task.status === "TODO" || task.status === "INBOX").length,
    inProgressCount: openTasks.filter((task) => task.status === "IN_PROGRESS").length,
    blockedCount: blockedTasks.length,
  };
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
  if (data.isDefault) {
    await prisma.project.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }
  const project = await prisma.project.create({
    data: {
      userId: actor.id,
      name: data.name,
      description: data.description ?? null,
      status: data.status ?? "ACTIVE",
      icon: data.icon ?? "folder",
      color: data.color ?? "#3A96D4",
      isDefault: data.isDefault ?? false,
    },
  });
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: actor.id, role: "OWNER" },
  });
  return project;
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
  assertCanManageProject(actor, existing);
  if (data.isDefault === true) {
    await prisma.project.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }
  const updated = await prisma.project.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      status: data.status,
      icon: data.icon,
      color: data.color,
      isDefault: data.isDefault,
    },
  });
  if (data.status === "COMPLETED" && existing.status !== "COMPLETED") {
    await onProjectCompleted(existing.userId);
  }
  return updated;
}

export async function deleteProject(actor: Actor, id: string) {
  assertWrite(actor);
  const existing = await getAccessibleProject(actor, id);
  assertCanManageProject(actor, existing);
  await prisma.project.delete({ where: { id } });
  return { ok: true };
}
