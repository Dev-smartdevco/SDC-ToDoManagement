"use client";

import type { ProjectStatus, TaskStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: TaskStatus | ProjectStatus }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
      {status.replace("_", " ")}
    </span>
  );
}
