"use client";

import { useState } from "react";
import type { Project, Task } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { todayIso } from "@/lib/format";

const field =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30";

export function TimeBlockForm({
  projects,
  tasks,
  date,
  onSubmit,
  onCancel,
}: {
  projects: Project[];
  tasks: Task[];
  date?: string;
  onSubmit: (value: {
    title: string;
    projectId: string | null;
    taskId: string | null;
    date: string;
    startTime: string;
    endTime: string;
    notes: string;
  }) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [blockDate, setBlockDate] = useState(date ?? todayIso());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [notes, setNotes] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSubmit({
          title,
          projectId: projectId || null,
          taskId: taskId || null,
          date: blockDate,
          startTime,
          endTime,
          notes,
        });
      }}
    >
      <input autoFocus className={field} placeholder={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <input type="time" className={field} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <input type="time" className={field} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
      </div>
      <input type="date" className={field} value={blockDate} onChange={(e) => setBlockDate(e.target.value)} />
      <select className={field} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
        <option value="">{t("project")}</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select className={field} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
        <option value="">{t("task")}</option>
        {tasks.map((task) => (
          <option key={task.id} value={task.id}>
            {task.title}
          </option>
        ))}
      </select>
      <textarea className={`${field} min-h-20`} placeholder={t("description")} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-muted">
          {t("cancel")}
        </button>
        <button type="submit" className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white">
          {t("save")}
        </button>
      </div>
    </form>
  );
}
