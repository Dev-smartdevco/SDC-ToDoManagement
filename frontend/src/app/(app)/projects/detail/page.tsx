"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TaskList } from "@/components/tasks/TaskList";
import { NoteList } from "@/components/notes/NoteList";
import { Modal } from "@/components/ui/Modal";
import { CategoryForm, type CategoryFormValue } from "@/components/categories/CategoryForm";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { endpoints, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import { useScopedKey } from "@/lib/auth";
import type { Category, Task } from "@/lib/types";

function ProjectDetailsInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const selectedCategoryId = searchParams.get("categoryId") ?? "";
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const projectKey = useScopedKey(["project", id]);
  const query = useQuery({
    queryKey: projectKey,
    queryFn: () => endpoints.project(id),
    enabled: Boolean(id),
  });
  const project = query.data;
  const selectedCategory = project?.categories.find((c) => c.id === selectedCategoryId) ?? null;

  const [categoryForm, setCategoryForm] = useState<Partial<Category> | "new" | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [taskCount, setTaskCount] = useState(0);

  const filterByCategory = (tasks: Task[]) =>
    selectedCategoryId ? tasks.filter((task) => task.categoryId === selectedCategoryId) : tasks;

  const notes = useMemo(
    () => (selectedCategoryId ? (project?.notes ?? []).filter((n) => n.categoryId === selectedCategoryId) : project?.notes ?? []),
    [project?.notes, selectedCategoryId],
  );

  function goCategory(categoryId: string) {
    const params = new URLSearchParams({ id });
    if (categoryId) params.set("categoryId", categoryId);
    router.push(`/projects/detail?${params.toString()}`);
  }

  async function saveCategory(value: CategoryFormValue) {
    const body = {
      name: value.name,
      description: value.description || null,
      icon: value.icon,
      color: value.color,
      sortOrder: Number(value.sortOrder || 0),
      projectId: id,
    };
    if (categoryForm && categoryForm !== "new" && categoryForm.id) {
      await endpoints.updateCategory(categoryForm.id, body);
    } else {
      await endpoints.createCategory(body);
    }
    setCategoryForm(null);
    queryClient.invalidateQueries({ queryKey: projectKey });
    toast.push(t("saved"));
  }

  async function tryDelete(category: Category) {
    try {
      await endpoints.deleteCategory(category.id);
      setDeleting(null);
      if (selectedCategoryId === category.id) goCategory("");
      queryClient.invalidateQueries({ queryKey: projectKey });
      toast.push(t("deleted"));
    } catch (error) {
      if (error instanceof ApiError && error.code === "CATEGORY_HAS_TASKS") {
        setDeleting(category);
        setTaskCount(Number((error.details as { taskCount?: number } | undefined)?.taskCount ?? category.taskCount ?? 0));
        setMoveTo("");
        return;
      }
      toast.push(error instanceof Error ? error.message : t("error"), "error");
    }
  }

  if (!id) return <p className="text-sm text-danger">{t("error")}</p>;
  if (query.isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (query.isError || !project) return <p className="text-sm text-danger">{t("error")}</p>;

  return (
    <div className="space-y-8">
      <PageHeader
        title={selectedCategory ? `${project.name}` : project.name}
        description={selectedCategory ? selectedCategory.name : project.description ?? undefined}
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("categories")}</h2>
          <button onClick={() => setCategoryForm("new")} className="text-sm font-medium text-accent">
            {t("addCategory")}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => goCategory("")}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              !selectedCategoryId ? "bg-sidebar text-white" : "bg-white text-muted"
            }`}
          >
            {t("all")}
          </button>
          {(project.categories ?? []).map((category) => (
            <button
              key={category.id}
              onClick={() => goCategory(category.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                selectedCategoryId === category.id ? "bg-sidebar text-white" : "bg-white text-muted"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
        {!selectedCategoryId ? (
          <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
            {(project.categories ?? []).map((category) => (
              <div key={category.id} className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => goCategory(category.id)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bg" style={{ color: category.color }}>
                    <CategoryIcon name={category.icon} color={category.color} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{category.name}</div>
                    <div className="text-xs text-muted">
                      {category.taskCount ?? 0} {t("tasks")} · {category.completedTasks ?? 0} {t("completed")}
                    </div>
                  </div>
                </button>
                <div className="flex gap-2 text-xs">
                  <button className="text-muted hover:text-ink" onClick={() => setCategoryForm(category)}>
                    {t("edit")}
                  </button>
                  <button
                    className="text-muted hover:text-ink"
                    onClick={async () => {
                      await endpoints.updateCategory(category.id, { archived: true });
                      queryClient.invalidateQueries({ queryKey: projectKey });
                      toast.push(t("archived"));
                    }}
                  >
                    {t("archive")}
                  </button>
                  <button className="text-danger" onClick={() => tryDelete(category)}>
                    {t("delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-danger">{t("overdue")}</h2>
        <div className="rounded-2xl border border-line bg-white px-4">
          <TaskList
            tasks={filterByCategory(project.overdueTasks)}
            onToggle={async (task) => {
              await endpoints.patchStatus(task.id, task.status === "DONE" ? "TODO" : "DONE");
              queryClient.invalidateQueries({ queryKey: projectKey });
            }}
            onEdit={() => router.push("/tasks")}
            onDelete={async (task) => {
              await endpoints.deleteTask(task.id);
              queryClient.invalidateQueries({ queryKey: projectKey });
            }}
          />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("openTasks")}</h2>
        <div className="rounded-2xl border border-line bg-white px-4">
          <TaskList
            tasks={filterByCategory(project.openTasks)}
            onToggle={async (task) => {
              await endpoints.patchStatus(task.id, task.status === "DONE" ? "TODO" : "DONE");
              queryClient.invalidateQueries({ queryKey: projectKey });
            }}
            onEdit={() => router.push("/tasks")}
            onDelete={async (task) => {
              await endpoints.deleteTask(task.id);
              queryClient.invalidateQueries({ queryKey: projectKey });
            }}
          />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("upcomingTasks")}</h2>
        <div className="rounded-2xl border border-line bg-white px-4">
          <TaskList
            tasks={filterByCategory(project.upcomingTasks)}
            onToggle={async (task) => {
              await endpoints.patchStatus(task.id, task.status === "DONE" ? "TODO" : "DONE");
              queryClient.invalidateQueries({ queryKey: projectKey });
            }}
            onEdit={() => router.push("/tasks")}
            onDelete={async (task) => {
              await endpoints.deleteTask(task.id);
              queryClient.invalidateQueries({ queryKey: projectKey });
            }}
          />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("completedTasks")}</h2>
        <div className="rounded-2xl border border-line bg-white px-4">
          <TaskList
            tasks={filterByCategory(project.completedTasks)}
            onToggle={async (task) => {
              await endpoints.patchStatus(task.id, "TODO");
              queryClient.invalidateQueries({ queryKey: projectKey });
            }}
            onEdit={() => router.push("/tasks")}
            onDelete={async (task) => {
              await endpoints.deleteTask(task.id);
              queryClient.invalidateQueries({ queryKey: projectKey });
            }}
          />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("notes")}</h2>
        <NoteList notes={notes} onOpen={(note) => router.push(`/notes/detail?id=${note.id}`)} />
      </section>

      <Modal
        open={Boolean(categoryForm)}
        title={categoryForm && categoryForm !== "new" ? t("editCategory") : t("addCategory")}
        onClose={() => setCategoryForm(null)}
      >
        <CategoryForm
          category={categoryForm && categoryForm !== "new" ? categoryForm : null}
          onCancel={() => setCategoryForm(null)}
          onSubmit={saveCategory}
        />
      </Modal>
      <Modal open={Boolean(deleting)} title={t("deleteCategory")} onClose={() => setDeleting(null)}>
        <p className="text-sm text-muted">
          {t("categoryHasTasks", { count: taskCount })}
        </p>
        <select
          className="mt-3 w-full rounded-xl border border-line px-3 py-2.5 text-sm"
          value={moveTo}
          onChange={(e) => setMoveTo(e.target.value)}
        >
          <option value="">{t("removeCategoryAssignment")}</option>
          {(project.categories ?? [])
            .filter((c) => c.id !== deleting?.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {t("moveTasksTo")} {c.name}
              </option>
            ))}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setDeleting(null)} className="rounded-xl px-4 py-2 text-sm text-muted">
            {t("cancel")}
          </button>
          <button
            className="rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white"
            onClick={async () => {
              if (!deleting) return;
              await endpoints.deleteCategory(deleting.id, moveTo ? { moveToCategoryId: moveTo } : { unassign: true });
              setDeleting(null);
              if (selectedCategoryId === deleting.id) goCategory("");
              queryClient.invalidateQueries({ queryKey: projectKey });
              toast.push(t("deleted"));
            }}
          >
            {t("delete")}
          </button>
        </div>
      </Modal>
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
