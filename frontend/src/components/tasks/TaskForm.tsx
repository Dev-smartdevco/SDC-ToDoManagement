"use client";

import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Priority, Project, Task, TaskStatus } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { endpoints } from "@/lib/api";
import { useScopedKey } from "@/lib/auth";
import { ProgressBar } from "@/components/ui/ProgressBar";

const field =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30";

export type ChecklistItem = {
  key: string;
  id?: string;
  title: string;
  status: TaskStatus;
};

export type TaskFormValue = {
  title: string;
  projectId: string;
  categoryId: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  dueTime: string;
  estimatedMinutes: string;
  description: string;
  checklist: ChecklistItem[];
  assigneeIds: string[];
  blockedReason: string;
};

function newItem(): ChecklistItem {
  const key = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `tmp-${Date.now()}`;
  return { key, title: "", status: "TODO" };
}

function itemsFromTask(task?: Partial<Task> | null): ChecklistItem[] {
  if (!task?.subtasks?.length) return [newItem()];
  return task.subtasks.map((item) => ({
    key: item.id,
    id: item.id,
    title: item.title,
    status: item.status,
  }));
}

function formFromTask(task?: Partial<Task> | null): TaskFormValue {
  return {
    title: task?.title ?? "",
    projectId: task?.projectId ?? "",
    categoryId: task?.categoryId ?? "",
    priority: task?.priority ?? "MEDIUM",
    status: task?.status ?? "TODO",
    dueDate: task?.dueDate ?? "",
    dueTime: task?.dueTime ?? "",
    estimatedMinutes: task?.estimatedMinutes ? String(task.estimatedMinutes) : "",
    description: task?.description ?? "",
    checklist: itemsFromTask(task),
    assigneeIds: task?.assignees?.map((row) => row.id) ?? [],
    blockedReason: task?.blockedReason ?? "",
  };
}

function derivedStatus(items: ChecklistItem[], current: TaskStatus): TaskStatus {
  if (current === "CANCELLED" || current === "BLOCKED") return current;
  const filled = items.filter((item) => item.title.trim());
  if (!filled.length) return current;
  const completed = filled.filter((item) => item.status === "DONE").length;
  if (completed === filled.length) return "DONE";
  if (completed === 0) return current === "INBOX" ? "INBOX" : "TODO";
  return "IN_PROGRESS";
}

export function taskPayload(value: TaskFormValue) {
  return {
    title: value.title,
    projectId: value.projectId || null,
    categoryId: value.categoryId || null,
    priority: value.priority,
    status: value.status,
    dueDate: value.dueDate || null,
    dueTime: value.dueTime || null,
    estimatedMinutes: value.estimatedMinutes ? Number(value.estimatedMinutes) : null,
    description: value.description || null,
    assigneeIds: value.assigneeIds,
    blockedReason: value.status === "BLOCKED" ? value.blockedReason || null : null,
    subtasks: value.checklist
      .filter((item) => item.title.trim())
      .map((item) => ({
        id: item.id,
        title: item.title.trim(),
        status: item.status,
      })),
  };
}

