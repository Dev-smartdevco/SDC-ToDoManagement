import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import type { Locale } from "@/i18n/dictionaries";

export function todayIso(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

export function formatLongDate(iso: string, locale: Locale) {
  const [y, m, d] = iso.split("-").map(Number);
  return format(new Date(y, m - 1, d), "EEEE, d MMMM yyyy", { locale: locale === "ar" ? ar : enUS });
}

export function formatMinutes(mins: number) {
  const safe = Number.isFinite(mins) ? Math.max(0, mins) : 0;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function greetingKey(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "greetingMorning" as const;
  if (hour < 17) return "greetingAfternoon" as const;
  return "greetingEvening" as const;
}

export function progressBar(percent: number) {
  const safe = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const filled = Math.round(safe / 10);
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export const PROJECT_COLORS = ["#3A96D4", "#0F9D6E", "#7C5CFC", "#D97706", "#DB2777", "#0F766E", "#334155"];
