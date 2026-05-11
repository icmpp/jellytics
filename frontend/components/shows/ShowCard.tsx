"use client";

import { memo } from "react";
import { Show } from "@/hooks/useShows";
import { MediaCard } from "@/components/media";
import { getShowPosterUrl, getWatchStatusText } from "@/lib/utils";

interface ShowCardProps {
  show: Show;
}

export const ShowCard = memo(function ShowCard({ show }: ShowCardProps) {
  const totalEpisodes = show.total_episodes ?? 0;
  const hasEpisodeProgress = totalEpisodes > 0;
  const progressPct = hasEpisodeProgress
    ? Math.round((show.watched_episodes / totalEpisodes) * 100)
    : 0;

  const upNextLabel =
    show.status === "watching" && show.up_next
      ? `Next: S${show.up_next.season_number}E${show.up_next.episode_number}`
      : null;

  return (
    <MediaCard
      itemType="show"
      itemId={show.id}
      href={`/shows/${show.id}`}
      title={show.title}
      posterUrl={show.jellyfin_id ? getShowPosterUrl(show.jellyfin_id) : undefined}
      status={show.status}
      genre={show.genre}
      meta={[show.year, hasEpisodeProgress ? `${totalEpisodes} eps` : null]}
      progress={
        hasEpisodeProgress
          ? {
              label: getWatchStatusText(show.status, { mediaType: "show" }),
              value: progressPct,
              secondary: `${show.watched_episodes}/${totalEpisodes} · ${progressPct}%`,
            }
          : undefined
      }
      bottomAccent={
        upNextLabel ? (
          <p className="truncate text-[10px] font-medium text-primary/80">
            {upNextLabel}
            {show.up_next?.title ? (
              <span className="font-normal text-white/45"> · {show.up_next.title}</span>
            ) : null}
          </p>
        ) : null
      }
    />
  );
});
