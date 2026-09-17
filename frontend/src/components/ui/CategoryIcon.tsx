"use client";

import {
  BarChart3,
  Bus,
  Cpu,
  Folder,
  Globe,
  GraduationCap,
  Lightbulb,
  Megaphone,
  MessageCircle,
  School,
  Settings,
  Smartphone,
  User,
  Users,
  UsersRound,
  Video,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  globe: Globe,
  settings: Settings,
  school: School,
  "graduation-cap": GraduationCap,
  users: Users,
  smartphone: Smartphone,
  video: Video,
  "message-circle": MessageCircle,
  megaphone: Megaphone,
  "users-round": UsersRound,
  wallet: Wallet,
  workflow: Workflow,
  chart: BarChart3,
  folder: Folder,
  bus: Bus,
  cpu: Cpu,
  user: User,
  lightbulb: Lightbulb,
};

export const CATEGORY_ICON_OPTIONS = [
  "globe",
  "settings",
  "school",
  "graduation-cap",
  "users",
  "smartphone",
  "video",
  "message-circle",
  "megaphone",
  "users-round",
  "wallet",
  "workflow",
  "chart",
  "folder",
];

export function CategoryIcon({ name, size = 16, color }: { name?: string | null; size?: number; color?: string }) {
  const Icon = ICONS[name ?? ""] ?? Folder;
  return <Icon size={size} color={color} />;
}
