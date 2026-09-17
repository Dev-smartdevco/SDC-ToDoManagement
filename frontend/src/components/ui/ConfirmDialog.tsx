"use client";

import { Modal } from "./Modal";
import { useI18n } from "@/lib/i18n";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  body?: string;
}) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onClose} title={title ?? t("confirmDelete")}>
      <p className="mb-5 text-sm text-muted">{body ?? t("confirmDeleteBody")}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted hover:bg-bg">
          {t("cancel")}
        </button>
        <button
          onClick={onConfirm}
          className="rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white"
        >
          {t("delete")}
        </button>
      </div>
    </Modal>
  );
}
