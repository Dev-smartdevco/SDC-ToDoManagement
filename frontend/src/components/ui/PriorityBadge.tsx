"use client";

import type { Priority } from "@/lib/types";

const styles: Record<Priority, string> = {
  URGENT: "text-danger",
  HIGH: "text-warning",
  MEDIUM: "text-muted",
  LOW: "text-muted/80",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${styles[priority]}`}>
      {priority === "MEDIUM" ? "NORMAL" : priority}
    </span>
  );
}
