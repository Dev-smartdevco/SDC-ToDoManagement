import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { signToken } from "../lib/jwt.js";
import { levelFromXp } from "../lib/xp.js";
import { invalidateActor } from "../lib/access.js";

const meSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  xp: true,
  currentFocusTaskId: true,
} as const;

function serializeMe(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  xp: number;
  currentFocusTaskId: string | null;
}) {
  return { ...user, ...levelFromXp(user.xp) };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) throw errors.invalidCredentials();
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw errors.invalidCredentials();
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = signToken({ sub: user.id, email: user.email });
  return {
    token,
    user: serializeMe({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      xp: user.xp,
      currentFocusTaskId: user.currentFocusTaskId,
    }),
  };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: meSelect,
  });
  if (!user) throw errors.unauthorized();
  return serializeMe(user);
}

export async function changePassword(userId: string, currentPassword: string | undefined, nextPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw errors.unauthorized();
  if (!user.mustChangePassword) {
    if (!currentPassword) throw errors.badRequest("Current password is required.");
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw errors.invalidCredentials();
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(nextPassword, 12),
      mustChangePassword: false,
    },
  });
  invalidateActor(userId);
  return { ok: true };
}
