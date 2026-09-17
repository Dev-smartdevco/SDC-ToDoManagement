"use client";

export function ContextBadge({
  project,
  category,
  color,
}: {
  project?: string | null;
  category?: string | null;
  color?: string | null;
}) {
  if (!project && !category) return null;
  const label = [project, category].filter(Boolean).join(" · ");
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color || "#3A96D4" }} />
      {label}
    </span>
  );
}
