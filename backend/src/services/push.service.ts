import jwt from "jsonwebtoken";

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

let cached: { token: string; exp: number } | null = null;

export function firebaseConfigured() {
  return firebaseAccount() != null;
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

async function accessToken(account: ServiceAccount) {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const assertion = jwt.sign(
    { scope: "https://www.googleapis.com/auth/firebase.messaging" },
    account.private_key,
    {
      algorithm: "RS256",
      issuer: account.client_email,
      audience: "https://oauth2.googleapis.com/token",
      expiresIn: "55m",
    },
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`FCM auth failed (${response.status})`);
  const json = (await response.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export async function sendFcm(token: string, payload: Record<string, string>, badge = 1) {
  const account = firebaseAccount();
  if (!account) return { ok: false as const, error: "FCM is not configured", invalid: false };
  try {
    const access = await accessToken(account);
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: payload.title,
            body: payload.lockScreenPreview === "false" ? "You have a new MY OS notification." : payload.body,
          },
          data: payload,
          android: {
            priority: payload.priority === "High" ? "HIGH" : "NORMAL",
            notification: { channel_id: "myos_alerts", sound: payload.sound === "false" ? undefined : "default" },
          },
          apns: {
            headers: { "apns-priority": payload.priority === "High" ? "10" : "5" },
            payload: { aps: { sound: payload.sound === "false" ? undefined : "default", badge } },
          },
        },
      }),
    });
    if (response.ok) return { ok: true as const, error: null, invalid: false };
    const text = await response.text();
    const invalid = /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(text);
    return { ok: false as const, error: text.slice(0, 400), invalid };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Push delivery failed", invalid: false };
  }
}
