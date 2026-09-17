"use client";

import type { Note } from "@/lib/types";
import { ContextBadge } from "@/components/ui/ContextBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n";

export function NoteList({
  notes,
  onOpen,
}: {
  notes: Note[];
  onOpen: (note: Note) => void;
}) {
  const { t } = useI18n();
  if (!notes.length) return <EmptyState title={t("noNotes")} />;
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {notes.map((note) => (
        <button key={note.id} onClick={() => onOpen(note)} className="block w-full px-4 py-3 text-start hover:bg-bg/60">
          <div className="text-sm font-medium">{note.title}</div>
          <div className="mt-1 line-clamp-2 text-sm text-muted">{note.content || t("untitled")}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ContextBadge
              project={note.project?.name}
              category={note.category?.name}
              color={note.category?.color ?? note.project?.color}
            />
            {note.tags.map((tag) => (
              <span key={tag} className="text-[11px] uppercase tracking-wide text-muted">
                {tag}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
