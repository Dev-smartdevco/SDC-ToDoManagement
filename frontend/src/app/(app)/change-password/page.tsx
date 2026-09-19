"use client";

import { FormEvent, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await endpoints.changePassword({
        currentPassword: user?.mustChangePassword ? undefined : currentPassword,
        newPassword,
      });
      toast.push(t("saved"));
      router.replace("/");
      window.location.reload();
    } catch {
      toast.push(t("error"), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title={t("changePassword")} description={user?.mustChangePassword ? t("forcePassword") : undefined} />
      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-line bg-white p-4">
        {!user?.mustChangePassword ? (
          <input
            type="password"
            className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            placeholder={t("currentPassword")}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        ) : null}
        <input
          type="password"
          required
          minLength={8}
          className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
          placeholder={t("newPassword")}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button disabled={loading} className="w-full rounded-xl bg-sidebar py-2.5 text-sm font-medium text-white">
          {t("save")}
        </button>
      </form>
    </div>
  );
}
