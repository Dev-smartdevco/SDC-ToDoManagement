import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Flag,
  Flame,
  FolderKanban,
  Medal,
  Settings,
  Sparkles,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MessageKey } from "@/i18n/dictionaries";

export type NavItem = {
  href: string;
  key: Extract<
    MessageKey,
    | "today"
    | "projects"
    | "tasks"
    | "notes"
    | "review"
    | "team"
    | "calendar"
    | "notifications"
    | "rewards"
    | "recognition"
    | "analytics"
    | "settings"
  >;
  icon: LucideIcon;
  /** Team OS screens — main menu only for SUPER_ADMIN / ADMIN */
  adminOnly?: boolean;
};

export const navItems: NavItem[] = [
  { href: "/", key: "today", icon: CalendarDays },
  { href: "/tasks", key: "tasks", icon: CheckSquare },
  { href: "/projects", key: "projects", icon: FolderKanban },
  { href: "/notes", key: "notes", icon: BookOpen },
  { href: "/review", key: "review", icon: Sparkles },
  { href: "/team", key: "team", icon: Users, adminOnly: true },
  { href: "/calendar", key: "calendar", icon: CalendarDays, adminOnly: true },
  { href: "/analytics", key: "analytics", icon: BarChart3, adminOnly: true },
  { href: "/recognition", key: "recognition", icon: Award, adminOnly: true },
  { href: "/settings", key: "settings", icon: Settings },
];

export const mobileNavItems: NavItem[] = [
  { href: "/", key: "today", icon: CalendarDays },
  { href: "/projects", key: "projects", icon: FolderKanban },
  { href: "/tasks", key: "tasks", icon: CheckSquare },
  { href: "/notes", key: "notes", icon: BookOpen },
  { href: "/settings", key: "settings", icon: Settings },
];

export function isNavActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function isAdminRole(role?: string | null) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function visibleNavItems(role?: string | null) {
  const admin = isAdminRole(role);
  return navItems.filter((item) => !item.adminOnly || admin);
}

const achievementIconMap: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  "check-circle": CheckCircle2,
  medal: Medal,
  trophy: Trophy,
  flag: Flag,
  users: Users,
  flame: Flame,
  star: Star,
  award: Award,
};

export function achievementIcon(name?: string | null): LucideIcon {
  if (!name) return Trophy;
  return achievementIconMap[name] ?? Trophy;
}

export function notificationIcon(type?: string | null): LucideIcon {
  switch (type) {
    case "TASK_ASSIGNED":
      return CheckSquare;
    case "COMMENT_ADDED":
      return Bell;
    case "PROJECT_ADDED":
      return Users;
    case "DEADLINE_SOON":
      return CalendarDays;
    case "TASK_COMPLETED":
      return CheckCircle2;
    case "RECOGNITION":
      return Award;
    default:
      return Bell;
  }
}
