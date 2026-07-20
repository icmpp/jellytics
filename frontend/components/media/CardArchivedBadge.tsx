"use client";

import { Archive } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardArchivedBadgeProps {
  className?: string;
}

/**
 * Top-left badge marking an item that was deleted from Jellyfin and archived.
 * Amber to read as a warning state, distinct from the violet watch-status badge.
 */
export function CardArchivedBadge({ className }: CardArchivedBadgeProps) {
  return (
    <span
      role="status"
      aria-label="Archived — removed from Jellyfin"
      title="Archived — removed from Jellyfin"
      className={cn(
        "absolute left-2 top-2 z-10",
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
        "ring-1 ring-amber-400/25 ring-inset",
        "bg-amber-500/85 text-[10px] font-semibold uppercase tracking-wide text-amber-950",
        "shadow-lg shadow-black/40 backdrop-blur-md",
        className,
      )}
    >
      <Archive className="h-3 w-3" />
      <span>Archived</span>
    </span>
  );
}
