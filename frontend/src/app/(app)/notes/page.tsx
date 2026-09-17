"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterBar, Select } from "@/components/ui/FilterBar";
import { NoteList } from "@/components/notes/NoteList";
import { endpoints } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useScopedKey } from "@/lib/auth";

export default function NotesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [projectId, setProjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tag, setTag] = useState("");
  const search = useDebouncedValue(q, 250);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (projectId) p.set("projectId", projectId);
    if (categoryId) p.set("categoryId", categoryId);
    if (tag) p.set("tag", tag);
    return p.toString();
  }, [search, projectId, categoryId, tag]);

  const notesQuery = useQuery({ queryKey: useScopedKey(["notes", params]), queryFn: () => endpoints.notes(params) });
  const projectsQuery = useQuery({ queryKey: useScopedKey(["projects"]), queryFn: endpoints.projects });
  const categoriesQuery = useQuery({
    queryKey: useScopedKey(["categories", projectId]),
    queryFn: () => endpoints.projectCategories(projectId),
    enabled: Boolean(projectId),
  });
  const tags = Array.from(new Set((notesQuery.data ?? []).flatMap((n) => n.tags)));

  return (
    <div>
      <PageHeader
        title={t("notes")}
        actions={
          <button
            onClick={async () => {
              const note = await endpoints.createNote({ title: t("untitled"), content: "" }) as { id: string };
              router.push(`/notes/detail?id=${note.id}`);
            }}
            className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white"
          >
            {t("newNote")}
          </button>
        }
      />
      <div className="mb-4 space-y-3">
        <SearchBar value={q} onChange={setQ} placeholder={t("searchNotes")} />
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
          <Select value={tag} onChange={setTag}>
            <option value="">{t("tags")}</option>
            {tags.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </FilterBar>
      </div>
      {notesQuery.isLoading ? <p className="text-sm text-muted">{t("loading")}</p> : null}
      {notesQuery.isError ? <p className="text-sm text-danger">{t("error")}</p> : null}
      {notesQuery.data ? <NoteList notes={notesQuery.data} onOpen={(note) => router.push(`/notes/detail?id=${note.id}`)} /> : null}
    </div>
  );
}
