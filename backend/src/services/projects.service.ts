import { Prisma, type ProjectStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";

export async function listProjects(userId: string) {
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          tasks: true,
          notes: true,
        },
      },
    },
  });

  const stats = await prisma.task.groupBy({
    by: ["projectId", "status"],
    where: { userId, projectId: { not: null } },
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
      taskCount: project._count.tasks,
      noteCount: project._count.notes,
      openTasks: open,
      completedTasks: done,
      progress: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  });
}

export async function getProject(userId: string, id: string) {
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) throw errors.notFound("Project");

  const [openTasks, completedTasks, overdueTasks, upcomingTasks, notes] = await Promise.all([
    prisma.task.findMany({
      where: { userId, projectId: id, status: { in: ["INBOX", "TODO", "IN_PROGRESS"] } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      include: { tags: { include: { tag: true } } },
    }),
    prisma.task.findMany({
      where: { userId, projectId: id, status: "DONE" },
      orderBy: { completedAt: "desc" },
      take: 30,
      include: { tags: { include: { tag: true } } },
    }),
    prisma.task.findMany({
      where: {
        userId,
        projectId: id,
        status: { notIn: ["DONE", "CANCELLED"] },
        dueDate: { lt: new Date().toISOString().slice(0, 10) },
      },
      orderBy: { dueDate: "asc" },
      include: { tags: { include: { tag: true } } },
    }),
    prisma.task.findMany({
      where: {
        userId,
        projectId: id,
        status: { notIn: ["DONE", "CANCELLED"] },
        dueDate: { gt: new Date().toISOString().slice(0, 10) },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
      include: { tags: { include: { tag: true } } },
    }),
    prisma.note.findMany({
      where: { userId, projectId: id },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const total = openTasks.length + completedTasks.length;
  const progress = total === 0 ? 0 : Math.round((completedTasks.length / (openTasks.length + completedTasks.length)) * 100);

  return {
    ...project,
    progress,
    openTasks,
    completedTasks,
    overdueTasks,
    upcomingTasks,
    notes,
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
