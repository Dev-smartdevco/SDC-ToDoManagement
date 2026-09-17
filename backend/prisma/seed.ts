import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { addDays, format, subDays } from "date-fns";

const prisma = new PrismaClient();

function iso(date: Date) {
  return format(date, "yyyy-MM-dd");
}

const ROOTACA_CATEGORIES = [
  { name: "Website", icon: "globe", color: "#3A96D4", sortOrder: 1 },
  { name: "Admin", icon: "settings", color: "#64748B", sortOrder: 2 },
  { name: "School Partnerships", icon: "school", color: "#0F9D6E", sortOrder: 3 },
  { name: "Programs", icon: "graduation-cap", color: "#7C5CFC", sortOrder: 4 },
  { name: "Students & Guidance", icon: "users", color: "#0F766E", sortOrder: 5 },
  { name: "Social Media", icon: "smartphone", color: "#DB2777", sortOrder: 6 },
  { name: "Content", icon: "video", color: "#D97706", sortOrder: 7 },
  { name: "Leads & WhatsApp", icon: "message-circle", color: "#16A34A", sortOrder: 8 },
  { name: "Marketing & Ads", icon: "megaphone", color: "#DC2626", sortOrder: 9 },
  { name: "Community", icon: "users-round", color: "#2563EB", sortOrder: 10 },
  { name: "Pricing & Offers", icon: "wallet", color: "#CA8A04", sortOrder: 11 },
  { name: "Operations", icon: "workflow", color: "#475569", sortOrder: 12 },
  { name: "Analytics & KPIs", icon: "chart", color: "#334155", sortOrder: 13 },
];

const OTHER_CATEGORIES: Record<string, { name: string; icon: string; color: string }[]> = {
  SHUTTLEZ: [
    { name: "Website", icon: "globe", color: "#3A96D4" },
    { name: "Mobile App", icon: "smartphone", color: "#0F9D6E" },
    { name: "Captain App", icon: "users", color: "#7C5CFC" },
    { name: "Backend", icon: "workflow", color: "#334155" },
    { name: "Admin", icon: "settings", color: "#64748B" },
    { name: "Infrastructure", icon: "cpu", color: "#0F766E" },
    { name: "Marketing", icon: "megaphone", color: "#DB2777" },
    { name: "Operations", icon: "workflow", color: "#475569" },
  ],
  NANO: [
    { name: "Implementation", icon: "workflow", color: "#7C5CFC" },
    { name: "Clients", icon: "users", color: "#3A96D4" },
    { name: "Product", icon: "lightbulb", color: "#D97706" },
    { name: "Engineering", icon: "cpu", color: "#334155" },
    { name: "Documentation", icon: "video", color: "#0F766E" },
    { name: "Operations", icon: "settings", color: "#64748B" },
  ],
  PERSONAL: [
    { name: "Finance", icon: "wallet", color: "#CA8A04" },
    { name: "Learning", icon: "graduation-cap", color: "#7C5CFC" },
    { name: "Family", icon: "users", color: "#DB2777" },
    { name: "Health", icon: "users-round", color: "#0F9D6E" },
    { name: "Personal Admin", icon: "settings", color: "#64748B" },
    { name: "Ideas", icon: "lightbulb", color: "#D97706" },
  ],
};

async function ensureProject(
  userId: string,
  data: { name: string; description: string; icon: string; color: string },
) {
  const existing = await prisma.project.findFirst({ where: { userId, name: data.name } });
  if (existing) return existing;
  return prisma.project.create({ data: { userId, ...data, status: "ACTIVE" } });
}

