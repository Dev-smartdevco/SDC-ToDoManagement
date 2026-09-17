import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";

export async function listNotes(userId: string, query: { q?: string; projectId?: string; tag?: string }) {
  return prisma.note.findMany({
    where: {
      userId,
      projectId: query.projectId || undefined,
      tags: query.tag ? { has: query.tag } : undefined,
      OR: query.q
        ? [
            { title: { contains: query.q, mode: "insensitive" } },
            { content: { contains: query.q, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: {
      project: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getNote(userId: string, id: string) {
  const note = await prisma.note.findFirst({
    where: { id, userId },
    include: {
      project: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, title: true } },
    },
  });
  if (!note) throw errors.notFound("Note");
  return note;
}

export async function createNote(
  userId: string,
  data: { title: string; content?: string; projectId?: string | null; taskId?: string | null; tags?: string[] },
) {
  return prisma.note.create({
    data: {
      userId,
      title: data.title,
      content: data.content ?? "",
      projectId: data.projectId ?? null,
      taskId: data.taskId ?? null,
      tags: data.tags ?? [],
    },
    include: {
      project: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, title: true } },
    },
  });
}

export async function updateNote(
  userId: string,
  id: string,
  data: { title?: string; content?: string; projectId?: string | null; taskId?: string | null; tags?: string[] },
) {
  const existing = await prisma.note.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Note");
  return prisma.note.update({
    where: { id },
    data,
    include: {
      project: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, title: true } },
    },
  });
}

export async function deleteNote(userId: string, id: string) {
  const existing = await prisma.note.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Note");
  await prisma.note.delete({ where: { id } });
  return { ok: true };
}
