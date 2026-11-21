import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

export function firebaseConfigured() {
  return firebaseAccount() != null;
}

export function firebaseConfigError() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return "FIREBASE_SERVICE_ACCOUNT is missing";
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return "FIREBASE_SERVICE_ACCOUNT is incomplete";
    return null;
  } catch {
    return "FIREBASE_SERVICE_ACCOUNT is not valid JSON";
  }
}

let configReported = false;

export function reportFirebaseConfig() {
  if (configReported) return;
  configReported = true;
  const error = firebaseConfigError();
  if (error) console.error(`fcm.config ${error}`);
}

export function firebaseAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function isInvalidDeviceToken(code = "", message = "") {
  const text = `${code} ${message}`.toUpperCase();
  if (text.includes("UNREGISTERED") || text.includes("NOT_FOUND") || text.includes("REGISTRATION-TOKEN-NOT-REGISTERED")) return true;
  if (text.includes("INVALID-REGISTRATION-TOKEN") || text.includes("INVALID_REGISTRATION")) return true;
  if (text.includes("NOT A VALID FCM REGISTRATION TOKEN")) return true;
  const invalidArgument = text.includes("INVALID_ARGUMENT") || text.includes("INVALID-ARGUMENT");
  return invalidArgument && (text.includes("TOKEN") || text.includes("REGISTRATION"));
}

function publicError(message: string) {
  return message.replace(/[A-Za-z0-9_.:-]{80,}/g, "[redacted]").slice(0, 240);
}

function messaging() {
  const account = firebaseAccount();
  if (!account) return null;
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: account.project_id,
        clientEmail: account.client_email,
        privateKey: account.private_key,
      }),
    });
  }
  return getMessaging();
}

export async function sendFcm(token: string, payload: Record<string, string>, badge = 1) {
  const client = messaging();
  if (!client) return { ok: false as const, error: "FCM is not configured", invalid: false };
  const preview = payload.lockScreenPreview === "false" ? "You have a new SDC-TASKS notification." : payload.body;
  const sound = payload.sound === "false" ? undefined : "default";
  try {
    await client.send({
      token,
      notification: { title: payload.title, body: preview },
      data: payload,
      android: {
        priority: payload.priority === "High" ? "high" : "normal",
        notification: { channelId: "myos_alerts", sound },
      },
      apns: {
        headers: {
          "apns-priority": payload.priority === "High" ? "10" : "5",
          "apns-push-type": "alert",
        },
        payload: {
          aps: {
            alert: { title: payload.title, body: preview },
            sound,
            badge,
          },
        },
      },
    });
    return { ok: true as const, error: null, invalid: false };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    const message = error instanceof Error ? error.message : "Push delivery failed";
    const safe = publicError(`${code} ${message}`.trim());
    console.error("fcm.send", safe);
    return { ok: false as const, error: safe, invalid: isInvalidDeviceToken(code, message) };
  }
}
