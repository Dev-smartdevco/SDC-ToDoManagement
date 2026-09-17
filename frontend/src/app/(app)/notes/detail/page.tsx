"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { endpoints } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import { useScopedKey } from "@/lib/auth";

function NoteDetailsInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const noteKey = useScopedKey(["note", id]);
  const notesKey = useScopedKey(["notes"]);
  const noteQuery = useQuery({
    queryKey: noteKey,
    queryFn: () => endpoints.note(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
  const projectsQuery = useQuery({ queryKey: useScopedKey(["projects"]), queryFn: endpoints.projects, staleTime: 5 * 60_000 });
  const tasksQuery = useQuery({
    queryKey: useScopedKey(["tasks", "notes"]),
    queryFn: () => endpoints.tasks("limit=50"),
    staleTime: 60_000,
  });

  if (!id) return <p className="text-sm text-danger">{t("error")}</p>;
  if (noteQuery.isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (noteQuery.isError || !noteQuery.data) return <p className="text-sm text-danger">{t("error")}</p>;

  return (
    <NoteEditor
      note={noteQuery.data}
      projects={projectsQuery.data ?? []}
      tasks={tasksQuery.data?.items ?? []}
      onSave={async (value) => {
        await endpoints.updateNote(id, value);
        queryClient.invalidateQueries({ queryKey: noteKey });
        queryClient.invalidateQueries({ queryKey: notesKey });
        toast.push(t("saved"));
      }}
      onDelete={async () => {
        await endpoints.deleteNote(id);
        toast.push(t("deleted"));
        router.push("/notes");
      }}
    />
  );
}

export default function NoteDetailsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <NoteDetailsInner />
    </Suspense>
  );
}
