import { describe, expect, it } from "vitest";
import {
  allowsInApp,
  allowsPush,
  categoryFor,
  deepLinkFor,
  deliveryOutcome,
  fcmData,
  pushRoute,
  quietHoursActive,
  retryDelayMs,
} from "../lib/notificationPolicy.js";

describe("notification policy", () => {
  it("maps task assignment to the Tasks category and a task deep link", () => {
    expect(categoryFor("TASK_ASSIGNED")).toBe("Tasks");
    expect(deepLinkFor("Task", "task-1")).toBe("myos://tasks/task-1");
    expect(pushRoute("myos://tasks/task-1", "task-1")).toBe("task:task-1");
    const data = fcmData({
      notificationId: "n1",
      type: "TASK_ASSIGNED",
      category: "Tasks",
      title: "New task assigned",
      body: "A task has been assigned to you",
      taskId: "task-1",
      deepLink: "myos://tasks/task-1",
      priority: "High",
      sound: "true",
      lockScreenPreview: "true",
    });
    expect(data.route).toBe("task:task-1");
    expect(data.taskId).toBe("task-1");
    expect(data.type).toBe("TASK_ASSIGNED");
  });

  it("keeps security alerts even when push and categories are off", () => {
    expect(allowsPush({ System: false, Tasks: false }, "PASSWORD_CHANGED", false)).toBe(true);
    expect(allowsInApp({ Tasks: false }, "TASK_ASSIGNED", true)).toBe(false);
    expect(allowsPush({ Tasks: true }, "TASK_ASSIGNED", false)).toBe(false);
  });

  it("detects overnight quiet hours", () => {
    const night = new Date("2026-11-21T22:30:00Z");
    expect(quietHoursActive(night, "22:00", "07:00", "UTC")).toBe(true);
    expect(quietHoursActive(night, "09:00", "17:00", "UTC")).toBe(false);
  });

  it("backs off retries and stops after invalid or repeated failures", () => {
    expect(retryDelayMs(1)).toBeLessThan(retryDelayMs(3));
    expect(retryDelayMs(10)).toBeLessThanOrEqual(60 * 60_000);
    expect(deliveryOutcome({ ok: true, invalid: false, attempts: 0 }).status).toBe("SENT");
    const invalid = deliveryOutcome({ ok: false, invalid: true, error: "unregistered", attempts: 0 });
    expect(invalid.status).toBe("DEAD");
    expect(invalid.deactivate).toBe(true);
    const temporary = deliveryOutcome({ ok: false, invalid: false, error: "unavailable", attempts: 0 });
    expect(temporary.status).toBe("PENDING");
    expect(temporary.delayMs).toBeGreaterThan(0);
    const exhausted = deliveryOutcome({ ok: false, invalid: false, error: "unavailable", attempts: 5 });
    expect(exhausted.status).toBe("DEAD");
    expect(exhausted.deactivate).toBe(false);
  });
});
