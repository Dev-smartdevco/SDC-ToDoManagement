import { Prisma, type ProjectStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { categorySelect, projectSelect } from "../lib/category.js";
import { serializeTaggedTask } from "../lib/taskProgress.js";
import { categoryStats } from "./categories.service.js";

const taskPreviewInclude = {
  project: { select: projectSelect },
  category: { select: categorySelect },
  tags: { include: { tag: true } },
  subtasks: { select: { id: true, title: true, status: true }, orderBy: { sortOrder: "asc" as const } },
};

function serializeTask<T extends { tags: { tag: { id: string; name: string } }[]; subtasks?: { id: string; title: string; status: string }[] }>(task: T) {
  return serializeTaggedTask(task);
}

export async function listProjects(userId: string) {
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
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

  const stats = await prisma.task.groupBy({
    by: ["projectId", "status"],
    where: { userId, projectId: { not: null }, parentTaskId: null },
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

export async function getProject(userId: string, id: string) {
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) throw errors.notFound("Project");
  const today = new Date().toISOString().slice(0, 10);

  const [openTasks, completedTasks, notes, categories] = await Promise.all([
    prisma.task.findMany({
      where: { userId, projectId: id, parentTaskId: null, status: { in: ["INBOX", "TODO", "IN_PROGRESS"] } },
      orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }],
      include: taskPreviewInclude,
    }),
    prisma.task.findMany({
      where: { userId, projectId: id, parentTaskId: null, status: "DONE" },
      orderBy: { completedAt: "desc" },
      take: 30,
      include: taskPreviewInclude,
    }),
    prisma.note.findMany({
      where: { userId, projectId: id },
      include: { category: { select: categorySelect } },
      orderBy: { updatedAt: "desc" },
    }),
    categoryStats(userId, id),
  ]);

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
  };
}

export async function createProject(
  userId: string,
  data: { name: string; description?: string | null; status?: ProjectStatus; icon?: string; color?: string },
) {
  return prisma.project.create({
    data: {
      userId,
      name: data.name,
      description: data.description ?? null,
      status: data.status ?? "ACTIVE",
      icon: data.icon ?? "folder",
      color: data.color ?? "#3A96D4",
    },
  });
}

export async function updateProject(userId: string, id: string, data: Prisma.ProjectUpdateInput) {
  const existing = await prisma.project.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Project");
  return prisma.project.update({ where: { id }, data });
}

export async function deleteProject(userId: string, id: string) {
  const existing = await prisma.project.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Project");
  await prisma.project.delete({ where: { id } });
  return { ok: true };
}
