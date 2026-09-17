"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { endpoints } from "@/lib/api";
import { formatMinutes, todayIso } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useScopedKey } from "@/lib/auth";

export default function ReviewPage() {
  const { t, locale } = useI18n();
  const date = todayIso();
  const query = useQuery({ queryKey: useScopedKey(["review", date]), queryFn: () => endpoints.review(date) });
  const data = query.data;

  if (query.isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (query.isError || !data) return <p className="text-sm text-danger">{t("error")}</p>;

  const completion = Number.isFinite(data.today.completion) ? data.today.completion : 0;

  return (
    <div className="space-y-8">
      <PageHeader title={t("review")} />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: t("completed"), value: data.today.completed },
          { label: t("planned"), value: data.today.planned },
          { label: t("completion"), value: `${completion}%` },
          { label: t("focusTime"), value: formatMinutes(data.today.focusMinutes) },
          { label: t("overdue"), value: data.today.overdue },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-line bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>
      <ProgressBar value={completion} label={t("today")} />

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{t("weekReview")}</h2>
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          {data.week.map((day) => {
            const [y, m, d] = day.date.split("-").map(Number);
            const label = format(new Date(y, m - 1, d), "EEE", { locale: locale === "ar" ? ar : enUS });
            const pct = day.planned ? Math.round((day.completed / day.planned) * 100) : 0;
            return (
              <div key={day.date} className="grid grid-cols-[72px_1fr_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <div className="text-sm font-medium">{label}</div>
                <ProgressBar value={Number.isFinite(pct) ? pct : 0} />
                <div className="text-xs text-muted tabular-nums">
                  {day.completed}/{day.planned} · {formatMinutes(day.focusMinutes)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{t("topProjects")}</h2>
        <div className="rounded-2xl border border-line bg-white">
          {data.topProjects.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">{t("noResults")}</p>
          ) : (
            data.topProjects.map((project) => (
              <div key={project.id} className="flex items-center justify-between border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: project.color }} />
                  <span className="text-sm font-medium">{project.name}</span>
                </div>
                <span className="text-sm text-muted">{project.completed}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
