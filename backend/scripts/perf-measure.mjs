import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const base = process.env.PERF_BASE ?? "http://localhost:4000/api";
const rounds = Number(process.env.PERF_ROUNDS ?? 15);
const seed = Number(process.env.PERF_SEED ?? 0);
const prisma = new PrismaClient();

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[index] * 10) / 10;
}

async function login() {
  const response = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }),
  });
  if (!response.ok) throw new Error(`login ${response.status}`);
  const body = await response.json();
  return body.token;
}

async function sample(token, path) {
  const times = [];
  let bytes = 0;
  let status = 0;
  for (let i = 0; i < rounds + 1; i += 1) {
    const started = performance.now();
    const response = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}`, "x-bypass-cache": "1" },
    });
    const text = await response.text();
    const elapsed = performance.now() - started;
    status = response.status;
    if (i === 0) continue;
    times.push(elapsed);
    bytes = Buffer.byteLength(text);
  }
  times.sort((a, b) => a - b);
  return {
    path,
    status,
    samples: times.length,
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
    bytes,
  };
}

async function explain(userId) {
  const rows = await prisma.$queryRawUnsafe(
    `EXPLAIN (ANALYZE, BUFFERS)
     SELECT "id" FROM "Task"
     WHERE "userId" = $1 AND "parentTaskId" IS NULL
     ORDER BY "sortOrder" ASC, "createdAt" DESC
     LIMIT 20`,
    userId,
  );
  return rows.map((row) => row["QUERY PLAN"]).join("\n");
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: process.env.ADMIN_EMAIL ?? "admin@smartdevco.com" },
    select: { id: true },
  });
  if (!admin) throw new Error("admin missing");
  if (seed > 0) {
    const batch = 1000;
    for (let offset = 0; offset < seed; offset += batch) {
      const size = Math.min(batch, seed - offset);
      await prisma.task.createMany({
        data: Array.from({ length: size }, (_, index) => {
          const n = offset + index;
          return {
            userId: admin.id,
            title: `PERF_SEED ${n}`,
            status: n % 7 === 0 ? "DONE" : n % 11 === 0 ? "BLOCKED" : "TODO",
            priority: n % 5 === 0 ? "HIGH" : "MEDIUM",
            dueDate: n % 4 === 0 ? "2026-11-21" : "2026-12-15",
          };
        }),
      });
    }
  }
  const counts = {
    tasks: await prisma.task.count(),
    notifications: await prisma.notification.count(),
    projects: await prisma.project.count(),
    notes: await prisma.note.count(),
    seeded: seed,
  };
  const token = await login();
  const today = new Date().toISOString().slice(0, 10);
  const paths = [
    `/dashboard/today?date=${today}`,
    "/tasks?view=all&page=1&limit=20",
    "/tasks?view=overdue&page=1&limit=20",
    "/tasks?q=plan&page=1&limit=20",
    "/projects",
    "/notifications?page=1&limit=20",
    `/calendar?from=${today}&to=${today}`,
    "/analytics",
    "/notes",
    "/recognition",
  ];
  const results = [];
  for (const path of paths) results.push(await sample(token, path));
  const plan = await explain(admin.id);
  console.log(JSON.stringify({ counts, results, plan }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.task.deleteMany({ where: { title: { startsWith: "PERF_SEED " } } });
    await prisma.$disconnect();
  });
