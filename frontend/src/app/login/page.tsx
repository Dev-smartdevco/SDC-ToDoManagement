"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { ApiError } from "@/lib/api";
import { BrandLogo } from "@/components/shell/BrandLogo";

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const { t, setLocale, locale } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/");
  }, [ready, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="pointer-events-none absolute -end-16 -top-16 h-80 w-80 rounded-full bg-accent/20" />
        <div className="relative z-10">
          <BrandLogo size="lg" showSubtitle />
        </div>
        <p className="relative z-10 text-sm text-white/50">{t("focusHint")}</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <div className="mb-8 rounded-2xl bg-sidebar p-4 lg:hidden">
            <BrandLogo size="md" />
          </div>
          <h2 className="text-2xl font-semibold">{t("signIn")}</h2>
          <p className="mt-1 text-sm text-muted">{t("signInSubtitle")}</p>
          <label className="mt-8 block text-sm">
            {t("email")}
            <input
              className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:ring-2 focus:ring-accent/30"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
              placeholder="admin@smartdevco.com"
              required
            />
          </label>
          <label className="mt-4 block text-sm">
            {t("password")}
            <input
              className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:ring-2 focus:ring-accent/30"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </label>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <button
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-sidebar py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? t("loading") : t("continue")}
          </button>
          <div className="mt-6 flex gap-2 text-xs text-muted">
            <button type="button" onClick={() => setLocale("en")} className={locale === "en" ? "text-ink" : ""}>
              EN
            </button>
            <span>/</span>
            <button type="button" onClick={() => setLocale("ar")} className={locale === "ar" ? "text-ink" : ""}>
              AR
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
