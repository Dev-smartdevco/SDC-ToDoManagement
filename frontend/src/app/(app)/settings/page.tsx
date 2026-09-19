"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { isAdminRole } from "@/lib/nav";

export default function SettingsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const admin = isAdminRole(user?.role);
  const links = [
    { href: "/settings/users", key: "users", admin: true },
    { href: "/settings/roles", key: "roles", admin: true },
    { href: "/settings/system", key: "systemSettings", admin: true },
    { href: "/team", key: "team", admin: true },
    { href: "/calendar", key: "calendar", admin: true },
    { href: "/analytics", key: "analytics", admin: true },
    { href: "/recognition", key: "recognition", admin: true },
    { href: "/projects", key: "projects", admin: false },
    { href: "/change-password", key: "changePassword", admin: false },
    { href: "/notifications", key: "notifications", admin: false },
    { href: "/rewards", key: "rewards", admin: false },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings")} />
      <div className="grid gap-3 sm:grid-cols-2">
        {links
          .filter((item) => !item.admin || admin)
          .map((item) => (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-line bg-white p-4 text-sm font-medium">
              {t(item.key)}
            </Link>
          ))}
      </div>
    </div>
  );
}
