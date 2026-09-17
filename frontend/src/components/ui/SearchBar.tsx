"use client";

import { Search } from "lucide-react";

export function SearchBar({
  value,
  onChange,
  placeholder,
  id = "global-search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  id?: string;
}) {
  return (
    <label className="relative block">
      <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-white py-2.5 ps-9 pe-3 text-sm outline-none ring-accent/30 placeholder:text-muted focus:ring-2"
      />
    </label>
  );
}
