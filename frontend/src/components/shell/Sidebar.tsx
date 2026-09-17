"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, CheckSquare, FolderKanban, Plus, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import clsx from "clsx";

const items = [
  { href: "/", key: "today" as const, icon: CalendarDays },
  { href: "/tasks", key: "tasks" as const, icon: CheckSquare },
  { href: "/projects", key: "projects" as const, icon: FolderKanban },
  { href: "/notes", key: "notes" as const, icon: BookOpen },
  { href: "/review", key: "review" as const, icon: Sparkles },
];

export function Sidebar({ onQuickAdd }: { onQuickAdd: () => void }) {
  const pathname = usePathname();
  const { t, locale, setLocale } = useI18n();
  const { logout, user } = useAuth();

  return (
    <aside className="hidden h-screen w-[260px] shrink-0 flex-col bg-sidebar text-white md:flex lg:w-[280px]">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <Image src="/brand/logo.svg" alt="SmartDevCo" width={42} height={42} />
        <div>
          <div className="text-lg font-semibold tracking-wide">{t("appName")}</div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">{t("subtitle")}</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon size={18} />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 px-4 pb-5">
        <button
          onClick={onQuickAdd}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-white"
        >
          <Plus size={16} />
          {t("quickAdd")}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setLocale("en")}
            className={clsx("flex-1 rounded-lg px-2 py-1.5 text-xs", locale === "en" ? "bg-white/10" : "text-white/50")}
          >
            EN
          </button>
          <button
            onClick={() => setLocale("ar")}
            className={clsx("flex-1 rounded-lg px-2 py-1.5 text-xs", locale === "ar" ? "bg-white/10" : "text-white/50")}
          >
            AR
          </button>
        </div>
        <button onClick={logout} className="w-full text-start text-xs text-white/45 hover:text-white">
          {user?.name} · {t("logout")}
        </button>
      </div>
    </aside>
  );
}
