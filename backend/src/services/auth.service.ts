import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { signToken } from "../lib/jwt.js";

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw errors.invalidCredentials();
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw errors.invalidCredentials();
  const token = signToken({ sub: user.id, email: user.email });
  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, currentFocusTaskId: true },
  });
  if (!user) throw errors.unauthorized();
  return user;
}
