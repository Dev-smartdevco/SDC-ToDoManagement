"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { endpoints } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

export default function NoteDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const noteQuery = useQuery({ queryKey: ["note", params.id], queryFn: () => endpoints.note(params.id) });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: endpoints.projects });
  const tasksQuery = useQuery({ queryKey: ["tasks", "notes"], queryFn: () => endpoints.tasks("limit=100") });

  if (noteQuery.isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (noteQuery.isError || !noteQuery.data) return <p className="text-sm text-danger">{t("error")}</p>;

  return (
    <NoteEditor
      note={noteQuery.data}
      projects={projectsQuery.data ?? []}
      tasks={tasksQuery.data?.items ?? []}
      onSave={async (value) => {
        await endpoints.updateNote(params.id, value);
        queryClient.invalidateQueries({ queryKey: ["note", params.id] });
        queryClient.invalidateQueries({ queryKey: ["notes"] });
        toast.push(t("saved"));
      }}
      onDelete={async () => {
        await endpoints.deleteNote(params.id);
        toast.push(t("deleted"));
        router.push("/notes");
      }}
    />
  );
}
