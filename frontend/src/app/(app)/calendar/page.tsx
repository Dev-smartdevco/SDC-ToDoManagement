"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, Select } from "@/components/ui/FilterBar";
import { endpoints } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useScopedKey } from "@/lib/auth";
import { addDaysIso, todayIso } from "@/lib/format";

type CalTask = {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
  project?: { name: string; color: string } | null;
  kind: "task";
};
type CalMeeting = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  kind: "meeting";
};

export default function CalendarPage() {
  const { t } = useI18n();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [status, setStatus] = useState("");
  const [projectId, setProjectId] = useState("");
  const [memberId, setMemberId] = useState("");
  const from = todayIso();
  const to = addDaysIso(from, 21);
  const params = useMemo(() => {
    const p = new URLSearchParams({ from, to, scope });
    if (status) p.set("status", status);
    if (projectId) p.set("projectId", projectId);
    if (memberId) p.set("memberId", memberId);
    return p.toString();
  }, [from, to, scope, status, projectId, memberId]);
  const projects = useQuery({ queryKey: useScopedKey(["projects"]), queryFn: endpoints.projects, staleTime: 5 * 60_000 });
  const directory = useQuery({
    queryKey: useScopedKey(["directory"]),
    queryFn: endpoints.directory,
    staleTime: 5 * 60_000,
    enabled: scope === "team",
  });
  const query = useQuery({
    queryKey: useScopedKey(["calendar", params]),
    queryFn: () => endpoints.calendar(params) as Promise<{ tasks: CalTask[]; meetings: CalMeeting[] }>,
    staleTime: 60_000,
  });
  const tasks = query.data?.tasks ?? [];
  const meetings = query.data?.meetings ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("calendar")} />
      <FilterBar>
        <Select value={scope} onChange={(value) => setScope(value as "mine" | "team")}>
          <option value="mine">{t("myCalendar")}</option>
          <option value="team">{t("teamCalendar")}</option>
        </Select>
        <Select value={status} onChange={setStatus}>
          <option value="">{t("status")}</option>
          <option value="TODO">TODO</option>
          <option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="DONE">DONE</option>
        </Select>
        <Select value={projectId} onChange={setProjectId}>
          <option value="">{t("allProjects")}</option>
          {(projects.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <Select value={memberId} onChange={setMemberId}>
          <option value="">{t("members")}</option>
          {(directory.data ?? []).map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </Select>
      </FilterBar>
      <section className="rounded-2xl border border-line bg-white px-4">
        <h2 className="pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("tasks")}</h2>
        {(tasks.length ? tasks : []).map((item) => (
          <div key={item.id} className="flex items-center justify-between border-t border-line py-3 text-sm">
            <div>
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-muted">{item.dueDate} · {item.status}</div>
            </div>
            <span className="text-xs text-muted">{item.project?.name}</span>
          </div>
        ))}
        {!tasks.length ? <p className="py-6 text-sm text-muted">{t("noTasks")}</p> : null}
      </section>
      <section className="rounded-2xl border border-line bg-white px-4">
        <h2 className="pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("timeBlocks")}</h2>
        {meetings.map((item) => (
          <div key={item.id} className="border-t border-line py-3 text-sm">
            <div className="font-medium">{item.title}</div>
            <div className="text-xs text-muted">
              {item.date} · {item.startTime} — {item.endTime}
            </div>
          </div>
        ))}
        {!meetings.length ? <p className="py-6 text-sm text-muted">{t("emptyBlocks")}</p> : null}
      </section>
    </div>
  );
}
