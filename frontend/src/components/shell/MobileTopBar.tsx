"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Trophy } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { useAuth, useScopedKey } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { endpoints } from "@/lib/api";
import clsx from "clsx";

export function MobileTopBar() {
  const { t, locale, setLocale } = useI18n();
  const { logout, user } = useAuth();
  const unread = useQuery({
    queryKey: useScopedKey(["unread"]),
    queryFn: endpoints.unreadCount,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    enabled: Boolean(user),
  });

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/10 bg-sidebar px-3 py-2.5 md:hidden">
      <BrandLogo size="sm" className="min-w-0 flex-1 [&_img]:max-w-[96px]" />
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/rewards"
          className="inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-white/85 hover:bg-white/10"
          aria-label={t("rewards")}
        >
          <Trophy size={16} />
        </Link>
        <Link
          href="/notifications"
          className="relative inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-white/85 hover:bg-white/10"
          aria-label={t("notifications")}
        >
          <Bell size={16} />
          {unread.data?.count ? (
            <span className="absolute -end-0.5 -top-0.5 min-w-4 rounded-full bg-accent px-1 text-[9px] font-semibold text-white">
              {unread.data.count > 99 ? "99+" : unread.data.count}
            </span>
          ) : null}
        </Link>
        <div className="flex rounded-lg bg-white/10 p-0.5" role="group" aria-label={t("language")}>
          <button
            type="button"
            onClick={() => setLocale("en")}
            className={clsx(
              "rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide transition-colors duration-200",
              locale === "en" ? "bg-white text-sidebar" : "text-white/70",
            )}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLocale("ar")}
            className={clsx(
              "rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide transition-colors duration-200",
              locale === "ar" ? "bg-white text-sidebar" : "text-white/70",
            )}
          >
            AR
          </button>
        </div>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-[11px] font-medium text-white/85 transition-colors duration-200 hover:bg-white/10 hover:text-white"
        >
          <LogOut size={14} />
          <span>{t("logout")}</span>
        </button>
      </div>
    </header>
  );
}
