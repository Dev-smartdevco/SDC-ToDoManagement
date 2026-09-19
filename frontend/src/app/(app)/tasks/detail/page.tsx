"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { TaskDetails } from "@/components/tasks/TaskDetails";
import { endpoints } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useScopedKey } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { Task } from "@/lib/types";

function TaskWorkspaceInner() {
  const id = useSearchParams().get("id") ?? "";
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = useScopedKey(["task", id]);
  const query = useQuery({ queryKey: key, queryFn: () => endpoints.task(id), enabled: Boolean(id) });
  const [message, setMessage] = useState("");
  const [minutes, setMinutes] = useState("15");
  const [fileTitle, setFileTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const task = query.data as Task | undefined;

  if (!id) return <p className="text-sm text-danger">{t("error")}</p>;
  if (query.isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (!task) return <p className="text-sm text-danger">{t("error")}</p>;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={task.title} description={task.assignees?.map((row) => row.name).join(", ")} />
      <section className="rounded-2xl border border-line bg-white p-4">
        <TaskDetails
          task={task}
          onToggleSubtask={async (subId, done) => {
            await endpoints.patchStatus(subId, done ? "DONE" : "TODO");
            refresh();
          }}
        />
        {task.status === "BLOCKED" && task.blockedReason ? (
          <p className="mt-3 text-sm text-danger">{t("blockedReason")}: {task.blockedReason}</p>
        ) : null}
        <div className="mt-3 text-sm text-muted">
          {t("actualTime")}: {task.actualMinutes ?? 0} {t("minutes")}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await endpoints.logTime(task.id, Number(minutes));
            refresh();
            toast.push(t("saved"));
          }}
        >
          <input className="w-24 rounded-xl border border-line px-3 py-2 text-sm" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          <button className="rounded-xl bg-sidebar px-3 py-2 text-sm text-white">{t("logTime")}</button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("comments")}</h2>
        <div className="space-y-3">
          {(task.comments ?? []).map((item) => (
            <div key={item.id}>
              <div className="text-xs text-muted">{item.user.name}</div>
              <p className="text-sm">{item.message}</p>
            </div>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!message.trim()) return;
            await endpoints.addComment(task.id, message.trim());
            setMessage("");
            refresh();
          }}
        >
          <input className="flex-1 rounded-xl border border-line px-3 py-2 text-sm" placeholder={t("writeComment")} value={message} onChange={(e) => setMessage(e.target.value)} />
          <button className="rounded-xl bg-sidebar px-3 py-2 text-sm text-white">{t("save")}</button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("attachments")}</h2>
        {(task.files ?? []).map((file) => (
          <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="block py-2 text-sm text-accent">
            {file.title}
          </a>
        ))}
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            await endpoints.addFile({ title: fileTitle, url: fileUrl, taskId: task.id });
            setFileTitle("");
            setFileUrl("");
            refresh();
          }}
        >
          <input className="rounded-xl border border-line px-3 py-2 text-sm" placeholder={t("title")} value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} />
          <input className="rounded-xl border border-line px-3 py-2 text-sm" placeholder={t("fileUrl")} value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
          <button className="rounded-xl bg-sidebar px-3 py-2 text-sm text-white">{t("addFile")}</button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("activity")}</h2>
        {(task.activities ?? []).map((item) => (
          <div key={item.id} className="border-t border-line py-2 text-sm">
            {item.message}
          </div>
        ))}
      </section>
    </div>
  );
}

export default function TaskWorkspacePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <TaskWorkspaceInner />
    </Suspense>
  );
}
