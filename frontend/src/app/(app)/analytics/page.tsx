"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { endpoints } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useScopedKey } from "@/lib/auth";

type Analytics = {
  tasksCreated: number;
  tasksCompleted: number;
  overdueTasks: number;
  blockedTasks: number;
  recognitionCount: number;
  averageCompletionDays: number;
  estimatedMinutes: number;
  actualMinutes: number;
  completionRate: number;
  projectProgress: { id: string; name: string; progress: number; total: number; completed: number }[];
};

export default function AnalyticsPage() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: useScopedKey(["analytics"]),
    queryFn: () => endpoints.analytics() as Promise<Analytics>,
  });
  const data = query.data;
  if (query.isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (!data) return <p className="text-sm text-danger">{t("error")}</p>;

  const cards = [
    { label: t("completed"), value: data.tasksCompleted },
    { label: t("overdue"), value: data.overdueTasks },
    { label: t("blocked"), value: data.blockedTasks },
    { label: t("completion"), value: `${data.completionRate}%` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("analytics")} />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((item) => (
          <div key={item.label} className="rounded-2xl border border-line bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>
      <section className="space-y-3">
        {data.projectProgress.map((project) => (
          <div key={project.id} className="rounded-2xl border border-line bg-white p-4">
            <div className="mb-2 flex justify-between text-sm">
              <span>{project.name}</span>
              <span className="text-muted">
                {project.completed}/{project.total}
              </span>
            </div>
            <ProgressBar value={project.progress} />
          </div>
        ))}
      </section>
      <section className="rounded-2xl border border-line bg-white p-4 text-sm text-muted">
        {t("estimatedDuration")}: {data.estimatedMinutes} · {t("actualTime")}: {data.actualMinutes} {t("minutes")}
      </section>
    </div>
  );
}
