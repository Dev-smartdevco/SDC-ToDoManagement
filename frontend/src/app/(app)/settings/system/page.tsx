"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { endpoints } from "@/lib/api";
import { useAuth, useScopedKey } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import { isAdminRole } from "@/lib/nav";

export default function SystemSettingsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const settingsKey = useScopedKey(["settings"]);
  const rulesKey = useScopedKey(["reward-rules"]);
  const settings = useQuery({ queryKey: settingsKey, queryFn: endpoints.settings, enabled: isAdminRole(user?.role) });
  const rules = useQuery({ queryKey: rulesKey, queryFn: endpoints.rewardRules, enabled: isAdminRole(user?.role) });
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMessage(settings.data?.weeklyAdminMessage ?? "");
  }, [settings.data?.weeklyAdminMessage]);

  if (!isAdminRole(user?.role)) return <p className="text-sm text-danger">{t("error")}</p>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("systemSettings")} />
      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("adminMessage")}</h2>
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await endpoints.saveSetting("weeklyAdminMessage", message);
            queryClient.invalidateQueries({ queryKey: settingsKey });
            toast.push(t("saved"));
          }}
        >
          <textarea
            className="min-h-24 w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button className="rounded-xl bg-sidebar px-4 py-2 text-sm text-white">{t("save")}</button>
        </form>
      </section>
      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("rewards")}</h2>
        <div className="divide-y divide-line">
          {(rules.data ?? []).map((rule) => (
            <div key={rule.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span>{rule.type}</span>
              <input
                type="number"
                className="w-24 rounded-xl border border-line px-3 py-1.5 text-sm"
                defaultValue={rule.points}
                onBlur={async (e) => {
                  await endpoints.updateRewardRule(rule.id, { points: Number(e.target.value) });
                  queryClient.invalidateQueries({ queryKey: rulesKey });
                  toast.push(t("saved"));
                }}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
