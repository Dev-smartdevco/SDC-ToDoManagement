import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/notificationEngine.js", () => ({
  processDeliveryQueue: vi.fn(async () => 0),
  startNotificationWorkers: vi.fn(() => () => undefined),
}));

import request from "supertest";
import { createApp } from "../app.js";
import { processDeliveryQueue } from "../services/notificationEngine.js";

describe("notification delivery retry endpoint", () => {
  beforeEach(() => {
    processDeliveryQueue.mockClear();
    processDeliveryQueue.mockResolvedValue(0);
    delete process.env.CRON_SECRET;
  });

  it("hides the endpoint when the secret is missing or wrong", async () => {
    const app = createApp();
    const missing = await request(app).get("/api/internal/notification-deliveries");
    expect(missing.status).toBe(404);
    process.env.CRON_SECRET = "cron-test-secret";
    const denied = await request(app)
      .post("/api/internal/notification-deliveries")
      .set("Authorization", "Bearer wrong");
    expect(denied.status).toBe(404);
    expect(processDeliveryQueue).not.toHaveBeenCalled();
    expect(JSON.stringify(denied.body)).not.toContain("cron-test-secret");
  });

  it("runs one retry pass for a matching secret and omits the secret from the response", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    processDeliveryQueue.mockResolvedValue(2);
    const app = createApp();
    const response = await request(app)
      .get("/api/internal/notification-deliveries")
      .set("Authorization", "Bearer cron-test-secret");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, processed: 2 });
    expect(JSON.stringify(response.body)).not.toContain("cron-test-secret");
    expect(processDeliveryQueue).toHaveBeenCalledTimes(1);
  });
});
