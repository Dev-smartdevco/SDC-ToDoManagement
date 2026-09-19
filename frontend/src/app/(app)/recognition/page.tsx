"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApiError, endpoints } from "@/lib/api";
import { useAuth, useScopedKey } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import { isAdminRole } from "@/lib/nav";
import type { RecognitionPost } from "@/lib/types";

export default function RecognitionPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = useScopedKey(["recognition"]);
  const query = useQuery({ queryKey: key, queryFn: endpoints.recognition, staleTime: 60_000 });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const directory = useQuery({
    queryKey: useScopedKey(["directory"]),
    queryFn: endpoints.directory,
    staleTime: 5 * 60_000,
    enabled: open,
  });
  const [recipientId, setRecipientId] = useState("");
  const [message, setMessage] = useState("");
  const items = (query.data ?? []) as RecognitionPost[];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("recognition")}
        actions={
          isAdminRole(user?.role) ? (
            <button onClick={() => setOpen(true)} className="rounded-xl bg-sidebar px-4 py-2 text-sm text-white">
              {t("quickAdd")}
            </button>
          ) : null
        }
      />
      {!items.length ? (
        <EmptyState title={t("noResults")} />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              <div className="flex gap-3 border-b border-line/70 bg-gradient-to-r from-accent/5 to-transparent px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-white">
                  <Award size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{item.recipient.name}</span>
                    <Sparkles size={14} className="text-accent" />
                  </div>
                  <div className="text-[11px] text-muted">
                    {item.author.name} · {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <p className="whitespace-pre-wrap px-4 py-4 text-sm leading-relaxed">{item.message}</p>
            </article>
          ))}
        </div>
      )}
      <Modal open={open} title={t("recognition")} onClose={() => setOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!recipientId || !message.trim()) {
              toast.push(t("error"), "error");
              return;
            }
            setSaving(true);
            try {
              await endpoints.createRecognition({ recipientId, message: message.trim() });
              setOpen(false);
              setMessage("");
              setRecipientId("");
              await queryClient.invalidateQueries({ queryKey: key });
              toast.push(t("created"));
            } catch (error) {
              toast.push(error instanceof ApiError ? error.message : t("error"), "error");
            } finally {
              setSaving(false);
            }
          }}
        >
          <select
            className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            required
          >
            <option value="">{t("users")}</option>
            {(directory.data ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <textarea
            required
            className="min-h-24 w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("writeComment")}
          />
          <button disabled={saving} className="rounded-xl bg-sidebar px-4 py-2 text-sm text-white disabled:opacity-60">
            {saving ? t("loading") : t("save")}
          </button>
        </form>
      </Modal>
    </div>
  );
}
