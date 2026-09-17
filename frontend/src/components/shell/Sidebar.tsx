"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { isNavActive, navItems } from "@/lib/nav";
import { BrandLogo } from "./BrandLogo";
import clsx from "clsx";

export function Sidebar({ onQuickAdd }: { onQuickAdd: () => void }) {
  const pathname = usePathname();
  const { t, locale, setLocale } = useI18n();
  const { logout, user } = useAuth();

  return (
    <aside className="fixed inset-y-0 start-0 z-40 hidden w-[280px] flex-col bg-sidebar text-white lg:w-[300px] md:flex">
      <div className="border-b border-white/10 px-5 py-6">
        <BrandLogo size="md" showSubtitle />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
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
        <div className="rounded-xl bg-white/5 px-3 py-3">
          <div className="truncate text-sm font-medium text-white">{user?.name}</div>
          <div className="truncate text-[11px] text-white/45">{user?.email}</div>
          <button
            onClick={logout}
            className="mt-3 flex items-center gap-2 text-xs text-white/55 hover:text-white"
          >
            <LogOut size={14} />
            {t("logout")}
          </button>
        </div>
      </div>
    </aside>
  );
}
