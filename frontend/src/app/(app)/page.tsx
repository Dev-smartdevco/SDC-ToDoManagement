"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FocusTimer } from "@/components/focus/FocusTimer";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskForm, taskPayload, type TaskFormValue } from "@/components/tasks/TaskForm";
import { TimeBlockList } from "@/components/timeblocks/TimeBlockList";
import { TimeBlockForm } from "@/components/timeblocks/TimeBlockForm";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { endpoints } from "@/lib/api";
import { formatLongDate, greetingKey, isTypingTarget, progressBar, todayIso } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import { useScopedKey } from "@/lib/auth";
import { keepPreviousData } from "@/lib/query";
import type { Task } from "@/lib/types";

export default function TodayPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const date = todayIso();
  const [capture, setCapture] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);

  const todayKey = useScopedKey(["today", date]);
  const projectsKey = useScopedKey(["projects"]);
  const tasksKey = useScopedKey(["tasks"]);

  const todayQuery = useQuery({
    queryKey: todayKey,
    queryFn: () => endpoints.today(date),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  const projectsQuery = useQuery({ queryKey: projectsKey, queryFn: endpoints.projects, staleTime: 5 * 60_000 });
  const data = todayQuery.data;
  const greeting = t(greetingKey());

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: todayKey });
    void queryClient.invalidateQueries({ queryKey: tasksKey });
  };

  const toggle = useMutation({
    mutationFn: (task: Task) => endpoints.patchStatus(task.id, task.status === "DONE" ? "TODO" : "DONE"),
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: todayKey });
      const previous = queryClient.getQueryData(todayKey);
      queryClient.setQueryData(todayKey, (old: typeof data) => {
        if (!old) return old;
        const flip = (list: Task[]) =>
          list.map((item) => (item.id === task.id ? { ...item, status: item.status === "DONE" ? "TODO" : "DONE" } : item));
        return {
          ...old,
          todayTasks: {
            default: flip(old.todayTasks.default ?? []),
            high: flip(old.todayTasks.high),
            normal: flip(old.todayTasks.normal),
            low: flip(old.todayTasks.low),
          },
        };
      });
      return { previous };
    },
    onError: (_err, _task, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(todayKey, ctx.previous);
      toast.push(t("error"), "error");
    },
    onSettled: invalidate,
  });

  const saveTask = useMutation({
    mutationFn: async (value: TaskFormValue) => {
      const body = taskPayload(value);
      if (editing) return endpoints.updateTask(editing.id, body);
      return endpoints.createTask(body);
    },
    onSuccess: () => {
      setEditing(null);
      invalidate();
      toast.push(t("saved"));
    },
    onError: () => toast.push(t("error"), "error"),
  });

  const removeTask = useMutation({
    mutationFn: (id: string) => endpoints.deleteTask(id),
    onSuccess: () => {
      setDeleting(null);
      invalidate();
      toast.push(t("deleted"));
    },
  });

  const postpone = useMutation({
    mutationFn: (task: Task) => endpoints.postponeTask(task.id),
    onSuccess: invalidate,
  });

  const startFocus = useMutation({
    mutationFn: (taskId: string) => endpoints.startFocus(taskId),
    onSuccess: invalidate,
  });
  const pauseFocus = useMutation({
    mutationFn: (id: string) => endpoints.pauseFocus(id),
    onSuccess: invalidate,
  });
  const resumeFocus = useMutation({
    mutationFn: (id: string) => endpoints.resumeFocus(id),
    onSuccess: invalidate,
  });
  const completeFocus = useMutation({
    mutationFn: (id: string) => endpoints.completeFocus(id, true),
    onSuccess: invalidate,
  });
  const cancelFocus = useMutation({
    mutationFn: (id: string) => endpoints.cancelFocus(id),
    onSuccess: invalidate,
  });

  const session = data?.activeFocus ?? null;
  const focusTask = data?.currentFocus ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.key !== " ") return;
      if (!session) return;
      e.preventDefault();
      if (session.status === "RUNNING") pauseFocus.mutate(session.id);
      if (session.status === "PAUSED") resumeFocus.mutate(session.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, pauseFocus, resumeFocus]);

  const groups = useMemo(() => {
    const defaultItems = data?.todayTasks.default ?? [];
    const defaultName = defaultItems[0]?.project?.name;
    return [
      defaultItems.length
        ? { label: defaultName ? `${t("defaultProject")}: ${defaultName}` : t("defaultProject"), items: defaultItems }
        : null,
      { label: t("highPriority"), items: data?.todayTasks.high ?? [] },
      { label: t("normal"), items: data?.todayTasks.normal ?? [] },
      { label: t("low"), items: data?.todayTasks.low ?? [] },
    ].filter((group): group is { label: string; items: Task[] } => Boolean(group?.items.length));
  }, [data, t]);

  const allToday = [
    ...(data?.todayTasks.default ?? []),
    ...(data?.todayTasks.high ?? []),
    ...(data?.todayTasks.normal ?? []),
    ...(data?.todayTasks.low ?? []),
  ];

  if (todayQuery.isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (todayQuery.isError) return <p className="text-sm text-danger">{t("error")}</p>;
  if (!data) return <EmptyState title={t("emptyToday")} />;

  const progress = Number.isFinite(data.progress) ? data.progress : 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted">{formatLongDate(data.date, locale)}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{greeting}</h1>
        </div>
        <div className="min-w-[220px]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("dailyProgress")}</div>
          <div className="progress-track mt-2 text-lg text-accent">{progressBar(progress)}</div>
          <div className="mt-1 text-sm text-muted">
            {t("completedOfPlanned", { completed: data.completedCount, planned: data.plannedCount })} · {progress}%
          </div>
        </div>
      </header>

      <section>
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{t("now")}</div>
        <FocusTimer
          task={focusTask}
          session={session}
          onStart={() => focusTask && startFocus.mutate(focusTask.id)}
          onPause={() => session && pauseFocus.mutate(session.id)}
          onResume={() => session && resumeFocus.mutate(session.id)}
          onComplete={() => {
            if (session) completeFocus.mutate(session.id);
            else if (focusTask) toggle.mutate({ ...focusTask, status: "TODO" });
          }}
          onCancel={() => session && cancelFocus.mutate(session.id)}
          onSnooze={() => focusTask && postpone.mutate(focusTask)}
        />
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{t("todaysTasks")}</h2>
        {allToday.length === 0 ? (
          <EmptyState title={t("emptyToday")} />
        ) : (
          <div className="space-y-5 rounded-2xl border border-line bg-white px-4">
            {groups.map((group) =>
              group.items.length ? (
                <div key={group.label} className="py-2">
                  <div className="pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{group.label}</div>
                  <TaskList
                    tasks={group.items}
                    onToggle={(task) => toggle.mutate(task)}
                    onEdit={setEditing}
                    onDelete={setDeleting}
                    onPostpone={(task) => postpone.mutate(task)}
                    onDuplicate={async (task) => {
                      await endpoints.duplicateTask(task.id);
                      invalidate();
                    }}
                    onReorder={(ids) => endpoints.reorderTasks(ids).then(() => invalidate())}
                  />
                </div>
              ) : null,
            )}
          </div>
        )}
      </section>

      <TimeBlockList
        blocks={data.timeBlocks}
        onAdd={() => setBlockOpen(true)}
        onDelete={async (id) => {
          await endpoints.deleteTimeBlock(id);
          invalidate();
        }}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-danger">⚠ {t("overdue")}</h2>
          {data.overdueCount ? (
            <span className="text-sm text-muted">{t("overdueCount", { count: data.overdueCount })}</span>
          ) : null}
        </div>
        <div className="rounded-2xl border border-line bg-white px-4">
          <TaskList
            tasks={data.overdue}
            empty={t("emptyOverdue")}
            onToggle={(task) => toggle.mutate(task)}
            onEdit={setEditing}
            onDelete={setDeleting}
            onPostpone={(task) => postpone.mutate(task)}
            onReorder={(ids) => endpoints.reorderTasks(ids).then(() => invalidate())}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{t("later")}</h2>
        <div className="rounded-2xl border border-line bg-white px-4">
          <TaskList
            tasks={data.later}
            empty={t("emptyLater")}
            onToggle={(task) => toggle.mutate(task)}
            onEdit={setEditing}
            onDelete={setDeleting}
            onPostpone={(task) => postpone.mutate(task)}
            onReorder={(ids) => endpoints.reorderTasks(ids).then(() => invalidate())}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{t("quickCapture")}</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!capture.trim()) return;
            await endpoints.capture(capture.trim());
            setCapture("");
            toast.push(t("inboxHint"));
            invalidate();
          }}
        >
          <input
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            placeholder={t("typeAnything")}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />
        </form>
      </section>

      <Modal open={Boolean(editing)} title={t("edit")} onClose={() => setEditing(null)}>
        <TaskForm
          task={editing}
          projects={projectsQuery.data ?? []}
          onCancel={() => setEditing(null)}
          onSubmit={(value) => saveTask.mutate(value)}
          onToggleSubtask={async (id, done) => {
            await endpoints.patchStatus(id, done ? "DONE" : "TODO");
            invalidate();
          }}
        />
      </Modal>
      <Modal open={blockOpen} title={t("addTimeBlock")} onClose={() => setBlockOpen(false)}>
        <TimeBlockForm
          projects={projectsQuery.data ?? []}
          tasks={allToday}
          date={date}
          onCancel={() => setBlockOpen(false)}
          onSubmit={async (value) => {
            await endpoints.createTimeBlock(value);
            setBlockOpen(false);
            invalidate();
          }}
        />
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && removeTask.mutate(deleting.id)}
      />
    </div>
  );
}
