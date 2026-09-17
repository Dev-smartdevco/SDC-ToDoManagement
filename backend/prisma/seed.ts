import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { addDays, format, subDays } from "date-fns";

const prisma = new PrismaClient();

function iso(date: Date) {
  return format(date, "yyyy-MM-dd");
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@smartdevco.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "SmartDevCo@2026";
  const name = process.env.ADMIN_NAME ?? "Ahmed";

  await prisma.taskTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.focusSession.deleteMany();
  await prisma.timeBlock.deleteMany();
  await prisma.note.deleteMany();
  await prisma.dailyReview.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  const today = new Date();
  const d = (offset: number) => iso(offset < 0 ? subDays(today, Math.abs(offset)) : addDays(today, offset));

  const [rootaca, shuttlez, nano, personal, ideas] = await Promise.all([
    prisma.project.create({
      data: {
        userId: user.id,
        name: "ROOTACA",
        description: "School partnerships, STEM offering, outreach, and brand materials.",
        status: "ACTIVE",
        icon: "graduation-cap",
        color: "#3A96D4",
      },
    }),
    prisma.project.create({
      data: {
        userId: user.id,
        name: "SHUTTLEZ",
        description: "Transport platform — mobile releases, backend, and operations.",
        status: "ACTIVE",
        icon: "bus",
        color: "#0F9D6E",
      },
    }),
    prisma.project.create({
      data: {
        userId: user.id,
        name: "NANO",
        description: "Implementation follow-up, planning, and status reporting.",
        status: "ACTIVE",
        icon: "cpu",
        color: "#7C5CFC",
      },
    }),
    prisma.project.create({
      data: {
        userId: user.id,
        name: "PERSONAL",
        description: "Personal admin, learning, and weekly planning.",
        status: "ACTIVE",
        icon: "user",
        color: "#D97706",
      },
    }),
    prisma.project.create({
      data: {
        userId: user.id,
        name: "BUSINESS / IDEAS",
        description: "New ventures, research notes, and opportunity capture.",
        status: "ACTIVE",
        icon: "lightbulb",
        color: "#DB2777",
      },
    }),
  ]);

  const task = (
    title: string,
    projectId: string,
    extra: Partial<{
      status: "INBOX" | "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
      priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      dueDate: string | null;
      dueTime: string | null;
      estimatedMinutes: number;
      description: string;
      completedAt: Date;
    }> = {},
  ) =>
    prisma.task.create({
      data: {
        userId: user.id,
        title,
        projectId,
        status: extra.status ?? "TODO",
        priority: extra.priority ?? "MEDIUM",
        dueDate: extra.dueDate ?? d(0),
        dueTime: extra.dueTime ?? null,
        estimatedMinutes: extra.estimatedMinutes ?? 30,
        description: extra.description ?? null,
        completedAt: extra.completedAt ?? null,
      },
    });

  const [
    schoolProfile,
    outreach,
    brochure,
    social,
    deploy,
    android,
    backend,
    nanoPlan,
    nanoFollow,
    nanoStatus,
    weekly,
    learning,
    followUp,
    inboxCall,
    inboxIdea,
  ] = await Promise.all([
    task("Prepare Rootaca School Partnership Profile", rootaca.id, {
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueTime: "10:00",
      estimatedMinutes: 45,
      description: "Positioning, STEM offering, pricing outline, and contact path.",
    }),
    task("Create school outreach list", rootaca.id, {
      priority: "HIGH",
      dueTime: "11:30",
      estimatedMinutes: 30,
    }),
    task("Fix Rootaca brochure", rootaca.id, {
      status: "DONE",
      priority: "HIGH",
      estimatedMinutes: 45,
      completedAt: new Date(),
    }),
    task("Review social media content", rootaca.id, {
      priority: "MEDIUM",
      dueDate: d(1),
      estimatedMinutes: 25,
    }),
    task("Review Shuttlez deployment", shuttlez.id, {
      priority: "MEDIUM",
      dueTime: "14:00",
      estimatedMinutes: 30,
    }),
    task("Check Android releases", shuttlez.id, {
      priority: "HIGH",
      dueDate: d(-1),
      estimatedMinutes: 40,
    }),
    task("Review backend tasks", shuttlez.id, {
      priority: "MEDIUM",
      dueDate: d(2),
      estimatedMinutes: 35,
    }),
    task("Review project plan", nano.id, {
      priority: "HIGH",
      estimatedMinutes: 40,
    }),
    task("Follow up on implementation", nano.id, {
      priority: "MEDIUM",
      dueDate: d(-2),
      estimatedMinutes: 20,
    }),
    task("Prepare status update", nano.id, {
      priority: "MEDIUM",
      dueDate: d(1),
      estimatedMinutes: 25,
    }),
    task("Weekly planning", personal.id, {
      priority: "HIGH",
      dueTime: "17:30",
      estimatedMinutes: 30,
    }),
    task("Learning block", personal.id, {
      priority: "LOW",
      dueDate: d(0),
      estimatedMinutes: 45,
    }),
    task("Important follow-up", personal.id, {
      priority: "URGENT",
      dueDate: d(-3),
      estimatedMinutes: 15,
    }),
    task("Call school tomorrow", rootaca.id, {
      status: "INBOX",
      priority: "MEDIUM",
      dueDate: null,
      estimatedMinutes: 15,
    }),
    task("Research AI SaaS idea", ideas.id, {
      status: "INBOX",
      priority: "LOW",
      dueDate: null,
      estimatedMinutes: 40,
    }),
  ]);

  await prisma.user.update({
    where: { id: user.id },
    data: { currentFocusTaskId: schoolProfile.id },
  });

  const tag = (name: string) =>
    prisma.tag.create({ data: { userId: user.id, name } });
  const [focusTag, followTag, ideaTag] = await Promise.all([tag("focus"), tag("follow-up"), tag("idea")]);
  await prisma.taskTag.createMany({
    data: [
      { taskId: schoolProfile.id, tagId: focusTag.id },
      { taskId: followUp.id, tagId: followTag.id },
      { taskId: inboxIdea.id, tagId: ideaTag.id },
    ],
  });

  await prisma.note.createMany({
    data: [
      {
        userId: user.id,
        projectId: rootaca.id,
        taskId: schoolProfile.id,
        title: "School Partnership",
        content:
          "Need school profile\nNeed pricing\nNeed STEM offering\nNeed contact database\nNeed presentation",
        tags: ["rootaca", "partnership"],
      },
      {
        userId: user.id,
        projectId: shuttlez.id,
        title: "Release checklist",
        content: "Android store listing\nBackend health\nQA smoke on staging\nRollback notes",
        tags: ["release"],
      },
      {
        userId: user.id,
        projectId: ideas.id,
        title: "AI SaaS idea",
        content: "Personal OS for operators. Fast capture. Daily focus. No enterprise clutter.",
        tags: ["idea"],
      },
    ],
  });

  await prisma.timeBlock.createMany({
    data: [
      {
        userId: user.id,
        title: "School Partnership",
        projectId: rootaca.id,
        taskId: schoolProfile.id,
        date: d(0),
        startTime: "09:00",
        endTime: "10:00",
      },
      {
        userId: user.id,
        title: "Follow-ups",
        projectId: personal.id,
        date: d(0),
        startTime: "10:00",
        endTime: "10:30",
      },
      {
        userId: user.id,
        title: "Admin",
        projectId: personal.id,
        date: d(0),
        startTime: "12:00",
        endTime: "13:00",
      },
      {
        userId: user.id,
        title: "SHUTTLEZ",
        projectId: shuttlez.id,
        taskId: deploy.id,
        date: d(0),
        startTime: "14:00",
        endTime: "15:00",
      },
      {
        userId: user.id,
        title: "Personal",
        projectId: personal.id,
        date: d(0),
        startTime: "17:00",
        endTime: "18:00",
      },
    ],
  });

  await prisma.dailyReview.createMany({
    data: Array.from({ length: 7 }).map((_, i) => {
      const date = d(i - 6);
      const planned = 8 + (i % 3);
      const completed = Math.max(3, planned - (i % 4));
      return {
        userId: user.id,
        date,
        plannedTasks: planned,
        completedTasks: completed,
        focusMinutes: 70 + i * 12,
        notes: i === 6 ? "Keep school profile as the single focus." : null,
      };
    }),
  });

  await prisma.focusSession.create({
    data: {
      userId: user.id,
      taskId: brochure.id,
      startedAt: subDays(today, 0),
      endedAt: today,
      durationMinutes: 45,
      accumulatedSeconds: 45 * 60,
      status: "COMPLETED",
    },
  });

  console.log("Seed complete");
  console.log(`Admin: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
