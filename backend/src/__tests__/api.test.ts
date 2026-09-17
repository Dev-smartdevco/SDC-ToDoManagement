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

  it("cleans up created records", async () => {
    await request(app).delete(`/api/notes/${noteId}`).set("Authorization", `Bearer ${token}`);
    await request(app).delete(`/api/time-blocks/${blockId}`).set("Authorization", `Bearer ${token}`);
    await request(app).delete(`/api/tasks/${taskId}`).set("Authorization", `Bearer ${token}`);
    await request(app).delete(`/api/projects/${projectId}`).set("Authorization", `Bearer ${token}`);
    await prisma.$disconnect();
  });
});
