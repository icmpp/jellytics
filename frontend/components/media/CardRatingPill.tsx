"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardRatingPillProps {
  rating: number;
  className?: string;
}

/** Top-left rating pill shown when the current user has rated this item. */
export function CardRatingPill({ rating, className }: CardRatingPillProps) {
  return (
    <span
      aria-label={`Your rating: ${rating}`}
      title={`Your rating: ${rating}`}
      className={cn(
        "absolute left-2 top-2 z-10",
        "flex items-center gap-0.5 rounded-full px-2 py-0.5",
        "ring-1 ring-white/12 ring-inset",
        "bg-black/60 text-[11px] font-semibold tabular-nums text-amber-200",
        "shadow-lg shadow-black/35 backdrop-blur-md",
        className,
      )}
    >
      <Star className="h-3 w-3 fill-amber-300/90 stroke-amber-200/80" />
      <span className="tabular-nums">{rating}</span>
    </span>
  );
}
