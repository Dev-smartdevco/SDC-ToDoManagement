"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileNavigation } from "./MobileNavigation";
import { BrandLogo } from "./BrandLogo";
import { QuickAdd } from "@/components/quickadd/QuickAdd";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { isTypingTarget } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickKind, setQuickKind] = useState<"task" | "note" | "project" | "timeBlock" | "idea">("task");

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "n") {
        e.preventDefault();
        setQuickKind("task");
        setQuickOpen(true);
      }
      if (key === "q") {
        e.preventDefault();
        setQuickKind("task");
        setQuickOpen(true);
      }
      if (key === "/") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
      if (key === "t") {
        e.preventDefault();
        router.push("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">{t("loading")}</div>;
  }

  return (
    <div className="min-h-screen bg-bg md:ps-[280px] lg:ps-[300px]">
      <Sidebar onQuickAdd={() => { setQuickKind("task"); setQuickOpen(true); }} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-sidebar px-4 py-3 md:hidden">
          <BrandLogo size="sm" />
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">{children}</main>
      </div>
      <MobileNavigation onQuickAdd={() => { setQuickKind("task"); setQuickOpen(true); }} />
      <QuickAdd
        open={quickOpen}
        defaultKind={quickKind}
        onClose={() => setQuickOpen(false)}
        onCreated={() => {
          queryClient.invalidateQueries();
        }}
      />
    </div>
  );
}
