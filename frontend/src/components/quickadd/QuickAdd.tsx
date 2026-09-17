"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { TaskForm, taskPayload, type TaskFormValue } from "@/components/tasks/TaskForm";
import { TimeBlockForm } from "@/components/timeblocks/TimeBlockForm";
import { endpoints } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { todayIso } from "@/lib/format";
import type { Project, Task } from "@/lib/types";
import { useToast } from "@/lib/toast";
import { useScopedKey } from "@/lib/auth";

const kinds = ["task", "note", "project", "timeBlock", "idea"] as const;
type Kind = (typeof kinds)[number];

export function QuickAdd({
  open,
  onClose,
  defaultKind = "task",
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  defaultKind?: Kind;
  onCreated?: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [title, setTitle] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectColor, setProjectColor] = useState("#3A96D4");

  const projectsQuery = useQuery({
    queryKey: useScopedKey(["projects"]),
    queryFn: endpoints.projects,
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const tasksQuery = useQuery({
    queryKey: useScopedKey(["tasks", "quick"]),
    queryFn: () => endpoints.tasks("view=all&limit=100"),
    enabled: open && kind === "timeBlock",
    staleTime: 60_000,
  });

  useEffect(() => {
    if (open) {
      setKind(defaultKind);
      setExpanded(false);
      setTitle("");
    }
  }, [open, defaultKind]);

  const projects = (projectsQuery.data ?? []) as Project[];
  const tasks = (tasksQuery.data?.items ?? []) as Task[];
  const ideasProject = useMemo(
    () => projects.find((p) => p.name.toLowerCase().includes("idea")),
    [projects],
  );

  async function saveTask(value: TaskFormValue) {
    await endpoints.createTask({
      ...taskPayload(value),
      status: value.dueDate ? value.status : "INBOX",
    });
    toast.push(t("created"));
    onCreated?.();
    onClose();
  }

  const labels: Record<Kind, string> = {
    task: t("task"),
    note: t("note"),
    project: t("project"),
    timeBlock: t("timeBlock"),
    idea: t("idea"),
  };

  return (
    <Modal open={open} onClose={onClose} title={t("quickAdd")}>
      <div className="mb-4 flex flex-wrap gap-2">
        {kinds.map((item) => (
          <button
            key={item}
            onClick={() => setKind(item)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              kind === item ? "bg-sidebar text-white" : "bg-bg text-muted"
            }`}
          >
            {labels[item]}
          </button>
        ))}
      </div>

      {kind === "task" && !expanded ? (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            await endpoints.capture(title.trim());
            toast.push(t("inboxHint"));
            setTitle("");
            onCreated?.();
            onClose();
          }}
        >
          <input
            autoFocus
            className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            placeholder={t("typeAnything")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setExpanded(true)} className="text-sm text-muted hover:text-ink">
              {t("moreDetails")}
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted">
                {t("cancel")}
              </button>
              <button className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white">{t("save")}</button>
            </div>
          </div>
        </form>
      ) : null}

      {kind === "task" && expanded ? (
        <TaskForm autoFocus projects={projects} onCancel={onClose} onSubmit={saveTask} />
      ) : null}

      {kind === "note" || kind === "idea" ? (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!noteTitle.trim()) return;
            await endpoints.createNote({
              title: noteTitle,
              content: noteContent,
              projectId: kind === "idea" ? ideasProject?.id ?? null : null,
              tags: kind === "idea" ? ["idea"] : [],
            });
            toast.push(t("created"));
            setNoteTitle("");
            setNoteContent("");
            onCreated?.();
            onClose();
          }}
        >
          <input
            autoFocus
            className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            placeholder={t("title")}
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
          />
          <textarea
            className="min-h-28 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            placeholder={t("writeHere")}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted">
              {t("cancel")}
            </button>
            <button className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white">{t("save")}</button>
          </div>
        </form>
      ) : null}

      {kind === "project" ? (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!projectName.trim()) return;
            await endpoints.createProject({ name: projectName, color: projectColor });
            toast.push(t("created"));
            setProjectName("");
            onCreated?.();
            onClose();
          }}
        >
          <input
            autoFocus
            className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            placeholder={t("title")}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <input type="color" className="h-10 w-full rounded-xl border border-line" value={projectColor} onChange={(e) => setProjectColor(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted">
              {t("cancel")}
            </button>
            <button className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white">{t("save")}</button>
          </div>
        </form>
      ) : null}

      {kind === "timeBlock" ? (
        <TimeBlockForm
          projects={projects}
          tasks={tasks}
          date={todayIso()}
          onCancel={onClose}
          onSubmit={async (value) => {
            await endpoints.createTimeBlock(value);
            toast.push(t("created"));
            onCreated?.();
            onClose();
          }}
        />
      ) : null}
    </Modal>
  );
}
