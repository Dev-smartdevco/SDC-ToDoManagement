"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { isAdminRole } from "@/lib/nav";

const roles = [
  { name: "SUPER_ADMIN", access: "Full access" },
  { name: "ADMIN", access: "Users, projects, tasks, rewards, team" },
  { name: "MEMBER", access: "Shared projects/tasks, comments, progress" },
  { name: "VIEWER", access: "Read only" },
];

export default function RolesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  if (!isAdminRole(user?.role)) return <p className="text-sm text-danger">{t("error")}</p>;
  return (
    <div className="space-y-6">
      <PageHeader title={t("roles")} />
      <div className="space-y-3">
        {roles.map((role) => (
          <div key={role.name} className="rounded-2xl border border-line bg-white p-4">
            <div className="text-sm font-medium">{role.name}</div>
            <p className="mt-1 text-sm text-muted">{role.access}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
