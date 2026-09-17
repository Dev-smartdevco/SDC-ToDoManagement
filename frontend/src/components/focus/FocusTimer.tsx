"use client";

import { useEffect, useState } from "react";
import type { FocusSession, Task } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { ContextBadge } from "@/components/ui/ContextBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";

function formatClock(totalSeconds: number) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FocusTimer({
  task,
  session,
  onStart,
  onPause,
  onResume,
  onComplete,
  onCancel,
  onSnooze,
}: {
  task: Task | null;
  session: FocusSession | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onSnooze: () => void;
}) {
  const { t } = useI18n();
  const target = (task?.estimatedMinutes ?? 45) * 60;
  const [elapsed, setElapsed] = useState(session?.liveSeconds ?? session?.accumulatedSeconds ?? 0);

  useEffect(() => {
    setElapsed(session?.liveSeconds ?? session?.accumulatedSeconds ?? 0);
  }, [session?.id, session?.status, session?.liveSeconds, session?.accumulatedSeconds]);

  useEffect(() => {
    if (session?.status !== "RUNNING") return;
    const started = Date.now();
    const base = session.liveSeconds ?? session.accumulatedSeconds ?? 0;
    const timer = window.setInterval(() => {
      setElapsed(base + Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session?.status, session?.id, session?.liveSeconds, session?.accumulatedSeconds]);

  const remaining = Math.max(0, target - elapsed);
  const active = session && (session.status === "RUNNING" || session.status === "PAUSED");

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        🔥 {t("currentFocus")}
      </div>
      {task ? (
        <>
          <h2 className="mt-3 text-xl font-semibold leading-snug">{task.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
          <ContextBadge
            project={task.project?.name}
            category={task.category?.name}
            color={task.category?.color ?? task.project?.color}
          />
            <PriorityBadge priority={task.priority} />
            {task.estimatedMinutes ? (
              <span className="text-sm text-muted">
                {task.estimatedMinutes} {t("minutes")}
              </span>
            ) : null}
          </div>
          {active ? (
            <div className="mt-6 font-sans text-5xl font-semibold tracking-tight tabular-nums">
              {formatClock(remaining)}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {!active ? (
              <button onClick={onStart} className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white">
                {t("startFocus")}
              </button>
            ) : session?.status === "RUNNING" ? (
              <button onClick={onPause} className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white">
                {t("pause")}
              </button>
            ) : (
              <button onClick={onResume} className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white">
                {t("resume")}
              </button>
            )}
            <button onClick={onComplete} className="rounded-xl border border-line px-4 py-2 text-sm">
              {t("complete")}
            </button>
            {active ? (
              <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-muted">
                {t("cancel")}
              </button>
            ) : (
              <button onClick={onSnooze} className="rounded-xl px-4 py-2 text-sm text-muted">
                {t("snooze")}
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">{t("noFocus")}</p>
      )}
    </section>
  );
}
