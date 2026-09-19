"use client";

import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { endpoints } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useScopedKey } from "@/lib/auth";
import { achievementIcon } from "@/lib/nav";

export default function RewardsPage() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: useScopedKey(["rewards"]),
    queryFn: endpoints.rewards,
    staleTime: 2 * 60_000,
  });
  const data = query.data;

  if (query.isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (!data) return <p className="text-sm text-danger">{t("error")}</p>;

  const earned = data.catalog.filter((item) => item.earned);
  const locked = data.catalog.filter((item) => !item.earned);

  return (
    <div className="space-y-8">
      <PageHeader title={t("rewards")} description={t("rewardsSubtitle")} />

      <section className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
        <div className="bg-gradient-to-br from-sidebar via-sidebar to-[#1a4a66] px-5 py-6 text-white sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">{t("yourProgress")}</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{data.profile.name}</h2>
              <p className="mt-1 text-sm text-white/70">
                {data.profile.xp} {t("xp")} · {earned.length}/{data.catalog.length} {t("badges")}
              </p>
            </div>
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
              <Trophy size={22} className="text-accent" />
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">{t("level")}</span>
              <span className="text-lg font-bold leading-none">{data.profile.level}</span>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-[11px] text-white/60">
              <span>
                {t("level")} {data.profile.level}
              </span>
              <span>
                {t("level")} {data.profile.level + 1}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, data.profile.intoLevel))}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {earned.length ? (
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("earnedBadges")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {earned.map((item) => {
              const Icon = achievementIcon(item.icon);
              return (
                <article
                  key={item.id}
                  className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 to-white p-4 shadow-sm"
                >
                  <div className="absolute -end-6 -top-6 h-20 w-20 rounded-full bg-accent/10" />
                  <div className="relative flex gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-md shadow-accent/25">
                      <Icon size={22} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink">{item.name}</h3>
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                          {t("unlocked")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">{item.description}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("allAchievements")}</h2>
        {locked.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {locked.map((item) => {
              const Icon = achievementIcon(item.icon);
              return (
                <article key={item.id} className="rounded-2xl border border-dashed border-line bg-bg/60 p-4">
                  <div className="flex gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-muted ring-1 ring-line">
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium">{item.name}</h3>
                      <p className="mt-1 text-sm text-muted">{item.description}</p>
                      <div className="mt-3">
                        <ProgressBar value={Math.min(70, item.threshold > 1 ? 12 : 5)} />
                        <div className="mt-1.5 text-[11px] text-muted">
                          {t("goal")}: {item.threshold}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">{t("allCaughtUp")}</p>
        )}
      </section>
    </div>
  );
}
