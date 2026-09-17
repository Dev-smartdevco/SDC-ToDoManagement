"use client";

import type { Task } from "@/lib/types";
import { ContextBadge } from "@/components/ui/ContextBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useI18n } from "@/lib/i18n";

export function TaskDetails({ task }: { task: Task }) {
  const { t } = useI18n();
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
