"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";
import { MobileNavigation } from "./MobileNavigation";
import { MobileTopBar } from "./MobileTopBar";
import { QuickAdd } from "@/components/quickadd/QuickAdd";
import { useAuth, useScopedKey } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { isTypingTarget } from "@/lib/format";
import { endpoints } from "@/lib/api";
import { invalidateWorkspace } from "@/lib/query";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickKind, setQuickKind] = useState<"task" | "note" | "project" | "timeBlock" | "idea">("task");
  const projectsKey = useScopedKey(["projects"]);

  useQuery({
    queryKey: projectsKey,
    queryFn: endpoints.projects,
    staleTime: 5 * 60_000,
    enabled: Boolean(user),
  });

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
        <MobileTopBar />
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">{children}</main>
      </div>
      <MobileNavigation onQuickAdd={() => { setQuickKind("task"); setQuickOpen(true); }} />
      <QuickAdd
        open={quickOpen}
        defaultKind={quickKind}
        onClose={() => setQuickOpen(false)}
        onCreated={() => {
          void invalidateWorkspace(queryClient, user.id);
        }}
      />
    </div>
  );
}
