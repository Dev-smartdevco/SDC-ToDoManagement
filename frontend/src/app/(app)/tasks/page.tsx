"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterBar, Select } from "@/components/ui/FilterBar";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskForm, taskPayload, type TaskFormValue } from "@/components/tasks/TaskForm";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { endpoints } from "@/lib/api";
import { todayIso } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import type { Task } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useScopedKey } from "@/lib/auth";
import { keepPreviousData } from "@/lib/query";

const views = ["all", "inbox", "today", "upcoming", "overdue", "completed"] as const;

export default function TasksPage() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<(typeof views)[number]>("all");
  const [q, setQ] = useState("");
  const [projectId, setProjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editing, setEditing] = useState<Task | Partial<Task> | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const search = useDebouncedValue(q, 250);

  const params = useMemo(() => {
    const p = new URLSearchParams({ view, limit: "50", date: todayIso() });
    if (search) p.set("q", search);
    if (projectId) p.set("projectId", projectId);
    if (categoryId) p.set("categoryId", categoryId);
    if (priority) p.set("priority", priority);
    if (status) p.set("status", status);
    if (dueDate) p.set("dueDate", dueDate);
    return p.toString();
  }, [view, search, projectId, categoryId, priority, status, dueDate]);

  const tasksScope = useScopedKey(["tasks"]);
  const projectsScope = useScopedKey(["projects"]);
  const tasksQuery = useQuery({
    queryKey: useScopedKey(["tasks", params]),
    queryFn: () => endpoints.tasks(params),
    placeholderData: keepPreviousData,
  });
  const projectsQuery = useQuery({ queryKey: projectsScope, queryFn: endpoints.projects, staleTime: 5 * 60_000 });
  const categoriesQuery = useQuery({
    queryKey: useScopedKey(["categories", projectId]),
    queryFn: () => endpoints.projectCategories(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  const save = useMutation({
    mutationFn: (value: TaskFormValue) => {
      const body = taskPayload(value);
      return editing && "id" in editing && editing.id
        ? endpoints.updateTask(editing.id, body)
        : endpoints.createTask(body);
    },
    onSuccess: () => {
      setEditing(null);
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: tasksScope });
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
          <Select
            value={projectId}
            onChange={(value) => {
              setProjectId(value);
              setCategoryId("");
            }}
          >
            <option value="">{t("project")}</option>
            {(projectsQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select value={categoryId} onChange={setCategoryId}>
            <option value="">{t("category")}</option>
            {(categoriesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />
        </FilterBar>
        {projectId && (categoriesQuery.data?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategoryId("")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                !categoryId ? "bg-sidebar text-white" : "bg-white text-muted"
              }`}
            >
              {t("all")}
            </button>
            {(categoriesQuery.data ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  categoryId === c.id ? "bg-sidebar text-white" : "bg-white text-muted"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        ) : null}
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
              queryClient.invalidateQueries({ queryKey: tasksScope });
            }}
            onEdit={setEditing}
            onDelete={setDeleting}
            onDuplicate={async (task) => {
              await endpoints.duplicateTask(task.id);
              queryClient.invalidateQueries({ queryKey: tasksScope });
            }}
            onPostpone={async (task) => {
              await endpoints.postponeTask(task.id);
              queryClient.invalidateQueries({ queryKey: tasksScope });
            }}
            onReorder={(ids) => endpoints.reorderTasks(ids).then(() => queryClient.invalidateQueries({ queryKey: tasksScope }))}
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
          onToggleSubtask={async (id, done) => {
            await endpoints.patchStatus(id, done ? "DONE" : "TODO");
            queryClient.invalidateQueries({ queryKey: tasksScope });
          }}
        />
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await endpoints.deleteTask(deleting.id);
          setDeleting(null);
          queryClient.invalidateQueries({ queryKey: tasksScope });
          toast.push(t("deleted"));
        }}
      />
    </div>
  );
}
