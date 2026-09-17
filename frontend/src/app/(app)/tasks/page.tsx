"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterBar, Select } from "@/components/ui/FilterBar";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskForm, type TaskFormValue } from "@/components/tasks/TaskForm";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { endpoints } from "@/lib/api";
import { todayIso } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import type { Task } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const views = ["all", "inbox", "today", "upcoming", "overdue", "completed"] as const;

export default function TasksPage() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<(typeof views)[number]>("all");
  const [q, setQ] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Task | Partial<Task> | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const search = useDebouncedValue(q, 250);

  const params = useMemo(() => {
    const p = new URLSearchParams({ view, limit: "50", date: todayIso() });
    if (search) p.set("q", search);
    if (projectId) p.set("projectId", projectId);
    if (priority) p.set("priority", priority);
    if (status) p.set("status", status);
    return p.toString();
  }, [view, search, projectId, priority, status]);

  const tasksQuery = useQuery({ queryKey: ["tasks", params], queryFn: () => endpoints.tasks(params) });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: endpoints.projects });

  const save = useMutation({
    mutationFn: (value: TaskFormValue) => {
      const body = {
        title: value.title,
        projectId: value.projectId || null,
        priority: value.priority,
        status: value.status,
        dueDate: value.dueDate || null,
        dueTime: value.dueTime || null,
        estimatedMinutes: value.estimatedMinutes ? Number(value.estimatedMinutes) : null,
        description: value.description || null,
        tags: value.tags.split(",").map((x) => x.trim()).filter(Boolean),
      };
      return editing && "id" in editing && editing.id
        ? endpoints.updateTask(editing.id, body)
        : endpoints.createTask(body);
    },
    onSuccess: () => {
      setEditing(null);
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.push(t("saved"));
    },
    onError: () => toast.push(t("error"), "error"),
  });

  return (
    <div>
      <PageHeader
        title={t("tasks")}
        actions={
          <button
            onClick={() => {
              setCreating(true);
              setEditing({ title: "", priority: "MEDIUM", status: "TODO" });
            }}
            className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white"
          >
            {t("newTask")}
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {views.map((item) => (
          <button
            key={item}
            onClick={() => setView(item)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${view === item ? "bg-sidebar text-white" : "bg-white text-muted"}`}
          >
            {t(item === "all" ? "all" : item === "inbox" ? "inbox" : item === "today" ? "today" : item === "upcoming" ? "upcoming" : item === "overdue" ? "overdue" : "completed")}
          </button>
        ))}
      </div>
      <div className="mb-4 space-y-3">
        <SearchBar value={q} onChange={setQ} placeholder={t("searchTasks")} />
        <FilterBar>
          <Select value={projectId} onChange={setProjectId}>
            <option value="">{t("project")}</option>
            {(projectsQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select value={priority} onChange={setPriority}>
            <option value="">{t("priority")}</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </Select>
          <Select value={status} onChange={setStatus}>
            <option value="">{t("status")}</option>
            <option value="INBOX">INBOX</option>
            <option value="TODO">TODO</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="DONE">DONE</option>
            <option value="CANCELLED">CANCELLED</option>
          </Select>
        </FilterBar>
      </div>
      {tasksQuery.isLoading ? <p className="text-sm text-muted">{t("loading")}</p> : null}
      {tasksQuery.isError ? <p className="text-sm text-danger">{t("error")}</p> : null}
      {tasksQuery.data ? (
        <div className="rounded-2xl border border-line bg-white px-4">
          <TaskList
            tasks={tasksQuery.data.items}
            empty={t("noResults")}
            onToggle={async (task) => {
              await endpoints.patchStatus(task.id, task.status === "DONE" ? "TODO" : "DONE");
              queryClient.invalidateQueries({ queryKey: ["tasks"] });
            }}
            onEdit={setEditing}
            onDelete={setDeleting}
            onDuplicate={async (task) => {
              await endpoints.duplicateTask(task.id);
              queryClient.invalidateQueries({ queryKey: ["tasks"] });
            }}
            onPostpone={async (task) => {
              await endpoints.postponeTask(task.id);
              queryClient.invalidateQueries({ queryKey: ["tasks"] });
            }}
          />
        </div>
      ) : null}

      <Modal open={Boolean(editing) || creating} title={editing && "id" in editing && editing.id ? t("edit") : t("newTask")} onClose={() => { setEditing(null); setCreating(false); }}>
        <TaskForm
          autoFocus
          task={editing}
          projects={projectsQuery.data ?? []}
          onCancel={() => { setEditing(null); setCreating(false); }}
          onSubmit={(value) => save.mutate(value)}
        />
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await endpoints.deleteTask(deleting.id);
          setDeleting(null);
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          toast.push(t("deleted"));
        }}
      />
    </div>
  );
}
