"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Plus, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth, useScopedKey } from "@/lib/auth";
import { isNavActive, visibleNavItems } from "@/lib/nav";
import { BrandLogo } from "./BrandLogo";
import { endpoints } from "@/lib/api";
import clsx from "clsx";

export function Sidebar({ onQuickAdd }: { onQuickAdd: () => void }) {
  const pathname = usePathname();
  const { t, locale, setLocale } = useI18n();
  const { logout, user } = useAuth();
  const items = visibleNavItems(user?.role);
  const unread = useQuery({
    queryKey: useScopedKey(["unread"]),
    queryFn: endpoints.unreadCount,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    enabled: Boolean(user),
  });

  return (
    <aside className="fixed inset-y-0 start-0 z-40 hidden w-[280px] flex-col bg-sidebar text-white lg:w-[300px] md:flex">
      <div className="border-b border-white/10 px-5 py-6">
        <BrandLogo size="md" showSubtitle />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
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

      <div className="mt-auto space-y-3 border-t border-white/10 px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/notifications"
            className={clsx(
              "relative flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
              isNavActive(pathname, "/notifications") ? "bg-white/10 text-white" : "bg-white/5 text-white/75 hover:bg-white/10 hover:text-white",
            )}
          >
            <Bell size={16} />
            {t("notifications")}
            {unread.data?.count ? (
              <span className="absolute -end-1 -top-1 min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white">
                {unread.data.count > 99 ? "99+" : unread.data.count}
              </span>
            ) : null}
          </Link>
          <Link
            href="/rewards"
            className={clsx(
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
              isNavActive(pathname, "/rewards") ? "bg-white/10 text-white" : "bg-white/5 text-white/75 hover:bg-white/10 hover:text-white",
            )}
          >
            <Trophy size={16} />
            {t("rewards")}
          </Link>
        </div>

        {user ? (
          <Link href="/rewards" className="block rounded-xl bg-gradient-to-br from-white/10 to-white/5 px-3 py-3 transition-colors hover:from-white/15 hover:to-white/10">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                {t("level")} {user.level}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, user.intoLevel ?? user.progress ?? 0))}%` }}
              />
            </div>
            <div className="mt-1.5 text-[11px] text-white/45">
              {user.xp} {t("xp")}
            </div>
          </Link>
        ) : null}

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
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/55 hover:text-white"
        >
          <LogOut size={14} />
          {t("logout")}
        </button>
      </div>
    </aside>
  );
}
