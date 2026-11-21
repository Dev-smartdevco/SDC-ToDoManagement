import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { claimDelivery, dispatchNotification } from "../services/notificationEngine.js";

const app = createApp();
const password = "NotifyTest#2026";
const email = `notify-${Date.now()}@smartdevco.test`;

let adminToken = "";
let adminId = "";
let memberToken = "";
let memberId = "";
let projectId = "";
let taskId = "";

async function waitFor<T>(read: () => Promise<T | null | undefined>) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const value = await read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return null;
}

describe("notification system", () => {
  beforeAll(async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: process.env.ADMIN_EMAIL ?? "admin@smartdevco.com", password: process.env.ADMIN_PASSWORD ?? "SmartDevCo@2026" });
    expect(login.status).toBe(200);
    adminToken = login.body.token;
    adminId = login.body.user.id;
    const member = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Ali Notify", email, password, role: "MEMBER" });
    expect(member.status).toBe(201);
    memberId = member.body.id;
    const session = await request(app).post("/api/auth/login").send({ email, password });
    expect(session.status).toBe(200);
    memberToken = session.body.token;
    const project = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Notify Lab", color: "#334155" });
    expect(project.status).toBe(201);
    projectId = project.body.id;
  });

  afterAll(async () => {
    if (taskId) await prisma.task.deleteMany({ where: { id: taskId } });
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
    if (memberId) {
      await prisma.notification.deleteMany({ where: { userId: memberId } });
      await prisma.device.deleteMany({ where: { userId: memberId } });
      await prisma.notificationPreference.deleteMany({ where: { userId: memberId } });
      await prisma.scheduledReminder.deleteMany({ where: { userId: memberId } });
      await prisma.user.deleteMany({ where: { id: memberId } });
    }
  });

  it("does not notify the actor and notifies every other assignee once", async () => {
    const otherEmail = `notify-other-${Date.now()}@smartdevco.test`;
    const other = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Nour Notify", email: otherEmail, password, role: "MEMBER" });
    expect(other.status).toBe(201);
    const otherId = other.body.id as string;
    const created = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Shared assignment", projectId, assigneeIds: [memberId, otherId, adminId] });
    expect(created.status).toBe(201);
    const task = created.body.id as string;
    const notes = await waitFor(async () => {
      const rows = await prisma.notification.findMany({ where: { taskId: task, type: "TASK_CREATED" } });
      return rows.length >= 2 ? rows : null;
    });
    expect(notes?.map((row) => row.userId).sort()).toEqual([memberId, otherId].sort());
    await dispatchNotification({
      userIds: [memberId, otherId, adminId],
      type: "TASK_CREATED",
      title: "New task assigned",
      body: "Shared assignment",
      actorId: adminId,
      taskId: task,
      eventId: `created:${task}`,
    });
    const again = await prisma.notification.count({ where: { taskId: task, type: "TASK_CREATED" } });
    expect(again).toBe(2);

    const comment = await request(app)
      .post(`/api/tasks/${task}/comments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ message: "Please review this" });
    expect(comment.status).toBe(201);
    const comments = await waitFor(async () => {
      const rows = await prisma.notification.findMany({ where: { taskId: task, type: "COMMENT_ADDED" } });
      return rows.length >= 2 ? rows : null;
    });
    expect(comments?.map((row) => row.userId).sort()).toEqual([memberId, otherId].sort());
    expect(comments?.some((row) => row.userId === adminId)).toBe(false);

    await prisma.notification.deleteMany({ where: { taskId: task } });
    await prisma.task.deleteMany({ where: { id: task } });
    await prisma.notification.deleteMany({ where: { userId: otherId } });
    await prisma.user.deleteMany({ where: { id: otherId } });
  });

  it("creates a task notification for the assignee with a task deep link", async () => {
    const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60_000).toISOString().slice(0, 10);
    const created = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Review project plan", projectId, assigneeIds: [memberId], dueDate: tomorrow, dueTime: "15:00" });
    expect(created.status).toBe(201);
    taskId = created.body.id;

    const note = await waitFor(async () => {
      const row = await prisma.notification.findFirst({
        where: { userId: memberId, taskId, type: "TASK_CREATED" },
      });
      return row;
    });
    expect(note?.title).toContain("New task");
    expect(note?.deepLink).toBe(`myos://tasks/${taskId}`);
    expect(note?.readAt).toBeNull();

    const listed = await request(app)
      .get("/api/notifications?page=1&category=Tasks")
      .set("Authorization", `Bearer ${memberToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.items.some((item: { id: string }) => item.id === note?.id)).toBe(true);

    const hidden = await request(app).get(`/api/notifications/${note?.id}`).set("Authorization", `Bearer ${adminToken}`);
    expect(hidden.status).toBe(404);

    const read = await request(app).patch(`/api/notifications/${note?.id}/read`).set("Authorization", `Bearer ${memberToken}`);
    expect(read.status).toBe(200);
    expect(read.body.readAt).toBeTruthy();
  });

  it("schedules reminders and cancels them when the task is completed", async () => {
    const reminder = await waitFor(() => prisma.scheduledReminder.findFirst({ where: { taskId, cancelled: false } }));
    expect(reminder?.taskId).toBe(taskId);
    const done = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "DONE" });
    expect(done.status).toBe(200);
    const cancelled = await waitFor(() => prisma.scheduledReminder.findFirst({ where: { taskId, cancelled: true } }));
    expect(cancelled?.cancelled).toBe(true);
  });

  it("keeps the notification when push delivery fails and ignores duplicate events", async () => {
    const before = await prisma.notification.count({ where: { userId: memberId, type: "RECOGNITION" } });
    await dispatchNotification({
      userIds: [memberId],
      type: "RECOGNITION",
      title: "Recognition",
      body: "Nice work",
      eventId: "recognition-once",
    });
    await dispatchNotification({
      userIds: [memberId],
      type: "RECOGNITION",
      title: "Recognition",
      body: "Nice work",
      eventId: "recognition-once",
    });
    const after = await prisma.notification.count({ where: { userId: memberId, type: "RECOGNITION" } });
    expect(after).toBe(before + 1);

    await request(app)
      .put("/api/notifications/preferences")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ quietStart: "00:00", quietEnd: "23:59", timeZone: "UTC" });
    const device = await request(app)
      .post("/api/notifications/devices/register")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ token: `test-token-${memberId}`, platform: "ANDROID", name: "Test phone" });
    expect(device.status).toBe(201);

    await dispatchNotification({
      userIds: [memberId],
      type: "COMMENT_ADDED",
      title: "New comment",
      body: "A comment arrived during quiet hours.",
      eventId: "quiet-comment",
    });
    const saved = await prisma.notification.findFirst({ where: { userId: memberId, eventId: `quiet-comment:${memberId}` } });
    expect(saved).toBeTruthy();
    const delivery = await prisma.notificationDelivery.findFirst({ where: { notificationId: saved?.id } });
    expect(delivery?.status).toBe("PENDING");
    expect(delivery && delivery.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 60_000);
  });

  it("respects a disabled category and still stores security alerts", async () => {
    await request(app)
      .put("/api/notifications/preferences")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ categories: { Notes: false }, quietStart: null, quietEnd: null });
    await dispatchNotification({
      userIds: [memberId],
      type: "NOTE_SHARED",
      title: "Note",
      body: "Hidden by preference",
      eventId: "note-off",
    });
    const hidden = await prisma.notification.findFirst({ where: { eventId: `note-off:${memberId}` } });
    expect(hidden).toBeNull();
    await dispatchNotification({
      userIds: [memberId],
      type: "PASSWORD_CHANGED",
      title: "Password changed",
      body: "Security alert",
      eventId: "password-alert",
    });
    const security = await prisma.notification.findFirst({ where: { eventId: `password-alert:${memberId}` } });
    expect(security?.type).toBe("PASSWORD_CHANGED");
  });

  it("registers, refreshes, and removes a device token for the signed-in user", async () => {
    const token = `ios-token-${memberId}`;
    const created = await request(app)
      .post("/api/notifications/devices")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ token, platform: "ios" });
    expect(created.status).toBe(201);
    expect(created.body.token).toBeUndefined();
    const refreshed = await request(app)
      .post("/api/notifications/devices")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ token, platform: "IOS", name: "iPhone" });
    expect(refreshed.status).toBe(201);
    expect(refreshed.body.id).toBe(created.body.id);
    const rows = await prisma.device.findMany({ where: { token } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.active).toBe(true);

    const anonymous = await request(app).post("/api/notifications/devices").send({ token: "x", platform: "IOS" });
    expect(anonymous.status).toBe(401);
    const stolen = await request(app)
      .delete("/api/notifications/devices")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ token });
    expect(stolen.status).toBe(404);
    const removed = await request(app)
      .delete("/api/notifications/devices")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ token });
    expect(removed.status).toBe(200);
    const after = await prisma.device.findUnique({ where: { token } });
    expect(after?.active).toBe(false);
  });

  it("moves a rotated token to the account that registers it", async () => {
    const token = `switch-token-${memberId}`;
    const created = await request(app)
      .post("/api/notifications/devices")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ token, platform: "IOS" });
    expect(created.status).toBe(201);
    const moved = await request(app)
      .post("/api/notifications/devices")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ token, platform: "IOS" });
    expect(moved.status).toBe(201);
    const row = await prisma.device.findUnique({ where: { token } });
    expect(row?.userId).toBe(adminId);
    expect(row?.active).toBe(true);
    const denied = await request(app)
      .delete("/api/notifications/devices")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ token });
    expect(denied.status).toBe(404);
    const removed = await request(app)
      .delete("/api/notifications/devices")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ token });
    expect(removed.status).toBe(200);
    expect((await prisma.device.findUnique({ where: { token } }))?.active).toBe(false);
  });

  it("lets only one worker claim a pending delivery", async () => {
    const note = await prisma.notification.create({
      data: {
        userId: memberId,
        type: "TASK_ASSIGNED",
        title: "Claim",
        body: "Claim",
        eventId: `claim:${memberId}:${Date.now()}`,
      },
    });
    const delivery = await prisma.notificationDelivery.create({
      data: { notificationId: note.id, status: "PENDING", nextAttemptAt: new Date() },
    });
    const results = await Promise.all([claimDelivery(delivery.id), claimDelivery(delivery.id)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((value) => !value)).toHaveLength(1);
    await prisma.notification.delete({ where: { id: note.id } });
  });

  it("keeps the delivery worker private and reports push configuration without secrets", async () => {
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
    expect(typeof health.body.push).toBe("boolean");
    expect(JSON.stringify(health.body)).not.toMatch(/private_key|BEGIN PRIVATE/);
    const previous = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    const hidden = await request(app).get("/api/internal/notification-deliveries");
    expect(hidden.status).toBe(404);
    process.env.CRON_SECRET = "cron-test-secret";
    const denied = await request(app)
      .post("/api/internal/notification-deliveries")
      .set("Authorization", "Bearer wrong");
    expect(denied.status).toBe(404);
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  });

  it("does not let a user delete another user's device", async () => {
    const device = await prisma.device.findFirst({ where: { userId: memberId } });
    const blocked = await request(app)
      .delete(`/api/notifications/devices/${device?.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(blocked.status).toBe(404);
  });
});
