import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: process.env.ADMIN_EMAIL },
    select: { id: true },
  });
  if (!admin) throw new Error("admin missing");
  const login = await fetch("http://localhost:4000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  const token = (await login.json()).token;
  const cached = [];
  for (let i = 0; i < 2; i += 1) {
    const started = Date.now();
    const response = await fetch("http://localhost:4000/api/analytics", {
      headers: { Authorization: `Bearer ${token}` },
    });
    await response.text();
    cached.push(Date.now() - started);
  }
  console.log(JSON.stringify({ cachedAnalyticsMs: cached }));

  async function once(path) {
    const started = Date.now();
    const response = await fetch(`http://localhost:4000/api${path}`, {
      headers: { Authorization: `Bearer ${token}`, "x-bypass-cache": "1" },
    });
    const text = await response.text();
    return { status: response.status, ms: Date.now() - started, bytes: text.length };
  }

  for (const count of [1000, 10000]) {
    const started = Date.now();
    for (let offset = 0; offset < count; offset += 1000) {
      const size = Math.min(1000, count - offset);
      await prisma.task.createMany({
        data: Array.from({ length: size }, (_, index) => {
          const n = offset + index;
          return {
            userId: admin.id,
            title: `PERF_SEED ${count}-${n}`,
            status: n % 7 === 0 ? "DONE" : "TODO",
            priority: "MEDIUM",
            dueDate: n % 4 === 0 ? "2026-11-21" : "2026-12-15",
          };
        }),
      });
    }
    const tasks = await once("/tasks?view=all&page=1&pageSize=20");
    const dash = await once("/dashboard/today?date=2026-11-21");
    const total = await prisma.task.count();
    await prisma.task.deleteMany({ where: { title: { startsWith: "PERF_SEED " } } });
    console.log(JSON.stringify({ added: count, totalDuringTest: total, seedMs: Date.now() - started, tasks, dash }));
  }
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
