"use client";

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safe = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <div>
      {label ? <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{label}</div> : null}
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-all duration-200" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}
