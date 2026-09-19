import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { todayIso } from "../lib/dates.js";

const app = createApp();

let token = "";
let projectId = "";
let taskId = "";
let noteId = "";
let blockId = "";
let focusId = "";

describe("MY OS API", () => {
  beforeAll(async () => {
    const email = process.env.ADMIN_EMAIL ?? "admin@smartdevco.com";
    const password = process.env.ADMIN_PASSWORD ?? "SmartDevCo@2026";
    const login = await request(app).post("/api/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    token = login.body.token;
  });

  it("rejects invalid login", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "admin@smartdevco.com",
      password: "wrong-password",
    });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBeTruthy();
  });

  it("returns the current user", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toContain("@");
  });

  it("lists projects and creates one", async () => {
    const list = await request(app).get("/api/projects").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);

    const created = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "TEST LAB", color: "#334155", icon: "flask" });
    expect(created.status).toBe(201);
    projectId = created.body.id;
  });

  it("creates, updates, completes and lists tasks", async () => {
    const created = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Write API tests",
        projectId,
        priority: "HIGH",
        dueDate: todayIso(),
        estimatedMinutes: 25,
      });
    expect(created.status).toBe(201);
    taskId = created.body.id;

    const updated = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "Cover task completion path." });
    expect(updated.status).toBe(200);
    expect(updated.body.description).toContain("Cover");

    const completed = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "DONE" });
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe("DONE");
    expect(completed.body.completedAt).toBeTruthy();

    const list = await request(app)
      .get("/api/tasks?view=today")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThanOrEqual(0);
  });

  it("captures inbox tasks quickly", async () => {
    const res = await request(app)
      .post("/api/tasks/capture")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Follow up with client" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("INBOX");
  });

  it("creates notes", async () => {
    const res = await request(app)
      .post("/api/notes")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Need school profile", projectId, content: "Pricing + STEM offering" });
    expect(res.status).toBe(201);
    noteId = res.body.id;
  });

  it("creates time blocks", async () => {
    const res = await request(app)
      .post("/api/time-blocks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Deep work",
        projectId,
        date: todayIso(),
        startTime: "16:00",
        endTime: "17:00",
      });
    expect(res.status).toBe(201);
    blockId = res.body.id;
  });

  it("runs a focus session", async () => {
    const openTask = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Focus candidate", projectId, dueDate: todayIso(), priority: "HIGH" });

    const started = await request(app)
      .post("/api/focus/start")
      .set("Authorization", `Bearer ${token}`)
      .send({ taskId: openTask.body.id });
    expect(started.status).toBe(201);
    focusId = started.body.id;

    const paused = await request(app)
      .post(`/api/focus/${focusId}/pause`)
      .set("Authorization", `Bearer ${token}`);
    expect(paused.status).toBe(200);
    expect(paused.body.status).toBe("PAUSED");

    const resumed = await request(app)
      .post(`/api/focus/${focusId}/resume`)
      .set("Authorization", `Bearer ${token}`);
    expect(resumed.status).toBe(200);
    expect(resumed.body.status).toBe("RUNNING");

    const completed = await request(app)
      .post(`/api/focus/${focusId}/complete`)
      .set("Authorization", `Bearer ${token}`)
      .send({ completeTask: true });
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe("COMPLETED");
  });

  it("returns today dashboard with safe progress", async () => {
    const res = await request(app).get("/api/dashboard/today").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Number.isFinite(res.body.progress)).toBe(true);
    expect(res.body.progress).not.toBeNull();
    expect(Array.isArray(res.body.overdue)).toBe(true);
    expect(res.body.todayTasks).toBeTruthy();
  });

  it("returns week review", async () => {
    const res = await request(app).get("/api/dashboard/review").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.week).toHaveLength(7);
    expect(Number.isFinite(res.body.today.completion)).toBe(true);
  });

  it("manages categories and task filtering", async () => {
    const created = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId, name: "QA Lab", icon: "workflow", color: "#334155" });
    expect(created.status).toBe(201);
    const categoryId = created.body.id as string;

    const listed = await request(app)
      .get(`/api/projects/${projectId}/categories`)
      .set("Authorization", `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.some((c: { id: string }) => c.id === categoryId)).toBe(true);

    const renamed = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "QA Lab Updated" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe("QA Lab Updated");

    const emptyDelete = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId, name: "Empty Area" });
    expect(emptyDelete.status).toBe(201);
    const emptyId = emptyDelete.body.id as string;
    const deletedEmpty = await request(app)
      .delete(`/api/categories/${emptyId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(deletedEmpty.status).toBe(200);

    const withCategory = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Review Homepage", projectId, categoryId, priority: "HIGH" });
    expect(withCategory.status).toBe(201);
    expect(withCategory.body.categoryId).toBe(categoryId);
    expect(withCategory.body.category?.name).toBe("QA Lab Updated");

    const withoutCategory = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Uncategorized capture", projectId });
    expect(withoutCategory.status).toBe(201);
    expect(withoutCategory.body.categoryId).toBeNull();

    const otherProject = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "OTHER LAB" });
    expect(otherProject.status).toBe(201);
    const invalidAssign = await request(app)
      .put(`/api/tasks/${withCategory.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: otherProject.body.id, categoryId });
    expect(invalidAssign.status).toBe(400);

    const projectChanged = await request(app)
      .put(`/api/tasks/${withCategory.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: otherProject.body.id });
    expect(projectChanged.status).toBe(200);
    expect(projectChanged.body.categoryId).toBeNull();

    await request(app)
      .put(`/api/tasks/${withCategory.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId, categoryId });

    const filtered = await request(app)
      .get(`/api/tasks?projectId=${projectId}&categoryId=${categoryId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.items.every((task: { categoryId: string }) => task.categoryId === categoryId)).toBe(true);

    const search = await request(app)
      .get("/api/tasks?q=QA%20Lab")
      .set("Authorization", `Bearer ${token}`);
    expect(search.status).toBe(200);
    expect(search.body.items.some((task: { id: string }) => task.id === withCategory.body.id)).toBe(true);

    const blocked = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.message).toContain("tasks");

    const moved = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ unassign: true });
    expect(moved.status).toBe(200);

    await request(app).delete(`/api/projects/${otherProject.body.id}`).set("Authorization", `Bearer ${token}`);
    await request(app).delete(`/api/tasks/${withCategory.body.id}`).set("Authorization", `Bearer ${token}`);
    await request(app).delete(`/api/tasks/${withoutCategory.body.id}`).set("Authorization", `Bearer ${token}`);

    const stats = await request(app)
      .get(`/api/dashboard/stats?projectId=${projectId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(stats.status).toBe(200);
    expect(typeof stats.body.totalTasks).toBe("number");
  });

  it("stores checklist items as subtasks and updates parent status", async () => {
    const created = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Checklist parent",
        projectId,
        dueDate: todayIso(),
        subtasks: [{ title: "Step one" }, { title: "Step two" }],
      });
    expect(created.status).toBe(201);
    expect(created.body.subtasks).toHaveLength(2);
    expect(created.body.subtaskProgress).toEqual({ total: 2, completed: 0, percent: 0 });
    expect(created.body.status).toBe("TODO");

    const first = created.body.subtasks[0];
    const second = created.body.subtasks[1];
    const hidden = await request(app).get("/api/tasks?q=Step%20one").set("Authorization", `Bearer ${token}`);
    expect(hidden.body.items.some((task: { id: string }) => task.id === first.id)).toBe(false);

    await request(app)
      .patch(`/api/tasks/${first.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "DONE" });
    const halfway = await request(app).get(`/api/tasks/${created.body.id}`).set("Authorization", `Bearer ${token}`);
    expect(halfway.body.status).toBe("IN_PROGRESS");
    expect(halfway.body.subtaskProgress).toEqual({ total: 2, completed: 1, percent: 50 });

    await request(app)
      .patch(`/api/tasks/${second.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "DONE" });
    const done = await request(app).get(`/api/tasks/${created.body.id}`).set("Authorization", `Bearer ${token}`);
    expect(done.body.status).toBe("DONE");
    expect(done.body.subtaskProgress).toEqual({ total: 2, completed: 2, percent: 100 });

    await request(app).delete(`/api/tasks/${created.body.id}`).set("Authorization", `Bearer ${token}`);
  });

  it("reorders tasks with drag order payload", async () => {
    const first = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Reorder A", projectId, status: "TODO" });
    const second = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Reorder B", projectId, status: "TODO" });
    const third = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Reorder C", projectId, status: "TODO" });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(201);

    const reordered = await request(app)
      .post("/api/tasks/reorder")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [third.body.id, first.body.id, second.body.id] });
    expect(reordered.status).toBe(200);

    const list = await request(app)
      .get(`/api/tasks?projectId=${projectId}&q=Reorder`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    const ids = list.body.items
      .filter((task: { title: string }) => task.title.startsWith("Reorder"))
      .map((task: { id: string }) => task.id);
    expect(ids).toEqual([third.body.id, first.body.id, second.body.id]);

    await request(app).delete(`/api/tasks/${first.body.id}`).set("Authorization", `Bearer ${token}`);
    await request(app).delete(`/api/tasks/${second.body.id}`).set("Authorization", `Bearer ${token}`);
    await request(app).delete(`/api/tasks/${third.body.id}`).set("Authorization", `Bearer ${token}`);
  });

  it("manages users, members, comments, notifications and blocked tasks", { timeout: 120000 }, async () => {
    const created = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Ali", email: `ali-${Date.now()}@smartdevco.com`, role: "MEMBER" });
    expect(created.status).toBe(201);
    expect(created.body.passwordHash).toBeUndefined();
    expect(created.body.temporaryPassword).toBeTruthy();
    const memberId = created.body.id;

    const memberLogin = await request(app).post("/api/auth/login").send({
      email: created.body.email,
      password: created.body.temporaryPassword,
    });
    expect(memberLogin.status).toBe(200);
    const memberToken = memberLogin.body.token;

    const forbidden = await request(app).get("/api/users").set("Authorization", `Bearer ${memberToken}`);
    expect(forbidden.status).toBe(403);

    const added = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: memberId, role: "MEMBER" });
    expect(added.status).toBe(201);

    const shared = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Shared workspace task",
        projectId,
        assigneeIds: [memberId],
        dueDate: todayIso(),
      });
    expect(shared.status).toBe(201);
    expect(shared.body.assignees?.length).toBeGreaterThanOrEqual(1);

    const comment = await request(app)
      .post(`/api/tasks/${shared.body.id}/comments`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ message: "I updated the mobile layout." });
    expect(comment.status).toBe(201);

    const notes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);
    expect(notes.status).toBe(200);
    expect(Array.isArray(notes.body)).toBe(true);

    const blocked = await request(app)
      .patch(`/api/tasks/${shared.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "BLOCKED", blockedReason: "Waiting for API credentials." });
    expect(blocked.status).toBe(200);
    expect(blocked.body.status).toBe("BLOCKED");

    const done = await request(app)
      .patch(`/api/tasks/${shared.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "DONE" });
    expect(done.status).toBe(200);

    const recognition = await request(app)
      .post("/api/recognition")
      .set("Authorization", `Bearer ${token}`)
      .send({ recipientId: memberId, message: "Great job Ali!" });
    expect(recognition.status).toBe(201);

    const wall = await request(app).get("/api/recognition").set("Authorization", `Bearer ${memberToken}`);
    expect(wall.status).toBe(200);
    expect(wall.body.length).toBeGreaterThan(0);

    await request(app).post(`/api/users/${memberId}/deactivate`).set("Authorization", `Bearer ${token}`);
    await request(app).delete(`/api/tasks/${shared.body.id}`).set("Authorization", `Bearer ${token}`);
  });

  it("cleans up created records", async () => {
    await request(app).delete(`/api/notes/${noteId}`).set("Authorization", `Bearer ${token}`);
    await request(app).delete(`/api/time-blocks/${blockId}`).set("Authorization", `Bearer ${token}`);
    await request(app).delete(`/api/tasks/${taskId}`).set("Authorization", `Bearer ${token}`);
    await request(app).delete(`/api/projects/${projectId}`).set("Authorization", `Bearer ${token}`);
    await prisma.$disconnect();
  });
});
