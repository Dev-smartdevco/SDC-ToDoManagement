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
  const started = Date.now();
  for (let offset = 0; offset < 100000; offset += 2000) {
    await prisma.task.createMany({
      data: Array.from({ length: 2000 }, (_, index) => ({
        userId: admin.id,
        title: `PERF_SEED 100k-${offset + index}`,
        status: "TODO",
        priority: "MEDIUM",
        dueDate: "2026-12-20",
      })),
    });
  }
  const queryStarted = Date.now();
  const response = await fetch("http://localhost:4000/api/tasks?view=all&page=1&pageSize=20", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  const total = await prisma.task.count();
  console.log(
    JSON.stringify({
      total,
      status: response.status,
      ms: Date.now() - queryStarted,
      bytes: text.length,
      seedMs: Date.now() - started,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const removed = await prisma.task.deleteMany({ where: { title: { startsWith: "PERF_SEED " } } });
    console.log(JSON.stringify({ removed: removed.count }));
    await prisma.$disconnect();
  });
