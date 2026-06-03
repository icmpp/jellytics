"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { value: "", label: "recently_watched" },
  { value: "added_desc", label: "recently_added" },
  { value: "added_asc", label: "oldest_added" },
  { value: "title_asc", label: "title_asc" },
  { value: "title_desc", label: "title_desc" },
  { value: "year_desc", label: "year_desc" },
  { value: "year_asc", label: "year_asc" },
  { value: "last_watched_desc", label: "last_watched_desc" },
  { value: "last_watched_asc", label: "last_watched_asc" },
];

const MOVIE_OPTIONS: { value: SortKey; label: string }[] = [
  ...COMMON_OPTIONS,
  { value: "runtime_desc", label: "runtime_desc" },
  { value: "runtime_asc", label: "runtime_asc" },
  { value: "progress_desc", label: "progress_desc" },
  { value: "progress_asc", label: "progress_asc" },
];

const SHOW_OPTIONS: { value: SortKey; label: string }[] = [
  ...COMMON_OPTIONS,
  { value: "progress_desc", label: "progress_desc" },
  { value: "progress_asc", label: "progress_asc" },
];

interface SortSelectProps {
  mediaType: "movies" | "shows";
  value: string;
  onChange: (v: string) => void;
}

export function SortSelect({ mediaType, value, onChange }: SortSelectProps) {
  const options = mediaType === "movies" ? MOVIE_OPTIONS : SHOW_OPTIONS;
  const current = options.find((o) => o.value === (value as SortKey)) ?? options[0];
  const [open, setOpen] = useState(false);

  return (
    <Select
      open={open}
      onOpenChange={setOpen}
      value={value || "__default"}
      onValueChange={(v) => onChange(v === "__default" ? "" : v)}
    >
      {/* Icon-only on mobile, full label on sm+ */}
      <SelectTrigger
        className={cn(
          "h-11 w-11 shrink-0 rounded-sm font-mono sm:w-auto sm:min-w-[170px]",
          // Open/selected state mirrors the filters button: violet fill, no ring.
          // These also override the base Select's purple focus/open styling.
          "focus:ring-0 focus:border-violet-500/30 focus:bg-violet-500/10",
          "data-[state=open]:ring-0 data-[state=open]:border-violet-500/30 data-[state=open]:bg-violet-500/10 data-[state=open]:text-violet-300 data-[state=open]:[&_svg]:text-violet-300/70",
          open
            ? "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15"
            : "border-[#16162a] bg-[#0a0a14] hover:bg-[#0d0d1a]",
        )}
        title={`Sort: ${current.label}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            style={{ display: "flex" }}
          >
            <ArrowUpDown className="h-4 w-4 shrink-0 text-white/40" />
          </motion.div>
          <SelectValue>
            <span className="hidden sm:block truncate">{current.label}</span>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent
        align="end"
        collisionPadding={8}
        className="max-w-[220px] rounded-sm border-[#16162a] bg-[#07070d] font-mono"
      >
        {options.map((o) => (
          <SelectItem
            key={o.value || "__default"}
            value={o.value || "__default"}
            className="rounded-sm text-xs"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
