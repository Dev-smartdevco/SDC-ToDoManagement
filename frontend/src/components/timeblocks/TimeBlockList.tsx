"use client";

import type { TimeBlock } from "@/lib/types";
import { ProjectBadge } from "@/components/ui/ProjectBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n";

export function TimeBlockList({
  blocks,
  onAdd,
  onDelete,
}: {
  blocks: TimeBlock[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{t("timeBlocks")}</h3>
        <button onClick={onAdd} className="text-sm text-accent hover:underline">
          {t("addTimeBlock")}
        </button>
      </div>
      {blocks.length === 0 ? (
        <EmptyState title={t("emptyBlocks")} />
      ) : (
        <div className="divide-y divide-line rounded-2xl border border-line bg-white px-4">
          {blocks.map((block) => (
            <div key={block.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <div className="text-sm font-medium tabular-nums">
                  {block.startTime} — {block.endTime}
                </div>
                <div className="mt-1 text-sm">{block.title}</div>
                <div className="mt-1">
                  <ProjectBadge name={block.project?.name} color={block.project?.color} />
                </div>
              </div>
              <button onClick={() => onDelete(block.id)} className="text-xs text-muted hover:text-danger">
                {t("delete")}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
