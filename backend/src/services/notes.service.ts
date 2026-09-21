import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { assertCategoryForProject, categorySelect } from "../lib/category.js";
import {
  getUserDefaultProjectId,
  sortByUserDefaultProject,
  withNestedProjectDefaultFlag,
} from "../lib/defaultProject.js";

const noteInclude = {
  project: { select: { id: true, name: true, color: true } },
  category: { select: categorySelect },
  task: { select: { id: true, title: true } },
};

function serializeNote<T extends { project?: { id: string } | null }>(note: T, defaultProjectId: string | null) {
  return withNestedProjectDefaultFlag(note, defaultProjectId);
}

export async function listNotes(
  userId: string,
  query: { q?: string; projectId?: string; categoryId?: string; tag?: string },
) {
  const [notes, defaultProjectId] = await Promise.all([
    prisma.note.findMany({
      where: {
        AND: [
          {
            OR: [
              { userId },
              { project: { OR: [{ userId }, { members: { some: { userId } } }] } },
            ],
          },
        ],
        projectId: query.projectId || undefined,
        categoryId: query.categoryId || undefined,
        tags: query.tag ? { has: query.tag } : undefined,
        OR: query.q
          ? [
              { title: { contains: query.q, mode: "insensitive" } },
              { content: { contains: query.q, mode: "insensitive" } },
              { project: { name: { contains: query.q, mode: "insensitive" } } },
              { category: { name: { contains: query.q, mode: "insensitive" } } },
              { task: { title: { contains: query.q, mode: "insensitive" } } },
            ]
          : undefined,
      },
      include: noteInclude,
      orderBy: { updatedAt: "desc" },
    }),
    getUserDefaultProjectId(userId),
  ]);

  return sortByUserDefaultProject(
    notes.map((note) => serializeNote(note, defaultProjectId)),
    defaultProjectId,
  );
}

export async function getNote(userId: string, id: string) {
  const [note, defaultProjectId] = await Promise.all([
    prisma.note.findFirst({
      where: { id, userId },
      include: noteInclude,
    }),
    getUserDefaultProjectId(userId),
  ]);
  if (!note) throw errors.notFound("Note");
  return serializeNote(note, defaultProjectId);
}

export async function createNote(
  userId: string,
  data: {
    title: string;
    content?: string;
    projectId?: string | null;
    categoryId?: string | null;
    taskId?: string | null;
    tags?: string[];
  },
) {
  await assertCategoryForProject(userId, data.categoryId, data.projectId ?? null);
  const [note, defaultProjectId] = await Promise.all([
    prisma.note.create({
      data: {
        userId,
        title: data.title,
        content: data.content ?? "",
        projectId: data.projectId ?? null,
        categoryId: data.categoryId ?? null,
        taskId: data.taskId ?? null,
        tags: data.tags ?? [],
      },
      include: noteInclude,
    }),
    getUserDefaultProjectId(userId),
  ]);
  return serializeNote(note, defaultProjectId);
}

export async function updateNote(
  userId: string,
  id: string,
  data: {
    title?: string;
    content?: string;
    projectId?: string | null;
    categoryId?: string | null;
    taskId?: string | null;
    tags?: string[];
  },
) {
  const existing = await prisma.note.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Note");

  const nextProjectId = data.projectId !== undefined ? data.projectId : existing.projectId;
  let nextCategoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
  if (data.projectId !== undefined && data.projectId !== existing.projectId && data.categoryId === undefined) {
    nextCategoryId = null;
  }
  await assertCategoryForProject(userId, nextCategoryId, nextProjectId);

  const [note, defaultProjectId] = await Promise.all([
    prisma.note.update({
      where: { id },
      data: { ...data, categoryId: nextCategoryId },
      include: noteInclude,
    }),
    getUserDefaultProjectId(userId),
  ]);
  return serializeNote(note, defaultProjectId);
}

export async function deleteNote(userId: string, id: string) {
  const existing = await prisma.note.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Note");
  await prisma.note.delete({ where: { id } });
  return { ok: true };
}
