"use client";

import { Check } from "lucide-react";
import type { Task } from "@/lib/types";
import { ContextBadge } from "@/components/ui/ContextBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useI18n } from "@/lib/i18n";

export function TaskDetails({
  task,
  onToggleSubtask,
}: {
  task: Task;
  onToggleSubtask?: (id: string, done: boolean) => void;
}) {
  const { t } = useI18n();
  const progress = task.subtaskProgress;
  const subtasks = task.subtasks ?? [];

  return (
    <div className="space-y-3 text-sm">
      <h3 className="text-base font-semibold">{task.title}</h3>
      <div className="flex flex-wrap gap-3">
        <ContextBadge
          project={task.project?.name}
          category={task.category?.name}
          color={task.category?.color ?? task.project?.color}
        />
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={task.status} />
      </div>
      {task.description ? <p className="whitespace-pre-wrap text-muted">{task.description}</p> : null}
      {progress?.total ? (
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
            <span>{t("checklist")}</span>
            <span>{t("completedOf", { completed: progress.completed, total: progress.total })}</span>
          </div>
          <ProgressBar value={progress.percent} />
        </div>
      ) : null}
      {subtasks.length ? (
        <div className="space-y-2 rounded-2xl border border-line bg-bg/60 p-3">
          {subtasks.map((item) => {
            const done = item.status === "DONE";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggleSubtask?.(item.id, !done)}
                className="flex w-full items-center gap-2 text-start"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    done ? "border-success bg-success text-white" : "border-line bg-white"
                  }`}
                >
                  {done ? <Check size={12} /> : null}
                </span>
                <span className={done ? "text-muted line-through" : "text-ink"}>{item.title}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 text-muted">
        <div>
          {t("dueDate")}: {task.dueDate ?? "—"}
        </div>
        <div>
          {t("dueTime")}: {task.dueTime ?? "—"}
        </div>
        <div>
          {t("estimatedDuration")}: {task.estimatedMinutes ?? "—"} {t("minutes")}
        </div>
      </div>
    </div>
  );
}
