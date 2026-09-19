"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { endpoints } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useScopedKey } from "@/lib/auth";

type TeamData = {
  members: number;
  activeProjects: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  blockedTasks: number;
  dueSoon: { id: string; title: string; dueDate: string | null; status: string }[];
  recentActivity: { id: string; message: string; createdAt: string }[];
  recentAchievements: { user: { name: string }; achievement: { name: string } }[];
  weekly: {
    completedTasks: number;
    blockedTasks: number;
    adminMessage: string;
    recognition: { user: { name: string }; completed: number }[];
  };
};

export default function TeamPage() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: useScopedKey(["team"]),
    queryFn: () => endpoints.team() as Promise<TeamData>,
  });
  const data = query.data;

  if (query.isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (!data) return <p className="text-sm text-danger">{t("error")}</p>;

  const stats = [
    { label: t("members"), value: data.members },
    { label: t("projects"), value: data.activeProjects },
    { label: t("completedTasks"), value: data.completedTasks },
    { label: t("progress"), value: data.inProgressTasks },
    { label: t("todoTasks"), value: data.todoTasks },
    { label: t("blocked"), value: data.blockedTasks },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={t("team")} />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((item) => (
          <div key={item.label} className="rounded-2xl border border-line bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("weeklySummary")}</h2>
        <div className="mt-3 text-sm text-muted">
          {t("completed")}: {data.weekly.completedTasks} · {t("blocked")}: {data.weekly.blockedTasks}
        </div>
        <div className="mt-4 space-y-2">
          {data.weekly.recognition.map((row) => (
            <div key={row.user.name} className="flex justify-between text-sm">
              <span>{row.user.name}</span>
              <span className="text-muted">{row.completed}</span>
            </div>
          ))}
        </div>
        {data.weekly.adminMessage ? (
          <p className="mt-4 rounded-xl bg-bg px-3 py-2 text-sm">{data.weekly.adminMessage}</p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("dueSoon")}</h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-white px-4">
          {data.dueSoon.length ? (
            data.dueSoon.map((item) => (
              <div key={item.id} className="flex justify-between py-3 text-sm">
                <span>{item.title}</span>
                <span className="text-muted">{item.dueDate}</span>
              </div>
            ))
          ) : (
            <div className="py-6 text-sm text-muted">{t("noResults")}</div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("activity")}</h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-white px-4">
          {(data.recentActivity ?? []).length ? (
            data.recentActivity.map((item) => (
              <div key={item.id} className="py-3 text-sm">
                {item.message}
              </div>
            ))
          ) : (
            <div className="py-6 text-sm text-muted">{t("noResults")}</div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("rewards")}</h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-white px-4">
          {data.recentAchievements.length ? (
            data.recentAchievements.map((item, index) => (
              <div key={`${item.user.name}-${item.achievement.name}-${index}`} className="py-3 text-sm">
                {item.user.name} · {item.achievement.name}
              </div>
            ))
          ) : (
            <div className="py-6 text-sm text-muted">{t("noResults")}</div>
          )}
        </div>
      </section>
    </div>
  );
}
