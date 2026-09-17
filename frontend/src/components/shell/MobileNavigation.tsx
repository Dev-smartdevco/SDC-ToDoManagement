"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, CheckSquare, FolderKanban, Plus, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import clsx from "clsx";

const items = [
  { href: "/", key: "today" as const, icon: CalendarDays },
  { href: "/tasks", key: "tasks" as const, icon: CheckSquare },
  { href: "/projects", key: "projects" as const, icon: FolderKanban },
  { href: "/notes", key: "notes" as const, icon: BookOpen },
  { href: "/review", key: "review" as const, icon: Sparkles },
];

export function MobileNavigation({ onQuickAdd }: { onQuickAdd: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-6 px-1 py-2">
        {items.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={clsx("flex flex-col items-center gap-1 text-[10px]", active ? "text-ink" : "text-muted")}>
              <Icon size={18} />
              {t(item.key)}
            </Link>
          );
        })}
        <button onClick={onQuickAdd} className="flex flex-col items-center justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar text-white">
            <Plus size={18} />
          </span>
        </button>
        {items.slice(2).map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={clsx("flex flex-col items-center gap-1 text-[10px]", active ? "text-ink" : "text-muted")}>
              <Icon size={18} />
              {t(item.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
