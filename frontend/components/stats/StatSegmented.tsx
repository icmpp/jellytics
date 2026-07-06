"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatSegment<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface StatSegmentedProps<T extends string> {
  options: StatSegment<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Compact terminal-styled segmented toggle for the stats panels — mirrors the
 * canonical active control state (violet-500/30 border + violet-500/10 fill +
 * violet-300 text), lowercase mono labels, `>` active / `·` idle prompts.
 */
export function StatSegmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: StatSegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-sm border border-[#16162a] bg-[#06060d]",
        className,
      )}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "group relative flex items-center gap-1.5 whitespace-nowrap border-r border-[#16162a] px-2.5 py-1 text-xs font-mono transition-colors last:border-r-0",
              active ? "bg-violet-500/10 text-violet-300" : "text-white/40 hover:text-white/70",
            )}
          >
            <span
              className={cn(
                "w-2 shrink-0 select-none text-center",
                active
                  ? "text-violet-400 phosphor-glow"
                  : "text-violet-400/35 group-hover:text-violet-400/60",
              )}
              aria-hidden="true"
            >
              {active ? ">" : "·"}
            </span>
            {Icon && <Icon className="h-3 w-3 shrink-0" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
