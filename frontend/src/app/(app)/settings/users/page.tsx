"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterBar, Select } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { endpoints } from "@/lib/api";
import { useAuth, useScopedKey } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import { isAdminRole } from "@/lib/nav";
import type { ManagedUser, UserRole } from "@/lib/types";

const emptyForm = { name: "", email: "", role: "MEMBER" as UserRole };

export default function UsersSettingsPage() {
  const { t } = useI18n();
  const { user: current } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [details, setDetails] = useState<ManagedUser | null>(null);
  const [temp, setTemp] = useState("");
  const [form, setForm] = useState(emptyForm);
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (role) p.set("role", role);
    if (active) p.set("active", active);
    return p.toString();
  }, [q, role, active]);
  const key = useScopedKey(["users", params]);
  const query = useQuery({ queryKey: key, queryFn: () => endpoints.users(params), enabled: isAdminRole(current?.role) });
  const users = (query.data ?? []) as ManagedUser[];

  if (!isAdminRole(current?.role)) {
    return <p className="text-sm text-danger">{t("error")}</p>;
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("users")}
        actions={
          <button
            onClick={() => {
              setForm(emptyForm);
              setOpen(true);
            }}
            className="rounded-xl bg-sidebar px-4 py-2 text-sm text-white"
          >
            {t("addUser")}
          </button>
        }
      />
      <FilterBar>
        <SearchBar value={q} onChange={setQ} placeholder={t("search")} />
        <Select value={role} onChange={setRole}>
          <option value="">{t("role")}</option>
          <option value="SUPER_ADMIN">SUPER ADMIN</option>
          <option value="ADMIN">ADMIN</option>
          <option value="MEMBER">MEMBER</option>
          <option value="VIEWER">VIEWER</option>
        </Select>
        <Select value={active} onChange={setActive}>
          <option value="">{t("status")}</option>
          <option value="true">{t("active")}</option>
          <option value="false">{t("inactive")}</option>
        </Select>
      </FilterBar>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="min-w-full text-sm">
          <thead className="text-start text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">{t("name")}</th>
              <th className="px-4 py-3">{t("email")}</th>
              <th className="px-4 py-3">{t("role")}</th>
              <th className="px-4 py-3">{t("status")}</th>
              <th className="px-4 py-3">{t("created")}</th>
              <th className="px-4 py-3">{t("lastLogin")}</th>
              <th className="px-4 py-3">{t("activeTasks")}</th>
              <th className="px-4 py-3">{t("completedTasks")}</th>
              <th className="px-4 py-3">{t("projects")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-line">
                <td className="px-4 py-3">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{user.role}</td>
                <td className="px-4 py-3">{user.isActive ? t("active") : t("inactive")}</td>
                <td className="px-4 py-3">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3">{user.activeTasks}</td>
                <td className="px-4 py-3">{user.completedTasks}</td>
                <td className="px-4 py-3">{user.projectsCount}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button className="text-xs text-accent" onClick={() => setDetails(user)}>
                      {t("userDetails")}
                    </button>
                    <button
                      className="text-xs text-accent"
                      onClick={() => {
                        setEditing(user);
                        setForm({ name: user.name, email: user.email, role: user.role });
                      }}
                    >
                      {t("editUser")}
                    </button>
                    <button
                      className="text-xs text-accent"
                      onClick={async () => {
                        if (user.isActive) await endpoints.deactivateUser(user.id);
                        else await endpoints.activateUser(user.id);
                        refresh();
                      }}
                    >
                      {user.isActive ? t("deactivate") : t("activate")}
                    </button>
                    <button
                      className="text-xs text-accent"
                      onClick={async () => {
                        const result = await endpoints.resetPassword(user.id);
                        setTemp(result.temporaryPassword);
                        toast.push(t("temporaryPassword"));
                      }}
                    >
                      {t("resetPassword")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {temp ? (
        <p className="rounded-xl bg-bg px-3 py-2 text-sm">
          {t("temporaryPassword")}: {temp}
        </p>
      ) : null}

      <Modal
        open={open}
        title={t("addUser")}
        onClose={() => setOpen(false)}
      >
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const created = await endpoints.createUser(form);
            setOpen(false);
            setForm(emptyForm);
            if (created.temporaryPassword) setTemp(created.temporaryPassword);
            refresh();
            toast.push(t("created"));
          }}
        >
          <input className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" placeholder={t("name")} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
          <input className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" placeholder={t("email")} value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
          <select className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" value={form.role} onChange={(e) => setForm((v) => ({ ...v, role: e.target.value as UserRole }))}>
            <option value="ADMIN">ADMIN</option>
            <option value="MEMBER">MEMBER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          <button className="rounded-xl bg-sidebar px-4 py-2 text-sm text-white">{t("save")}</button>
        </form>
      </Modal>

      <Modal open={Boolean(editing)} title={t("editUser")} onClose={() => setEditing(null)}>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editing) return;
            await endpoints.updateUser(editing.id, form);
            setEditing(null);
            refresh();
            toast.push(t("saved"));
          }}
        >
          <input className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" placeholder={t("name")} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
          <input className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" placeholder={t("email")} value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
          <select className="w-full rounded-xl border border-line px-3 py-2.5 text-sm" value={form.role} onChange={(e) => setForm((v) => ({ ...v, role: e.target.value as UserRole }))}>
            <option value="SUPER_ADMIN">SUPER ADMIN</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MEMBER">MEMBER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          <button className="rounded-xl bg-sidebar px-4 py-2 text-sm text-white">{t("save")}</button>
        </form>
      </Modal>

      <Modal open={Boolean(details)} title={t("userDetails")} onClose={() => setDetails(null)}>
        {details ? (
          <div className="space-y-2 text-sm">
            <p>{details.name}</p>
            <p className="text-muted">{details.email}</p>
            <p>
              {t("role")}: {details.role}
            </p>
            <p>
              {t("status")}: {details.isActive ? t("active") : t("inactive")}
            </p>
            <p>
              {t("created")}: {new Date(details.createdAt).toLocaleDateString()}
            </p>
            <p>
              {t("lastLogin")}: {details.lastLoginAt ? new Date(details.lastLoginAt).toLocaleString() : "—"}
            </p>
            <p>
              {t("level")} {details.level} · {details.xp} {t("xp")}
            </p>
            <p>
              {t("activeTasks")}: {details.activeTasks} · {t("completedTasks")}: {details.completedTasks} · {t("projects")}: {details.projectsCount}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
