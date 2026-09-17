"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TaskList } from "@/components/tasks/TaskList";
import { NoteList } from "@/components/notes/NoteList";
import { endpoints } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

function ProjectDetailsInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["project", id],
    queryFn: () => endpoints.project(id),
    enabled: Boolean(id),
  });
  const project = query.data;

  if (!id) return <p className="text-sm text-danger">{t("error")}</p>;
  if (query.isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (query.isError || !project) return <p className="text-sm text-danger">{t("error")}</p>;

  return (
    <div className="space-y-8">
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        actions={
          <button
            onClick={async () => {
              await endpoints.deleteProject(project.id);
              toast.push(t("deleted"));
              router.push("/projects");
            }}
            className="text-sm text-danger"
          >
            {t("delete")}
          </button>
        }
      />
      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("overview")}</div>
        <ProgressBar value={project.progress} label={`${t("progress")} ${project.progress}%`} />
        <div className="mt-3 text-sm text-muted">
          {project.openTasks.length} {t("openTasks")} · {project.completedTasks.length} {t("completed")}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-danger">{t("overdue")}</h2>
        <div className="rounded-2xl border border-line bg-white px-4">
          <TaskList
            tasks={project.overdueTasks}
            onToggle={async (task) => {
              await endpoints.patchStatus(task.id, task.status === "DONE" ? "TODO" : "DONE");
              queryClient.invalidateQueries({ queryKey: ["project", id] });
            }}
            onEdit={() => router.push("/tasks")}
            onDelete={async (task) => {
              await endpoints.deleteTask(task.id);
              queryClient.invalidateQueries({ queryKey: ["project", id] });
            }}
          />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("openTasks")}</h2>
        <div className="rounded-2xl border border-line bg-white px-4">
          <TaskList
            tasks={project.openTasks}
            onToggle={async (task) => {
              await endpoints.patchStatus(task.id, task.status === "DONE" ? "TODO" : "DONE");
              queryClient.invalidateQueries({ queryKey: ["project", id] });
            }}
            onEdit={() => router.push("/tasks")}
            onDelete={async (task) => {
              await endpoints.deleteTask(task.id);
              queryClient.invalidateQueries({ queryKey: ["project", id] });
            }}
          />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("upcomingTasks")}</h2>
        <div className="rounded-2xl border border-line bg-white px-4">
          <TaskList
            tasks={project.upcomingTasks}
            onToggle={async (task) => {
              await endpoints.patchStatus(task.id, task.status === "DONE" ? "TODO" : "DONE");
              queryClient.invalidateQueries({ queryKey: ["project", id] });
            }}
            onEdit={() => router.push("/tasks")}
            onDelete={async (task) => {
              await endpoints.deleteTask(task.id);
              queryClient.invalidateQueries({ queryKey: ["project", id] });
            }}
          />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("completedTasks")}</h2>
        <div className="rounded-2xl border border-line bg-white px-4">
          <TaskList
            tasks={project.completedTasks}
            onToggle={async (task) => {
              await endpoints.patchStatus(task.id, "TODO");
              queryClient.invalidateQueries({ queryKey: ["project", id] });
            }}
            onEdit={() => router.push("/tasks")}
            onDelete={async (task) => {
              await endpoints.deleteTask(task.id);
              queryClient.invalidateQueries({ queryKey: ["project", id] });
            }}
          />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("notes")}</h2>
        <NoteList notes={project.notes} onOpen={(note) => router.push(`/notes/detail?id=${note.id}`)} />
      </section>
    </div>
  );
}

export default function ProjectDetailsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <ProjectDetailsInner />
    </Suspense>
  );
}
