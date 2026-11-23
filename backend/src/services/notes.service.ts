import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { assertCategoryForProject, categorySelect } from "../lib/category.js";
import {
  getUserDefaultProjectId,
  sortByUserDefaultProject,
  withNestedProjectDefaultFlag,
} from "../lib/defaultProject.js";
import { pageResult, pageWindow } from "../lib/paging.js";
import { assertWrite, getAccessibleProject, type Actor } from "../lib/access.js";
import { notifyUsers, recordActivity } from "../lib/events.js";

export async function saveSmartNote(
  actor: Actor,
  data: {
    requestId: string;
    title: string;
    content: string;
    projectId: string;
    originalDrawing?: Record<string, unknown>;
    saveNote: boolean;
    createTasks: boolean;
    tasks: { title: string; level: number }[];
  },
) {
  assertWrite(actor);
  const project = await getAccessibleProject(actor, data.projectId);
  const previous = await prisma.smartNoteRequest.findUnique({
    where: { userId_requestId: { userId: actor.id, requestId: data.requestId } },
  });
  if (previous) {
    const note = previous.noteId ? await prisma.note.findFirst({ where: { id: previous.noteId, userId: actor.id } }) : null;
    return { note, taskIds: previous.createdTaskIds, replayed: true };
  }

  let createdTaskIds: string[] = [];
  let noteId: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      if (data.saveNote) {
        const note = await tx.note.create({ data: {
          userId: actor.id,
          projectId: project.id,
          title: data.title,
          content: data.content,
          tags: ["smart-notes"],
          originalDrawing: data.originalDrawing ? data.originalDrawing as Prisma.InputJsonObject : Prisma.DbNull,
        } });
        noteId = note.id;
      }

      if (data.createTasks) {
        let parentTaskId: string | null = null;
        for (const [index, item] of data.tasks.entries()) {
          const child: boolean = item.level > 0 && parentTaskId !== null;
          if (!child) parentTaskId = null;
          const parentRef: string | null = child ? parentTaskId : null;
          const createdTask: { id: string } = await tx.task.create({ data: {
            userId: actor.id,
            projectId: project.id,
            title: item.title,
            parentTaskId: parentRef,
            status: child ? "TODO" : "INBOX",
            priority: "MEDIUM",
            sortOrder: index,
            assignees: { create: { userId: actor.id, isPrimary: true } },
          }, select: { id: true } });
          createdTaskIds.push(createdTask.id);
          if (!child) parentTaskId = createdTask.id;
        }
      }

      await tx.smartNoteRequest.create({ data: {
        userId: actor.id,
        projectId: project.id,
        requestId: data.requestId,
        noteId,
        createdTaskIds,
      } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replay = await prisma.smartNoteRequest.findUnique({
        where: { userId_requestId: { userId: actor.id, requestId: data.requestId } },
      });
      if (replay) {
        const note = replay.noteId ? await prisma.note.findFirst({ where: { id: replay.noteId, userId: actor.id } }) : null;
        return { note, taskIds: replay.createdTaskIds, replayed: true };
      }
    }
    throw error;
  }

  // Emit the same activity and task-created notification event used by normal
  // task creation, after commit so a retry cannot duplicate side effects.
  for (const id of createdTaskIds) {
    const task = await prisma.task.findUnique({ where: { id }, select: { id: true, title: true, parentTaskId: true } });
    if (!task) continue;
    void recordActivity({ type: "TASK_CREATED", actorId: actor.id, taskId: id, projectId: project.id,
      message: `${actor.name} created ${task.title}` });
    void notifyUsers({ userIds: [actor.id], type: "TASK_CREATED", title: "New task assigned",
      body: `${actor.name} assigned you a task: ${task.title}.`, actorId: actor.id,
      taskId: id, projectId: project.id, priority: "High", eventId: `created:${id}` });
  }
  const note = noteId ? await prisma.note.findFirst({ where: { id: noteId, userId: actor.id }, include: noteInclude }) : null;
  return { note, taskIds: createdTaskIds, replayed: false };
}

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
  query: { q?: string; projectId?: string; categoryId?: string; tag?: string; page?: number; limit?: number; pageSize?: number },
) {
  const { page, pageSize, skip } = pageWindow(query);
  const where = {
    AND: [
      {
        OR: [{ userId }, { project: { OR: [{ userId }, { members: { some: { userId } } }] } }],
      },
    ],
    projectId: query.projectId || undefined,
    categoryId: query.categoryId || undefined,
    tags: query.tag ? { has: query.tag } : undefined,
    OR: query.q
      ? [
          { title: { contains: query.q, mode: "insensitive" as const } },
          { content: { contains: query.q, mode: "insensitive" as const } },
          { project: { name: { contains: query.q, mode: "insensitive" as const } } },
          { category: { name: { contains: query.q, mode: "insensitive" as const } } },
          { task: { title: { contains: query.q, mode: "insensitive" as const } } },
        ]
      : undefined,
  };
  const [notes, total, defaultProjectId] = await Promise.all([
    prisma.note.findMany({
      where,
      relationLoadStrategy: "join",
      include: noteInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.note.count({ where }),
    getUserDefaultProjectId(userId),
  ]);

  const items = sortByUserDefaultProject(
    notes.map((note) =>
      serializeNote(
        {
          ...note,
          content: note.content.length > 180 ? `${note.content.slice(0, 180)}…` : note.content,
        },
        defaultProjectId,
      ),
    ),
    defaultProjectId,
  );
  return pageResult(items, total, page, pageSize);
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
    sharedWith?: string[];
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
  if (data.sharedWith) {
    const previous = new Set(existing.sharedWith ?? []);
    const added = data.sharedWith.filter((memberId) => !previous.has(memberId));
    const { notifyUsers } = await import("../lib/events.js");
    void notifyUsers({
      userIds: added,
      type: "NOTE_SHARED",
      title: "Note shared with you",
      body: note.title,
      entityType: "Note",
      entityId: note.id,
      eventId: `note-share:${note.id}:${added.join(",")}`,
    });
  }
  return serializeNote(note, defaultProjectId);
}

export async function deleteNote(userId: string, id: string) {
  const existing = await prisma.note.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Note");
  await prisma.note.delete({ where: { id } });
  return { ok: true };
}