async function ensureCategory(
  userId: string,
  projectId: string,
  data: { name: string; icon: string; color: string; sortOrder?: number },
) {
  const existing = await prisma.category.findFirst({ where: { projectId, name: data.name } });
  if (existing) return existing;
  return prisma.category.create({
    data: {
      userId,
      projectId,
      name: data.name,
      icon: data.icon,
      color: data.color,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

async function ensureTask(
  userId: string,
  title: string,
  projectId: string,
  extra: {
    categoryId?: string | null;
    status?: "INBOX" | "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    dueDate?: string | null;
    dueTime?: string | null;
    estimatedMinutes?: number;
    description?: string;
    completedAt?: Date;
  } = {},
) {
  const existing = await prisma.task.findFirst({ where: { userId, projectId, title } });
  if (existing) {
    if (!existing.categoryId && extra.categoryId) {
      return prisma.task.update({ where: { id: existing.id }, data: { categoryId: extra.categoryId } });
    }
    return existing;
  }
  return prisma.task.create({
    data: {
      userId,
      title,
      projectId,
      categoryId: extra.categoryId ?? null,
      status: extra.status ?? "TODO",
      priority: extra.priority ?? "MEDIUM",
      dueDate: extra.dueDate ?? null,
      dueTime: extra.dueTime ?? null,
      estimatedMinutes: extra.estimatedMinutes ?? 30,
      description: extra.description ?? null,
      completedAt: extra.completedAt ?? null,
    },
  });
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@smartdevco.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "SmartDevCo@2026";
  const name = process.env.ADMIN_NAME ?? "Ahmed";

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
  }

  const today = new Date();
  const d = (offset: number) => iso(offset < 0 ? subDays(today, Math.abs(offset)) : addDays(today, offset));

  const rootaca = await ensureProject(user.id, {
    name: "ROOTACA",
    description: "Personal Productivity",
    icon: "graduation-cap",
    color: "#3A96D4",
  });
  const shuttlez = await ensureProject(user.id, {
    name: "SHUTTLEZ",
    description: "Transport platform — mobile releases, backend, and operations.",
    icon: "bus",
    color: "#0F9D6E",
  });
  const nano = await ensureProject(user.id, {
    name: "NANO",
    description: "Implementation follow-up, planning, and status reporting.",
    icon: "cpu",
    color: "#7C5CFC",
  });
  const personal = await ensureProject(user.id, {
    name: "PERSONAL",
    description: "Personal admin, learning, and weekly planning.",
    icon: "user",
    color: "#D97706",
  });
  const ideas = await ensureProject(user.id, {
    name: "BUSINESS / IDEAS",
    description: "New ventures, research notes, and opportunity capture.",
    icon: "lightbulb",
    color: "#DB2777",
  });

  const rootacaCats = new Map<string, { id: string }>();
  for (const spec of ROOTACA_CATEGORIES) {
    const category = await ensureCategory(user.id, rootaca.id, spec);
    rootacaCats.set(spec.name, category);
  }

  const otherProjects = [
    { project: shuttlez, key: "SHUTTLEZ" },
    { project: nano, key: "NANO" },
    { project: personal, key: "PERSONAL" },
  ] as const;
  const extraCats = new Map<string, Map<string, { id: string }>>();
  for (const { project, key } of otherProjects) {
    const map = new Map<string, { id: string }>();
    for (const [index, spec] of (OTHER_CATEGORIES[key] ?? []).entries()) {
      const category = await ensureCategory(user.id, project.id, { ...spec, sortOrder: index + 1 });
      map.set(spec.name, category);
    }
    extraCats.set(key, map);
  }

  const cat = (name: string) => rootacaCats.get(name)?.id ?? null;
  const shuttleCat = (name: string) => extraCats.get("SHUTTLEZ")?.get(name)?.id ?? null;
  const nanoCat = (name: string) => extraCats.get("NANO")?.get(name)?.id ?? null;
  const personalCat = (name: string) => extraCats.get("PERSONAL")?.get(name)?.id ?? null;

  const schoolProfile = await ensureTask(user.id, "Finalize School Partnership Profile", rootaca.id, {
    categoryId: cat("School Partnerships"),
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueDate: d(0),
    dueTime: "10:00",
    estimatedMinutes: 45,
    description: "Positioning, STEM offering, pricing outline, and contact path.",
  });
  await ensureTask(user.id, "Prepare School Outreach List", rootaca.id, {
    categoryId: cat("School Partnerships"),
    priority: "HIGH",
    dueDate: d(0),
    dueTime: "11:30",
    estimatedMinutes: 30,
  });
  await ensureTask(user.id, "Review Homepage", rootaca.id, {
    categoryId: cat("Website"),
    priority: "HIGH",
    dueDate: d(0),
    estimatedMinutes: 30,
  });
  await ensureTask(user.id, "Fix Mobile Navigation", rootaca.id, {
    categoryId: cat("Website"),
    priority: "MEDIUM",
    dueDate: d(0),
    estimatedMinutes: 25,
  });
  await ensureTask(user.id, "Test WhatsApp CTA", rootaca.id, {
    categoryId: cat("Website"),
    status: "DONE",
    priority: "HIGH",
    dueDate: d(0),
    estimatedMinutes: 20,
    completedAt: new Date(),
  });
  await ensureTask(user.id, "Prepare Carousel #4", rootaca.id, {
    categoryId: cat("Social Media"),
    priority: "MEDIUM",
    dueDate: d(0),
    estimatedMinutes: 25,
  });
  await ensureTask(user.id, "Publish Instagram Reel", rootaca.id, {
    categoryId: cat("Social Media"),
    priority: "MEDIUM",
    dueDate: d(1),
    estimatedMinutes: 20,
  });
  await ensureTask(user.id, "Follow up with leads", rootaca.id, {
    categoryId: cat("Leads & WhatsApp"),
    priority: "HIGH",
    dueDate: d(0),
    estimatedMinutes: 20,
  });
  await ensureTask(user.id, "Review deployment", shuttlez.id, {
    categoryId: shuttleCat("Backend"),
    priority: "MEDIUM",
    dueDate: d(0),
    dueTime: "14:00",
    estimatedMinutes: 30,
  });
  await ensureTask(user.id, "Check Android releases", shuttlez.id, {
    categoryId: shuttleCat("Mobile App"),
    priority: "HIGH",
    dueDate: d(-1),
    estimatedMinutes: 40,
  });
  await ensureTask(user.id, "Review project plan", nano.id, {
    categoryId: nanoCat("Implementation"),
    priority: "HIGH",
    dueDate: d(0),
    estimatedMinutes: 40,
  });
  await ensureTask(user.id, "Weekly planning", personal.id, {
    categoryId: personalCat("Personal Admin"),
    priority: "HIGH",
    dueDate: d(0),
    dueTime: "17:30",
    estimatedMinutes: 30,
  });
  await ensureTask(user.id, "Research AI SaaS idea", ideas.id, {
    status: "INBOX",
    priority: "LOW",
    dueDate: null,
    estimatedMinutes: 40,
  });

  if (!user.currentFocusTaskId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { currentFocusTaskId: schoolProfile.id },
    });
  }

  const existingSchoolNote = await prisma.note.findFirst({
    where: { userId: user.id, title: "School Profile" },
  });
  if (!existingSchoolNote) {
    await prisma.note.create({
      data: {
        userId: user.id,
        projectId: rootaca.id,
        categoryId: cat("School Partnerships"),
        taskId: schoolProfile.id,
        title: "School Profile",
        content: "Need school profile\nNeed pricing\nNeed STEM offering\nNeed contact database\nNeed presentation",
        tags: ["rootaca", "partnership"],
      },
    });
  }

  const reviewCount = await prisma.dailyReview.count({ where: { userId: user.id } });
  if (reviewCount === 0) {
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
  }

  console.log("Seed complete (idempotent)");
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
