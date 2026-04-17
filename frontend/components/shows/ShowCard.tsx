"use client";

import { memo } from "react";
import { Show } from "@/hooks/useShows";
import Link from "next/link";
import {
  getShowPosterUrl,
  getWatchStatusText,
  cn,
  MEDIA_CARD_BASE,
  PROGRESS_BAR_CLASS,
} from "@/lib/utils";
import { PosterImage } from "@/components/ui/poster-image";

interface ShowCardProps {
  show: Show;
}

export const ShowCard = memo(function ShowCard({ show }: ShowCardProps) {
  const progress = show.total_episodes
    ? Math.round((show.watched_episodes / show.total_episodes) * 100)
    : 0;
  const watchStatusText = getWatchStatusText(show.status, {
    mediaType: "show",
  });

  return (
    <Link
      href={`/shows/${show.id}`}
      aria-label={`View details for ${show.title}`}
      className="block min-w-0 h-full"
    >
      <div className={cn(MEDIA_CARD_BASE, "group h-full flex flex-col cursor-pointer")}>
        <div className="relative aspect-2/3 w-full overflow-hidden shrink-0">
          <PosterImage
            src={show.jellyfin_id ? getShowPosterUrl(show.jellyfin_id) : undefined}
            alt={`Poster for ${show.title}`}
            type="show"
            hoverScale
          />
        </div>
        <div className="p-4 flex-1 min-h-0 flex flex-col">
          <h3 className="media-card-title font-semibold text-white line-clamp-2 mb-2 text-sm min-w-0">
            {show.title}
          </h3>
          {show.total_episodes && show.total_episodes > 0 ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-white/30">{watchStatusText}</span>
                <span className="text-white/50 shrink-0">
                  {show.watched_episodes}/{show.total_episodes} · {progress}%
                </span>
              </div>
              <div className={PROGRESS_BAR_CLASS}>
                <div
                  className="h-full bg-linear-to-r from-purple-500 to-purple-400 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-white/30">{watchStatusText}</div>
          )}
        </div>
      </div>
    </Link>
  );
});
