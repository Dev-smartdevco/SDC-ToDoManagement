"use client";

import { useEffect, useState } from "react";
import type { Category } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { CategoryIcon, CATEGORY_ICON_OPTIONS } from "@/components/ui/CategoryIcon";
import { PROJECT_COLORS } from "@/lib/format";

const field =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30";

export type CategoryFormValue = {
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: string;
};

export function CategoryForm({
  category,
  onSubmit,
  onCancel,
}: {
  category?: Partial<Category> | null;
  onSubmit: (value: CategoryFormValue) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState<CategoryFormValue>({
    name: category?.name ?? "",
    description: category?.description ?? "",
    icon: category?.icon ?? "folder",
    color: category?.color ?? "#64748B",
    sortOrder: category?.sortOrder != null ? String(category.sortOrder) : "0",
  });

  useEffect(() => {
    setValue({
      name: category?.name ?? "",
      description: category?.description ?? "",
      icon: category?.icon ?? "folder",
      color: category?.color ?? "#64748B",
      sortOrder: category?.sortOrder != null ? String(category.sortOrder) : "0",
    });
  }, [category]);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.name.trim()) return;
        onSubmit(value);
      }}
    >
      <input
        autoFocus
        className={field}
        placeholder={t("name")}
        value={value.name}
        onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))}
      />
      <textarea
        className={`${field} min-h-20`}
        placeholder={t("description")}
        value={value.description}
        onChange={(e) => setValue((v) => ({ ...v, description: e.target.value }))}
      />
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("icon")}</div>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_ICON_OPTIONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => setValue((v) => ({ ...v, icon }))}
              className={`rounded-xl border p-2 ${value.icon === icon ? "border-sidebar bg-bg" : "border-line"}`}
              aria-label={icon}
            >
              <CategoryIcon name={icon} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t("color")}</div>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setValue((v) => ({ ...v, color }))}
              className="h-7 w-7 rounded-full border border-white shadow"
              style={{ background: color, outline: value.color === color ? "2px solid #132033" : undefined }}
            />
          ))}
        </div>
      </div>
      <input
        className={field}
        placeholder={t("sortOrder")}
        value={value.sortOrder}
        onChange={(e) => setValue((v) => ({ ...v, sortOrder: e.target.value }))}
      />
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-muted hover:bg-bg">
          {t("cancel")}
        </button>
        <button type="submit" className="rounded-xl bg-sidebar px-4 py-2 text-sm font-medium text-white">
          {t("save")}
        </button>
      </div>
    </form>
  );
}
