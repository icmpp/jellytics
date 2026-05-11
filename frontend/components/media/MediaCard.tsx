"use client";

import { Fragment, memo, type ReactNode } from "react";
import Link from "next/link";
import { PosterImage } from "@/components/ui/poster-image";
import { CardStatusBadge, CardRatingPill, CardChips } from "@/components/media";
import { useRatingsMap, ratingKey } from "@/hooks/useRatingsMap";
import { cn } from "@/lib/utils";

type WatchStatus = "watched" | "watching" | "pending";

export interface MediaCardProgress {
  label: string;
  value: number;
  secondary?: string;
}

export interface MediaCardProps {
  itemType: "movie" | "show";
  itemId: number;
  href: string;
  title: string;
  posterUrl?: string;
  status: WatchStatus;
  genre?: string;
  meta?: Array<string | number | null | undefined>;
  progress?: MediaCardProgress;
  bottomAccent?: ReactNode;
}

export const MediaCard = memo(function MediaCard({
  itemType,
  itemId,
  href,
  title,
  posterUrl,
  status,
  genre,
  meta,
  progress,
  bottomAccent,
}: MediaCardProps) {
  const ratingsMap = useRatingsMap();
  const userRating = ratingsMap.get(ratingKey(itemType, itemId));

  const metaParts = (meta ?? []).filter(
    (p): p is string | number => p !== null && p !== undefined && p !== "",
  );

  const clampedValue = progress ? Math.max(0, Math.min(100, progress.value)) : 0;

  return (
    <Link
      href={href}
      aria-label={`View details for ${title}`}
      className="block min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/*
        Outer wrapper: holds the rotating gradient background.
        The 2 px padding gap is where the gradient shows through as the border.
        On hover the gradient spins; at rest it's a plain subtle border.
      */}
      <div
        className={cn(
          "card-border group relative rounded-2xl p-[2px]",
          "shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5),0_1px_4px_-1px_rgba(0,0,0,0.35)]",
        )}
      >
        {/* Inner card — masks the gradient background, leaving only the 2 px border gap */}
        <div className="relative isolate aspect-2/3 w-full cursor-pointer overflow-hidden rounded-[calc(1rem-2px)] bg-zinc-950">
          {/* Poster */}
          <PosterImage src={posterUrl} alt={`Poster for ${title}`} type={itemType} />

          {/* Base gradient — legibility at bottom */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/90 via-black/35 to-black/10"
          />

          {/* Hover gradient deepening */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />

          {/* Specular highlight on hover */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(ellipse 80% 35% at 50% 0%, rgba(255,255,255,0.05), transparent)",
            }}
          />

          {/* Top badges */}
          <CardStatusBadge status={status} />
          {userRating !== undefined && <CardRatingPill rating={userRating} />}

          {/* Info zone */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 px-3 pb-3 pt-10">
            <CardChips itemType={itemType} itemId={itemId} genre={genre} max={2} />

            <h3
              className={cn(
                "line-clamp-2 text-[0.8125rem] font-semibold leading-snug tracking-tight text-white",
                "transition-colors duration-200 group-hover:text-primary/90",
              )}
            >
              {title}
            </h3>

            {metaParts.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] font-medium tabular-nums tracking-wide text-white/50">
                {metaParts.map((part, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="text-white/25">·</span>}
                    <span>{part}</span>
                  </Fragment>
                ))}
              </div>
            )}

            {bottomAccent && <div className="mt-0.5">{bottomAccent}</div>}
          </div>

          {/* Progress bar */}
          {progress && (
            <div className="absolute inset-x-0 bottom-0 z-20 h-[3px] bg-white/10">
              <div
                className={cn(
                  "h-full bg-linear-to-r from-primary via-violet-400 to-fuchsia-400",
                  "shadow-[0_0_6px_1px_rgba(139,92,246,0.65)]",
                  "transition-[width] duration-500 ease-out",
                )}
                style={{ width: `${clampedValue}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
});
