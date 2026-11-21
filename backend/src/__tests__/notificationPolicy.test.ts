import { describe, expect, it } from "vitest";
import {
  allowsInApp,
  allowsPush,
  categoryFor,
  deepLinkFor,
  quietHoursActive,
  retryDelayMs,
} from "../lib/notificationPolicy.js";

describe("notification policy", () => {
  it("maps task assignment to the Tasks category and a task deep link", () => {
    expect(categoryFor("TASK_ASSIGNED")).toBe("Tasks");
    expect(deepLinkFor("Task", "task-1")).toBe("myos://tasks/task-1");
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

  it("backs off retries", () => {
    expect(retryDelayMs(1)).toBeLessThan(retryDelayMs(3));
    expect(retryDelayMs(10)).toBeLessThanOrEqual(60 * 60_000);
  });
});
