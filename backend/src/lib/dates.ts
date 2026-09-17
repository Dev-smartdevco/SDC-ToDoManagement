import { format, subDays, addDays } from "date-fns";

export function todayIso(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

export function addDaysIso(dateIso: string, days: number) {
  const [y, m, d] = dateIso.split("-").map(Number);
  return format(addDays(new Date(y, m - 1, d), days), "yyyy-MM-dd");
}

export function daysBetween(fromIso: string, toIso: string) {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function weekDates(anchorIso: string) {
  const [y, m, d] = anchorIso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = addDays(date, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), "yyyy-MM-dd"));
}

export function subtractDaysIso(dateIso: string, days: number) {
  const [y, m, d] = dateIso.split("-").map(Number);
  return format(subDays(new Date(y, m - 1, d), days), "yyyy-MM-dd");
}

export function safePercent(completed: number, planned: number) {
  if (!planned || planned <= 0) return 0;
  return Math.min(100, Math.round((completed / planned) * 100));
}

export function parseTags(value?: string | string[]) {
  if (!value) return [] as string[];
  if (Array.isArray(value)) return value.map((t) => t.trim()).filter(Boolean);
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
