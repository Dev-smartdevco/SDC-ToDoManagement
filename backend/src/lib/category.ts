import { prisma } from "./prisma.js";
import { errors } from "./httpError.js";

export const categorySelect = {
  id: true,
  name: true,
  color: true,
  icon: true,
  projectId: true,
} as const;

export const projectSelect = {
  id: true,
  name: true,
  color: true,
  icon: true,
} as const;

export const taskInclude = {
  project: { select: projectSelect },
  category: { select: categorySelect },
  tags: { include: { tag: true } },
};

export async function assertCategoryForProject(
  userId: string,
  categoryId: string | null | undefined,
  projectId: string | null | undefined,
) {
  if (!categoryId) return null;
  if (!projectId) throw errors.badRequest("A project is required when assigning a category.");
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId, archived: false },
  });
  if (!category) throw errors.badRequest("Category was not found.");
  if (category.projectId !== projectId) {
    throw errors.badRequest("Category does not belong to this project.");
  }
  return category;
}
