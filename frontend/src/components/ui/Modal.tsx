"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-6">
      <button className="absolute inset-0" aria-label={t("close")} onClick={onClose} />
      <div
        className={`relative max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-white p-5 shadow-soft md:rounded-2xl ${
          wide ? "md:max-w-2xl" : "md:max-w-lg"
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-bg"
            aria-label={t("close")}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
