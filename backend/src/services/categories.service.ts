import { prisma } from "../lib/prisma.js";
import { errors, HttpError } from "../lib/httpError.js";

export async function listCategories(userId: string, projectId?: string, includeArchived = false) {
  return prisma.category.findMany({
    where: {
      userId,
      projectId: projectId || undefined,
      archived: includeArchived ? undefined : false,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      project: { select: { id: true, name: true, color: true } },
      _count: { select: { tasks: true, notes: true } },
    },
  });
}

export async function getCategory(userId: string, id: string) {
  const category = await prisma.category.findFirst({
    where: { id, userId },
    include: {
      project: { select: { id: true, name: true, color: true } },
      _count: { select: { tasks: true, notes: true } },
    },
  });
  if (!category) throw errors.notFound("Category");
  return category;
}

export async function createCategory(
  userId: string,
  data: {
    name: string;
    projectId: string;
    description?: string | null;
    icon?: string;
    color?: string;
    sortOrder?: number;
  },
) {
  const project = await prisma.project.findFirst({ where: { id: data.projectId, userId } });
  if (!project) throw errors.notFound("Project");

  const existing = await prisma.category.findFirst({
    where: { projectId: data.projectId, name: data.name },
  });
  if (existing) throw errors.conflict("A category with this name already exists in the project.");

  return prisma.category.create({
    data: {
      userId,
      projectId: data.projectId,
      name: data.name,
      description: data.description ?? null,
      icon: data.icon ?? "folder",
      color: data.color ?? "#64748B",
      sortOrder: data.sortOrder ?? 0,
    },
    include: {
      project: { select: { id: true, name: true, color: true } },
      _count: { select: { tasks: true, notes: true } },
    },
  });
}

export async function updateCategory(
  userId: string,
  id: string,
  data: {
    name?: string;
    description?: string | null;
    icon?: string;
    color?: string;
    sortOrder?: number;
    archived?: boolean;
  },
) {
  await getCategory(userId, id);
  return prisma.category.update({
    where: { id },
    data,
    include: {
      project: { select: { id: true, name: true, color: true } },
      _count: { select: { tasks: true, notes: true } },
    },
  });
}

export async function deleteCategory(
  userId: string,
  id: string,
  options?: { moveToCategoryId?: string | null; unassign?: boolean },
) {
  const category = await getCategory(userId, id);
  const taskCount = category._count.tasks;

  if (taskCount > 0 && !options?.unassign && !options?.moveToCategoryId) {
    throw new HttpError(
      400,
      "CATEGORY_HAS_TASKS",
      `This category contains ${taskCount} tasks.`,
      { taskCount },
    );
  }

  if (options?.moveToCategoryId) {
    const target = await prisma.category.findFirst({
      where: { id: options.moveToCategoryId, userId, projectId: category.projectId },
    });
    if (!target) throw errors.badRequest("Target category was not found in this project.");
    await prisma.task.updateMany({
      where: { categoryId: id, userId },
      data: { categoryId: target.id },
    });
    await prisma.note.updateMany({
      where: { categoryId: id, userId },
      data: { categoryId: target.id },
    });
  } else if (options?.unassign || taskCount > 0) {
    await prisma.task.updateMany({ where: { categoryId: id, userId }, data: { categoryId: null } });
    await prisma.note.updateMany({ where: { categoryId: id, userId }, data: { categoryId: null } });
  }

  await prisma.category.delete({ where: { id } });
  return { ok: true };
}

export async function categoryStats(userId: string, projectId: string) {
  const categories = await prisma.category.findMany({
    where: { userId, projectId, archived: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const grouped = await prisma.task.groupBy({
    by: ["categoryId", "status"],
    where: { userId, projectId },
    _count: { _all: true },
  });

  return categories.map((category) => {
    const related = grouped.filter((row) => row.categoryId === category.id);
    const total = related.reduce((sum, row) => sum + row._count._all, 0);
    const completed = related.filter((row) => row.status === "DONE").reduce((sum, row) => sum + row._count._all, 0);
    const open = related
      .filter((row) => row.status !== "DONE" && row.status !== "CANCELLED")
      .reduce((sum, row) => sum + row._count._all, 0);
    return {
      ...category,
      taskCount: total,
      completedTasks: completed,
      openTasks: open,
    };
  });
}
