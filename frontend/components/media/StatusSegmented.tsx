"use client";

import { cn } from "@/lib/utils";
import type { StatusCounts } from "@/hooks/useStatusCounts";

interface StatusSegmentedProps {
  value: string; // "" for all
  onChange: (v: string) => void;
  counts?: StatusCounts;
  className?: string;
}

const SEGMENTS: { value: string; label: string; countKey: keyof StatusCounts }[] = [
  { value: "", label: "All", countKey: "all" },
  { value: "watched", label: "Watched", countKey: "watched" },
  { value: "watching", label: "Watching", countKey: "watching" },
  { value: "pending", label: "Pending", countKey: "pending" },
];

function formatCount(n: number | undefined): string {
  if (n === undefined || n === null) return "";
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(n / 1000)}k`;
}

export function StatusSegmented({ value, onChange, counts, className }: StatusSegmentedProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter by watch status"
      className={cn(
        "inline-flex h-11 items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 gap-1",
        "w-full sm:w-auto overflow-x-auto no-scrollbar",
        className,
      )}
    >
      {SEGMENTS.map((seg) => {
        const active = value === seg.value;
        const count = counts ? counts[seg.countKey] : undefined;
        return (
          <button
            key={seg.value || "all"}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(seg.value)}
            className={cn(
              "relative flex items-center gap-2 px-3 sm:px-4 h-full rounded-lg text-sm font-medium whitespace-nowrap",
              "transition-colors border",
              active
                ? "border-purple-500/30 bg-purple-500/10 text-white shadow-sm"
                : "border-transparent text-white/60 hover:text-white hover:bg-white/4",
            )}
          >
            <span>{seg.label}</span>
            {count !== undefined && count !== null && (
              <span
                className={cn("text-xs tabular-nums", active ? "text-purple-300" : "text-white/40")}
              >
                {formatCount(count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
