import { describe, expect, it } from "vitest";
import { firebaseConfigError, firebaseConfigured, isInvalidDeviceToken } from "../services/push.service.js";

describe("FCM delivery errors", () => {
  it("marks expired and malformed device tokens as invalid", () => {
    expect(isInvalidDeviceToken("messaging/registration-token-not-registered")).toBe(true);
    expect(isInvalidDeviceToken("", "The registration token is not a valid FCM registration token")).toBe(true);
    expect(isInvalidDeviceToken("messaging/invalid-argument", "The registration token is invalid")).toBe(true);
    expect(isInvalidDeviceToken("messaging/invalid-argument", "payload field is missing")).toBe(false);
    expect(isInvalidDeviceToken("messaging/internal-error", "temporarily unavailable")).toBe(false);
  });

  it("does not treat a missing service account as a configured project", () => {
    const previous = process.env.FIREBASE_SERVICE_ACCOUNT;
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    expect(firebaseConfigured()).toBe(false);
    expect(firebaseConfigError()).toBe("FIREBASE_SERVICE_ACCOUNT is missing");
    process.env.FIREBASE_SERVICE_ACCOUNT = "{";
    expect(firebaseConfigError()).toBe("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: "sdc-todomanagement" });
    expect(firebaseConfigError()).toBe("FIREBASE_SERVICE_ACCOUNT is incomplete");
    if (previous === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT;
    else process.env.FIREBASE_SERVICE_ACCOUNT = previous;
  });
});
