import { prisma } from "./prisma.js";

export async function getUserDefaultProjectId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultProjectId: true },
  });
  return user?.defaultProjectId ?? null;
}

export async function setUserDefaultProject(userId: string, projectId: string | null) {
  await prisma.user.update({
    where: { id: userId },
    data: { defaultProjectId: projectId },
  });
}

export function isUserDefaultProject(projectId: string | null | undefined, defaultProjectId: string | null) {
  return Boolean(projectId && defaultProjectId && projectId === defaultProjectId);
}

export function withProjectDefaultFlag<T extends { id: string }>(project: T, defaultProjectId: string | null) {
  return { ...project, isDefault: project.id === defaultProjectId };
}

export function withNestedProjectDefaultFlag<T extends { project?: { id: string } | null }>(
  item: T,
  defaultProjectId: string | null,
): T & { project?: (NonNullable<T["project"]> & { isDefault: boolean }) | null } {
  if (!item.project) return { ...item, project: item.project ?? null };
  return {
    ...item,
    project: { ...item.project, isDefault: item.project.id === defaultProjectId },
  };
}

export function sortByUserDefaultProject<T extends { projectId?: string | null; project?: { id?: string } | null }>(
  items: T[],
  defaultProjectId: string | null,
): T[] {
  if (!defaultProjectId) return items;
  return [...items].sort((a, b) => {
    const aId = a.projectId ?? a.project?.id ?? null;
    const bId = b.projectId ?? b.project?.id ?? null;
    return Number(bId === defaultProjectId) - Number(aId === defaultProjectId);
  });
}
