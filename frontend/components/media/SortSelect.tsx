"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown } from "lucide-react";

export type SortKey =
  | ""
  | "title_asc"
  | "title_desc"
  | "year_desc"
  | "year_asc"
  | "added_desc"
  | "added_asc"
  | "last_watched_desc"
  | "last_watched_asc"
  | "runtime_desc"
  | "runtime_asc"
  | "progress_desc"
  | "progress_asc";

const COMMON_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "", label: "Recently watched" },
  { value: "added_desc", label: "Recently added" },
  { value: "added_asc", label: "Oldest added" },
  { value: "title_asc", label: "Title (A–Z)" },
  { value: "title_desc", label: "Title (Z–A)" },
  { value: "year_desc", label: "Year (newest)" },
  { value: "year_asc", label: "Year (oldest)" },
  { value: "last_watched_desc", label: "Last watched (newest)" },
  { value: "last_watched_asc", label: "Last watched (oldest)" },
];

const MOVIE_OPTIONS: { value: SortKey; label: string }[] = [
  ...COMMON_OPTIONS,
  { value: "runtime_desc", label: "Runtime (longest)" },
  { value: "runtime_asc", label: "Runtime (shortest)" },
  { value: "progress_desc", label: "Most watched" },
  { value: "progress_asc", label: "Least watched" },
];

const SHOW_OPTIONS: { value: SortKey; label: string }[] = [
  ...COMMON_OPTIONS,
  { value: "progress_desc", label: "Most progress" },
  { value: "progress_asc", label: "Least progress" },
];

interface SortSelectProps {
  mediaType: "movies" | "shows";
  value: string;
  onChange: (v: string) => void;
}

export function SortSelect({ mediaType, value, onChange }: SortSelectProps) {
  const options = mediaType === "movies" ? MOVIE_OPTIONS : SHOW_OPTIONS;
  const current = options.find((o) => o.value === (value as SortKey)) ?? options[0];

  return (
    <Select
      value={value || "__default"}
      onValueChange={(v) => onChange(v === "__default" ? "" : v)}
    >
      {/* Icon-only on mobile, full label on sm+ */}
      <SelectTrigger
        className="h-11 w-11 shrink-0 sm:w-auto sm:min-w-[170px]"
        title={`Sort: ${current.label}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ArrowUpDown className="h-4 w-4 shrink-0 text-white/40" />
          <SelectValue>
            <span className="hidden sm:block truncate">{current.label}</span>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent align="end" collisionPadding={8} className="max-w-[220px]">
        {options.map((o) => (
          <SelectItem key={o.value || "__default"} value={o.value || "__default"}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
