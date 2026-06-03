"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { StatusCounts } from "@/hooks/useStatusCounts";

interface StatusSegmentedProps {
  value: string; // "" for all
  onChange: (v: string) => void;
  counts?: StatusCounts;
  className?: string;
}

const SEGMENTS: { value: string; label: string; countKey: keyof StatusCounts }[] = [
  { value: "", label: "all", countKey: "all" },
  { value: "watched", label: "watched", countKey: "watched" },
  { value: "watching", label: "watching", countKey: "watching" },
  { value: "pending", label: "pending", countKey: "pending" },
];

function formatCount(n: number | undefined): string {
  if (n === undefined || n === null) return "";
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(n / 1000)}k`;
}

export function StatusSegmented({ value, onChange, counts, className }: StatusSegmentedProps) {
  // Scopes the shared-layout animation to this instance so the violet
  // highlight glides between segments — the sidebar nav's signature move.
  const layoutId = useId();

  return (
    <div
      role="tablist"
      aria-label="Filter by watch status"
      className={cn(
        "inline-flex h-11 items-stretch overflow-hidden rounded-sm border border-[#16162a] bg-[#06060d]",
        "w-full sm:w-auto overflow-x-auto scrollbar-none",
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
              "group relative flex items-center gap-1.5 whitespace-nowrap border-r border-[#16162a] px-3 sm:px-4 text-xs font-mono transition-colors last:border-r-0",
              active ? "text-violet-300/90" : "text-white/40 hover:text-white/70",
            )}
          >
            {/* Sliding active highlight — mirrors the sidebar nav indicator */}
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 z-0 bg-[#07070d]"
                style={{ boxShadow: "inset 0 1.5px 0 #8b5cf6" }}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}

            {/* Prompt: > when active, faint · otherwise */}
            <span
              className={cn(
                "relative z-10 w-2 shrink-0 select-none text-center",
                active
                  ? "text-violet-400 phosphor-glow"
                  : "text-violet-400/35 group-hover:text-violet-400/60",
              )}
              aria-hidden="true"
            >
              {active ? ">" : "·"}
            </span>

            <span
              className={cn(
                "relative z-10 transition-transform",
                !active && "group-hover:translate-x-0.5",
              )}
            >
              {seg.label}
              {active && <span className="cursor-blink ml-px text-violet-400/80">_</span>}
            </span>

            {count !== undefined && count !== null && (
              <span
                className={cn(
                  "relative z-10 text-xs tabular-nums",
                  active ? "text-violet-400/70" : "text-white/25",
                )}
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
