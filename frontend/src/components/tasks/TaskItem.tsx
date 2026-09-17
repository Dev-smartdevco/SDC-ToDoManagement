"use client";

import { useState } from "react";
import { Check, MoreHorizontal } from "lucide-react";
import type { Task } from "@/lib/types";
import { ContextBadge } from "@/components/ui/ContextBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { useI18n } from "@/lib/i18n";

export function TaskItem({
  task,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
  onPostpone,
  compact,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onDuplicate?: (task: Task) => void;
  onPostpone?: (task: Task) => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const done = task.status === "DONE";

  return (
    <div className="group flex items-start gap-3 border-b border-line/80 py-3 last:border-b-0">
      <button
        onClick={() => onToggle(task)}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
          done ? "border-success bg-success text-white" : "border-line bg-white hover:border-accent"
        }`}
        aria-label={done ? t("complete") : t("complete")}
      >
        {done ? <Check size={12} /> : null}
      </button>
      <button onClick={() => onEdit(task)} className="min-w-0 flex-1 text-start">
        <div className={`text-sm ${done ? "text-muted line-through" : "text-ink"}`}>{task.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <ContextBadge
            project={task.project?.name}
            category={task.category?.name}
            color={task.category?.color ?? task.project?.color}
          />
          <PriorityBadge priority={task.priority} />
          {task.dueTime ? <span className="text-[11px] text-muted">{task.dueTime}</span> : null}
          {task.estimatedMinutes ? (
            <span className="text-[11px] text-muted">
              {task.estimatedMinutes} {t("minutes")}
            </span>
          ) : null}
          {task.daysOverdue ? (
            <span className="text-[11px] text-danger">
              {task.daysOverdue === 1 ? t("dayOverdue") : t("daysOverdue", { count: task.daysOverdue })}
            </span>
          ) : null}
        </div>
      </button>
      {!compact ? (
        <div className="relative">
          <button
            onClick={() => setMenu((v) => !v)}
            className="rounded-lg p-1.5 text-muted opacity-100 hover:bg-bg md:opacity-0 md:group-hover:opacity-100"
          >
            <MoreHorizontal size={16} />
          </button>
          {menu ? (
            <div className="absolute end-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-soft">
              <button className="block w-full px-3 py-1.5 text-start text-sm hover:bg-bg" onClick={() => { setMenu(false); onEdit(task); }}>
                {t("edit")}
              </button>
              {onPostpone ? (
                <button className="block w-full px-3 py-1.5 text-start text-sm hover:bg-bg" onClick={() => { setMenu(false); onPostpone(task); }}>
                  {t("postpone")}
                </button>
              ) : null}
              {onDuplicate ? (
                <button className="block w-full px-3 py-1.5 text-start text-sm hover:bg-bg" onClick={() => { setMenu(false); onDuplicate(task); }}>
                  {t("duplicate")}
                </button>
              ) : null}
              <button className="block w-full px-3 py-1.5 text-start text-sm text-danger hover:bg-bg" onClick={() => { setMenu(false); onDelete(task); }}>
                {t("delete")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
