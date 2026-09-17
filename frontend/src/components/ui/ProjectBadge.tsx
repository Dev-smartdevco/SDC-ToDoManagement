"use client";

export function ProjectBadge({ name, color }: { name?: string | null; color?: string | null }) {
  if (!name) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color || "#3A96D4" }} />
      {name}
    </span>
  );
}
