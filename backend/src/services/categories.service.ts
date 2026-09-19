import { prisma } from "../lib/prisma.js";
import { errors, HttpError } from "../lib/httpError.js";
import {
  assertCanManageProject,
  assertWrite,
  getAccessibleProject,
  projectAccessWhere,
  type Actor,
} from "../lib/access.js";

const categoryInclude = {
  project: { select: { id: true, name: true, color: true } },
  _count: { select: { tasks: true, notes: true } },
} as const;

export async function listCategories(actor: Actor, projectId?: string, includeArchived = false) {
  if (projectId) {
    await getAccessibleProject(actor, projectId);
  }

  return prisma.category.findMany({
    where: {
      archived: includeArchived ? undefined : false,
      ...(projectId
        ? { projectId }
        : { project: projectAccessWhere(actor) }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: categoryInclude,
  });
}

export async function getCategory(actor: Actor, id: string) {
  const category = await prisma.category.findFirst({
    where: { id },
    include: {
      ...categoryInclude,
      project: true,
    },
  });
  if (!category) throw errors.notFound("Category");
  await getAccessibleProject(actor, category.projectId);
  return category;
}

export async function createCategory(
  actor: Actor,
  data: {
    name: string;
    projectId: string;
    description?: string | null;
    icon?: string;
    color?: string;
    sortOrder?: number;
  },
) {
  assertWrite(actor);
  const project = await getAccessibleProject(actor, data.projectId);
  assertCanManageProject(actor, project);

  const existing = await prisma.category.findFirst({
    where: { projectId: data.projectId, name: data.name.trim() },
  });
  if (existing) throw errors.conflict("A category with this name already exists in the project.");

  return prisma.category.create({
    data: {
      userId: actor.id,
      projectId: data.projectId,
      name: data.name.trim(),
      description: data.description ?? null,
      icon: data.icon ?? "folder",
      color: data.color ?? "#64748B",
      sortOrder: data.sortOrder ?? 0,
    },
    include: categoryInclude,
  });
}

export async function updateCategory(
  actor: Actor,
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
  assertWrite(actor);
  const category = await getCategory(actor, id);
  assertCanManageProject(actor, category.project);

  return prisma.category.update({
    where: { id },
    data: {
      name: data.name?.trim(),
      description: data.description,
      icon: data.icon,
      color: data.color,
      sortOrder: data.sortOrder,
      archived: data.archived,
    },
    include: categoryInclude,
  });
}

export async function deleteCategory(
  actor: Actor,
  id: string,
  options?: { moveToCategoryId?: string | null; unassign?: boolean },
) {
  assertWrite(actor);
  const category = await getCategory(actor, id);
  assertCanManageProject(actor, category.project);
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
      where: { id: options.moveToCategoryId, projectId: category.projectId },
    });
    if (!target) throw errors.badRequest("Target category was not found in this project.");
    await prisma.task.updateMany({
      where: { categoryId: id },
      data: { categoryId: target.id },
    });
    await prisma.note.updateMany({
      where: { categoryId: id },
      data: { categoryId: target.id },
    });
  } else if (options?.unassign || taskCount > 0) {
    await prisma.task.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    await prisma.note.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
  }

  await prisma.category.delete({ where: { id } });
  return { ok: true };
}

export async function categoryStats(_userId: string, projectId: string) {
  const categories = await prisma.category.findMany({
    where: { projectId, archived: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const grouped = await prisma.task.groupBy({
    by: ["categoryId", "status"],
    where: { projectId, parentTaskId: null },
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
