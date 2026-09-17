"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Priority, Project, Task, TaskStatus } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { endpoints } from "@/lib/api";
import { useScopedKey } from "@/lib/auth";

const field =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30";

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
  tags: string;
};

export function TaskForm({
  task,
  projects,
  onSubmit,
  onCancel,
  autoFocus,
}: {
  task?: Partial<Task> | null;
  projects: Project[];
  onSubmit: (value: TaskFormValue) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState<TaskFormValue>({
    title: task?.title ?? "",
    projectId: task?.projectId ?? "",
    categoryId: task?.categoryId ?? "",
    priority: task?.priority ?? "MEDIUM",
    status: task?.status ?? "TODO",
    dueDate: task?.dueDate ?? "",
    dueTime: task?.dueTime ?? "",
    estimatedMinutes: task?.estimatedMinutes ? String(task.estimatedMinutes) : "",
    description: task?.description ?? "",
    tags: task?.tags?.map((tag) => tag.name).join(", ") ?? "",
  });

  useEffect(() => {
    setValue({
      title: task?.title ?? "",
      projectId: task?.projectId ?? "",
      categoryId: task?.categoryId ?? "",
      priority: task?.priority ?? "MEDIUM",
      status: task?.status ?? "TODO",
      dueDate: task?.dueDate ?? "",
      dueTime: task?.dueTime ?? "",
      estimatedMinutes: task?.estimatedMinutes ? String(task.estimatedMinutes) : "",
      description: task?.description ?? "",
      tags: task?.tags?.map((tag) => tag.name).join(", ") ?? "",
    });
  }, [task]);

  const categoriesQuery = useQuery({
    queryKey: useScopedKey(["categories", value.projectId]),
    queryFn: () => endpoints.projectCategories(value.projectId),
    enabled: Boolean(value.projectId),
  });
  const categories = categoriesQuery.data ?? [];

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
              {p.name}
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
          <option value="DONE">DONE</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>
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
      <input
        className={field}
        placeholder={t("tags")}
        value={value.tags}
        onChange={(e) => setValue((v) => ({ ...v, tags: e.target.value }))}
      />
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
