"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { endpoints } from "@/lib/api";
import { PROJECT_COLORS } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import { useScopedKey } from "@/lib/auth";

export default function ProjectsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const projectsKey = useScopedKey(["projects"]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [isDefault, setIsDefault] = useState(false);
  const query = useQuery({ queryKey: projectsKey, queryFn: endpoints.projects, staleTime: 5 * 60_000 });

  async function refresh() {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey.some(
          (part) =>
            part === "projects" ||
            part === "today" ||
            part === "tasks" ||
            part === "notes" ||
            part === "calendar" ||
            part === "stats",
        ),
    });
  }

  return (
    <div>
      <PageHeader
        title={t("projects")}
        actions={
          <button onClick={() => setOpen(true)} className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white">
            {t("newProject")}
          </button>
        }
      />
      {query.isLoading ? <p className="text-sm text-muted">{t("loading")}</p> : null}
      {query.isError ? <p className="text-sm text-danger">{t("error")}</p> : null}
      {query.data?.length === 0 ? <EmptyState title={t("noProjects")} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {(query.data ?? []).map((project) => (
          <div key={project.id} className="rounded-2xl border border-line bg-white p-4 hover:border-accent/40">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/projects/detail?id=${project.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: project.color }} />
                  <h2 className="font-semibold">{project.name}</h2>
                  {project.isDefault ? (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      {t("defaultProject")}
                    </span>
                  ) : null}
                </div>
                {project.description ? <p className="mt-2 line-clamp-2 text-sm text-muted">{project.description}</p> : null}
                <div className="mt-4">
                  <ProgressBar value={project.progress ?? 0} />
                  <div className="mt-2 text-xs text-muted">
                    {project.openTasks ?? 0} {t("openTasks")} · {project.completedTasks ?? 0} {t("completed")}
                  </div>
                </div>
              </Link>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-[11px] uppercase tracking-wide text-muted">{project.status}</span>
                {!project.isDefault ? (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-accent"
                    onClick={async (e) => {
                      e.preventDefault();
                      await endpoints.updateProject(project.id, { isDefault: true });
                      await refresh();
                      toast.push(t("saved"));
                    }}
                  >
                    {t("setAsDefault")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Modal open={open} title={t("newProject")} onClose={() => setOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await endpoints.createProject({ name, description, color, isDefault });
            setOpen(false);
            setName("");
            setDescription("");
            setIsDefault(false);
            await refresh();
            toast.push(t("created"));
          }}
        >
          <input autoFocus className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" placeholder={t("title")} value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="min-h-24 w-full rounded-xl border border-line px-3 py-2.5 text-sm" placeholder={t("description")} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className="h-7 w-7 rounded-full border border-white shadow" style={{ background: c, outline: color === c ? "2px solid #132033" : undefined }} />
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            {t("setAsDefault")}
          </label>
          <div className="flex justify-end">
            <button className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white">{t("save")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