export function TaskForm({
  task,
  projects,
  onSubmit,
  onCancel,
  onToggleSubtask,
  autoFocus,
}: {
  task?: Partial<Task> | null;
  projects: Project[];
  onSubmit: (value: TaskFormValue) => void;
  onCancel: () => void;
  onToggleSubtask?: (id: string, done: boolean) => void;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState<TaskFormValue>(() => formFromTask(task));

  useEffect(() => {
    setValue(formFromTask(task));
  }, [task]);

  useEffect(() => {
    const editing = Boolean(task && "id" in task && task.id);
    if (editing) return;
    if (task?.projectId) return;
    setValue((current) => {
      if (current.projectId) return current;
      const preferred = projects.find((p) => p.isDefault) ?? projects[0];
      if (!preferred) return current;
      return { ...current, projectId: preferred.id };
    });
  }, [projects, task]);

  const categoriesQuery = useQuery({
    queryKey: useScopedKey(["categories", value.projectId]),
    queryFn: () => endpoints.projectCategories(value.projectId),
    enabled: Boolean(value.projectId),
    staleTime: 5 * 60_000,
  });
  const directoryQuery = useQuery({
    queryKey: useScopedKey(["directory"]),
    queryFn: endpoints.directory,
    staleTime: 5 * 60_000,
    enabled: Boolean(value.projectId),
  });
  const categories = categoriesQuery.data ?? [];
  const people = directoryQuery.data ?? [];

  useEffect(() => {
    if (!value.categoryId) return;
    if (!value.projectId) {
      setValue((v) => ({ ...v, categoryId: "" }));
      return;
    }
    const items = categoriesQuery.data;
    if (items && !items.some((c) => c.id === value.categoryId)) {
      setValue((v) => ({ ...v, categoryId: "" }));
    }
  }, [value.projectId, value.categoryId, categoriesQuery.data]);

  const filled = value.checklist.filter((item) => item.title.trim());
  const completed = filled.filter((item) => item.status === "DONE").length;
  const percent = filled.length ? Math.round((completed / filled.length) * 100) : 0;

  function setChecklist(next: ChecklistItem[]) {
    setValue((v) => ({ ...v, checklist: next, status: derivedStatus(next, v.status) }));
  }

  function toggleItem(item: ChecklistItem) {
    const nextStatus: TaskStatus = item.status === "DONE" ? "TODO" : "DONE";
    setChecklist(value.checklist.map((row) => (row.key === item.key ? { ...row, status: nextStatus } : row)));
    if (item.id) onToggleSubtask?.(item.id, nextStatus === "DONE");
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.title.trim()) return;
        onSubmit(value);
      }}
    >
      <input
        autoFocus={autoFocus}
        className={field}
        placeholder={t("title")}
        value={value.title}
        onChange={(e) => setValue((v) => ({ ...v, title: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <select
          className={field}
          value={value.projectId}
          onChange={(e) => setValue((v) => ({ ...v, projectId: e.target.value, categoryId: "" }))}
        >
          <option value="">{t("project")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.isDefault ? `${p.name} ★` : p.name}
            </option>
          ))}
        </select>
        <select
          className={field}
          value={value.categoryId}
          disabled={!value.projectId}
          onChange={(e) => setValue((v) => ({ ...v, categoryId: e.target.value }))}
        >
          <option value="">{t("category")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <select className={field} value={value.priority} onChange={(e) => setValue((v) => ({ ...v, priority: e.target.value as Priority }))}>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="URGENT">URGENT</option>
        </select>
        <select className={field} value={value.status} onChange={(e) => setValue((v) => ({ ...v, status: e.target.value as TaskStatus }))}>
          <option value="INBOX">INBOX</option>
          <option value="TODO">TODO</option>
          <option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="DONE">DONE</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>
      {value.status === "BLOCKED" ? (
        <input
          className={field}
          placeholder={t("blockedReason")}
          value={value.blockedReason}
          onChange={(e) => setValue((v) => ({ ...v, blockedReason: e.target.value }))}
        />
      ) : null}
      {people.length ? (
        <div className="rounded-2xl border border-line bg-bg/60 p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{t("assignees")}</div>
          <div className="flex flex-wrap gap-2">
            {people.map((person) => {
              const checked = value.assigneeIds.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() =>
                    setValue((v) => ({
                      ...v,
                      assigneeIds: checked ? v.assigneeIds.filter((id) => id !== person.id) : [...v.assigneeIds, person.id],
                    }))
                  }
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${checked ? "bg-sidebar text-white" : "bg-white text-muted"}`}
                >
                  {person.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <input type="date" className={field} value={value.dueDate} onChange={(e) => setValue((v) => ({ ...v, dueDate: e.target.value }))} />
        <input type="time" className={field} value={value.dueTime} onChange={(e) => setValue((v) => ({ ...v, dueTime: e.target.value }))} />
      </div>
      <input
        className={field}
        placeholder={`${t("estimatedDuration")} (${t("minutes")})`}
        value={value.estimatedMinutes}
        onChange={(e) => setValue((v) => ({ ...v, estimatedMinutes: e.target.value }))}
      />
      <div className="rounded-2xl border border-line bg-bg/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{t("checklist")}</div>
          {filled.length ? (
            <div className="text-[11px] text-muted">{t("completedOf", { completed, total: filled.length })}</div>
          ) : null}
        </div>
        {filled.length ? (
          <div className="mb-3">
            <ProgressBar value={percent} />
          </div>
        ) : null}
        <div className="space-y-2">
          {value.checklist.map((item) => {
            const done = item.status === "DONE";
            return (
              <div key={item.key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleItem(item)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    done ? "border-success bg-success text-white" : "border-line bg-white hover:border-accent"
                  }`}
                  aria-label={t("complete")}
                >
                  {done ? <Check size={12} /> : null}
                </button>
                <input
                  className={`${field} py-2 ${done ? "text-muted line-through" : ""}`}
                  placeholder={t("addChecklistItem")}
                  value={item.title}
                  onChange={(e) =>
                    setChecklist(value.checklist.map((row) => (row.key === item.key ? { ...row, title: e.target.value } : row)))
                  }
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (!item.title.trim()) return;
                    setChecklist([...value.checklist, newItem()]);
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = value.checklist.filter((row) => row.key !== item.key);
                    setChecklist(next.length ? next : [newItem()]);
                  }}
                  className="rounded-lg p-1.5 text-muted hover:bg-white hover:text-danger"
                  aria-label={t("delete")}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setChecklist([...value.checklist, newItem()])}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <Plus size={14} />
          {t("addChecklistItem")}
        </button>
      </div>
      <textarea
        className={`${field} min-h-24`}
        placeholder={t("description")}
        value={value.description}
        onChange={(e) => setValue((v) => ({ ...v, description: e.target.value }))}
      />
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-muted hover:bg-bg">
          {t("cancel")}
        </button>
        <button type="submit" className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white">
          {t("save")}
        </button>
      </div>
    </form>
  );
}
