"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const { t, setLocale, locale } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("admin@smartdevco.com");
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
          <Image src="/brand/logo.svg" alt="SmartDevCo" width={72} height={72} />
          <div className="mt-8 text-sm tracking-[0.3em] text-white/60">SMARTDEVCO</div>
          <h1 className="mt-16 text-5xl font-semibold text-white">{t("appName")}</h1>
          <p className="mt-3 text-lg text-white/70">{t("subtitle")}</p>
        </div>
        <p className="relative z-10 text-sm text-white/50">{t("focusHint")}</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/brand/logo.svg" alt="" width={42} height={42} />
            <div>
              <div className="font-semibold">{t("appName")}</div>
              <div className="text-xs text-muted">{t("subtitle")}</div>
            </div>
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
