import { BookOpen, CalendarDays, CheckSquare, FolderKanban, Sparkles, type LucideIcon } from "lucide-react";
import type { MessageKey } from "@/i18n/dictionaries";

export type NavItem = {
  href: string;
  key: Extract<MessageKey, "today" | "projects" | "tasks" | "notes" | "review">;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { href: "/", key: "today", icon: CalendarDays },
  { href: "/projects", key: "projects", icon: FolderKanban },
  { href: "/tasks", key: "tasks", icon: CheckSquare },
  { href: "/notes", key: "notes", icon: BookOpen },
  { href: "/review", key: "review", icon: Sparkles },
];

export function isNavActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
