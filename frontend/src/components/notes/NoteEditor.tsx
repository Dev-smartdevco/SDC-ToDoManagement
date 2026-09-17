"use client";

import { useEffect, useState } from "react";
import type { Note, Project, Task } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

const field =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30";

export function NoteEditor({
  note,
  projects,
  tasks,
  onSave,
  onDelete,
}: {
  note?: Note | null;
  projects: Project[];
  tasks: Task[];
  onSave: (value: { title: string; content: string; projectId: string | null; taskId: string | null; tags: string[] }) => void;
  onDelete?: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [projectId, setProjectId] = useState(note?.projectId ?? "");
  const [taskId, setTaskId] = useState(note?.taskId ?? "");
  const [tags, setTags] = useState(note?.tags.join(", ") ?? "");

  useEffect(() => {
    setTitle(note?.title ?? "");
    setContent(note?.content ?? "");
    setProjectId(note?.projectId ?? "");
    setTaskId(note?.taskId ?? "");
    setTags(note?.tags.join(", ") ?? "");
  }, [note]);

  return (
    <form
      className="flex h-full flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          title: title.trim() || t("untitled"),
          content,
          projectId: projectId || null,
          taskId: taskId || null,
          tags: tags.split(",").map((x) => x.trim()).filter(Boolean),
        });
      }}
    >
      <input
        autoFocus
        className="w-full border-0 bg-transparent text-2xl font-semibold outline-none"
        placeholder={t("title")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select className={field} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">{t("project")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select className={field} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <option value="">{t("linkedTask")}</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
        <input className={field} placeholder={t("tags")} value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      <textarea
        className="min-h-[420px] flex-1 resize-none rounded-2xl border border-line bg-white p-4 text-base leading-7 outline-none focus:ring-2 focus:ring-accent/20"
        placeholder={t("writeHere")}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex items-center justify-between">
        {onDelete ? (
          <button type="button" onClick={onDelete} className="text-sm text-danger">
            {t("delete")}
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white">
          {t("save")}
        </button>
      </div>
    </form>
  );
}
