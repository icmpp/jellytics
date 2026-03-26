"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useShow, type Episode } from "@/hooks/useShows";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading-skeleton";
import {
  ArrowLeft,
  Archive,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  PlayCircle,
  Tv,
  Eye,
  Percent,
  Film as FilmIcon,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { AddRemoveWatchlistButton } from "@/components/watchlist/AddRemoveWatchlistButton";
import { AddToCollectionButton } from "@/components/collections";
import { AddTagButton, TagBadge } from "@/components/media";
import { RemoveFromLibraryButton } from "@/components/library/RemoveFromLibraryButton";
import { Breadcrumb } from "@/components/navigation";
import {
  getShowPosterUrl,
  parseGenres,
  buildJellyfinItemUrl,
  getWatchStatusText,
  MEDIA_POSTER_CONTAINER,
} from "@/lib/utils";
import { useRating, useSetRating, useDeleteRating } from "@/hooks/useRatings";
import { useTagsForItem, useRemoveTagFromItem } from "@/hooks/useTags";
import { RatingStars } from "@/components/reviews";
import {
  useReview,
  useCreateOrUpdateReview,
  useDeleteReview,
} from "@/hooks/useReviews";
import { ReviewEditor } from "@/components/reviews";
import { useSettings } from "@/hooks/useSettings";

function SeasonSection({
  seasonNumber,
  episodes,
  defaultOpen,
  jellyfinServerUrl,
  jellyfinServerId,
}: {
  seasonNumber: number;
  episodes: Episode[];
  defaultOpen: boolean;
  jellyfinServerUrl?: string;
  jellyfinServerId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const watched = episodes.filter((e) => e.watched).length;
  const pct = episodes.length > 0 ? Math.round((watched / episodes.length) * 100) : 0;

  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3.5 min-h-[48px] bg-white/[0.02] hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors text-left touch-manipulation tap-target"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-white/40 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/40 shrink-0" />
        )}
        <span className="flex-1 text-sm font-medium text-white">
          {seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`}
        </span>
        <span className="text-xs text-white/40 shrink-0">
          {watched}/{episodes.length}
        </span>
        <div className="w-12 sm:w-16 bg-white/10 rounded-full h-1.5 shrink-0">
          <div
            className="h-full rounded-full bg-purple-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </button>

      {open && (
        <div className="divide-y divide-white/[0.05]">
          {episodes
            .sort((a, b) => (a.episode_number ?? 0) - (b.episode_number ?? 0))
            .map((episode) => (
              <EpisodeRow
                key={episode.id}
                episode={episode}
                jellyfinServerUrl={jellyfinServerUrl}
                jellyfinServerId={jellyfinServerId}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function EpisodeRow({
  episode,
  jellyfinServerUrl,
  jellyfinServerId,
}: {
  episode: Episode;
  jellyfinServerUrl?: string;
  jellyfinServerId?: string;
}) {
  const raw = (episode as Episode & { completion_percentage?: number }).completion_percentage;
  const completion =
    typeof raw === "number" ? Math.round(raw) : undefined;

  const playUrl =
    jellyfinServerUrl && episode.jellyfin_id
      ? buildJellyfinItemUrl(jellyfinServerUrl, episode.jellyfin_id, jellyfinServerId, "episode")
      : null;

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3.5 min-h-[44px] sm:min-h-0 hover:bg-white/[0.03] transition-colors active:bg-white/[0.05]">
      <div className="w-12 sm:w-14 shrink-0 text-center">
        <span className="text-xs font-medium text-white/50 bg-white/[0.05] px-2 py-0.5 rounded">
          E{episode.episode_number}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{episode.title || "Untitled"}</p>
        <div className="flex items-center gap-3 mt-0.5">
          {episode.duration_minutes && (
            <span className="text-xs text-white/35 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {episode.duration_minutes}m
            </span>
          )}
          {episode.watched_at && (
            <span className="text-xs text-white/30">
              {new Date(episode.watched_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {completion !== undefined && completion > 0 && completion < 100 && (
          <div className="mt-1.5 w-full bg-white/10 rounded-full h-1 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${completion}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {playUrl && (
          <a
            href={playUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30 hover:text-blue-200 transition-colors"
            aria-label={
              completion !== undefined && completion > 0
                ? `Resume episode ${episode.episode_number}`
                : `Play episode ${episode.episode_number}`
            }
          >
            <PlayCircle className="h-4 w-4" />
          </a>
        )}
        {episode.watched ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs border border-emerald-500/25">
            <CheckCircle2 className="h-3 w-3" />
            Watched
          </div>
        ) : completion !== undefined && completion > 0 ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs border border-blue-500/25">
            <PlayCircle className="h-3 w-3" />
            {completion}%
          </div>
        ) : (
          <div className="px-2 py-0.5 rounded-lg bg-white/[0.04] text-white/35 text-xs border border-white/[0.07]">
            Pending
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShowDetailPage() {
  const params = useParams();
  const showId = parseInt(params.id as string, 10);
  const [posterError, setPosterError] = useState(false);

  const { data, isLoading, error } = useShow(showId);
  const { data: settings } = useSettings();
  const { data: rating } = useRating("show", showId);
  const setRating = useSetRating();
  const deleteRating = useDeleteRating();
  const { data: review } = useReview("show", showId);
  const createOrUpdateReview = useCreateOrUpdateReview();
  const deleteReview = useDeleteReview();
  const { data: itemTags = [] } = useTagsForItem("show", showId);
  const removeTag = useRemoveTagFromItem();

  const epList = data?.episodes ?? [];
  const { seasonMap, seasons, nextEpisode } = useMemo(() => {
    const map = epList.reduce<Map<number, Episode[]>>((acc, ep) => {
      const s = ep.season_number ?? 0;
      if (!acc.has(s)) acc.set(s, []);
      acc.get(s)!.push(ep);
      return acc;
    }, new Map());
    const seasonNums = Array.from(map.keys()).sort((a, b) => a - b);
    const next = [...epList]
      .sort(
        (a, b) =>
          (a.season_number ?? 0) - (b.season_number ?? 0) ||
          (a.episode_number ?? 0) - (b.episode_number ?? 0),
      )
      .find((ep) => !ep.watched);
    return { seasonMap: map, seasons: seasonNums, nextEpisode: next };
  }, [epList]);

  const genres = useMemo(
    () => (data?.show ? parseGenres(data.show.genre) : []),
    [data?.show?.genre],
  );
  const breadcrumbItems = useMemo(
    () => [
      { icon: "home" as const, href: "/dashboard" },
      { label: "Shows", href: "/shows" },
      { label: data?.show?.title ?? "" },
    ],
    [data?.show?.title],
  );

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
            <Skeleton className="aspect-[2/3] w-full" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !data?.show) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <Tv className="h-16 w-16 text-white/20 mx-auto mb-4" />
          <p className="text-red-400 text-lg mb-2">Show not found</p>
          <p className="text-white/40 text-sm mb-6">
            The show you're looking for doesn't exist.
          </p>
          <Link href="/shows">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Shows
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const { show } = data;

  const progress = show.total_episodes
    ? Math.round((show.watched_episodes / show.total_episodes) * 100)
    : 0;

  const watchStatusText = getWatchStatusText(show.status, { mediaType: "show" });

  return (
    <AppLayout>
      <div className="flex justify-start mb-4 md:mb-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {show.removed_from_library && (
        <div className="mb-4 md:mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
          <Archive className="h-4 w-4 shrink-0" />
          <span>Removed from library. Viewing preserved data.</span>
        </div>
      )}

      <div className="grid gap-6 md:gap-8 lg:grid-cols-[280px_1fr] min-w-0 w-full">
        <div className="flex-shrink-0 w-full max-w-[180px] sm:max-w-[200px] mx-auto lg:max-w-none lg:mx-0">
          <div className={MEDIA_POSTER_CONTAINER}>
            {show.jellyfin_id && !posterError ? (
              <Image
                src={getShowPosterUrl(show.jellyfin_id)}
                alt={show.title}
                fill
                className="object-contain"
                sizes="280px"
                loading="eager"
                priority
                onError={() => setPosterError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Tv className="h-16 w-16 text-white/20" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 min-w-0 w-full max-w-full">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start gap-3 sm:gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-3 break-words">
                  {show.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-white/50">
                  {show.year && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      <span>{show.year}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {show.status === "watched" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : show.status === "watching" ? (
                      <PlayCircle className="h-4 w-4 text-blue-400" />
                    ) : (
                      <Tv className="h-4 w-4" />
                    )}
                    <span>{watchStatusText}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {settings?.jellyfin_server_url && show.jellyfin_id && (
                  <a
                    href={buildJellyfinItemUrl(settings.jellyfin_server_url, show.jellyfin_id, settings.jellyfin_server_id, "show")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <PlayCircle className="h-3 w-3 mr-2" />
                      {show.status === "watching" || (show.watched_episodes ?? 0) > 0
                        ? "Resume in Jellyfin"
                        : "Play in Jellyfin"}
                    </Button>
                  </a>
                )}
                {!show.removed_from_library && (
                  <>
                    <AddRemoveWatchlistButton
                      itemType="show"
                      itemId={showId}
                      variant="outline"
                      size="sm"
                    />
                    <AddToCollectionButton
                      itemType="show"
                      itemId={showId}
                      variant="outline"
                      size="sm"
                    />
                    <AddTagButton
                      itemType="show"
                      itemId={showId}
                      variant="outline"
                      size="sm"
                    />
                    <RemoveFromLibraryButton
                      itemType="show"
                      itemId={showId}
                      itemTitle={show.title}
                      variant="outline"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/30"
                    />
                  </>
                )}
              </div>
            </div>

            {(genres.length > 0 || itemTags.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-6">
                {itemTags.map((tag) => (
                  <TagBadge
                    key={tag.id}
                    name={tag.name}
                    color={tag.color}
                    onRemove={() =>
                      removeTag.mutate({
                        tagId: tag.id,
                        itemType: "show",
                        itemId: showId,
                      })
                    }
                  />
                ))}
                {genres.map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {show.overview && (
              <p className="text-white/60 mb-6 leading-relaxed break-words">
                {show.overview}
              </p>
            )}

            <div className="mb-6">
              <label className="text-sm font-medium text-white/40 mb-3 block">
                Your Rating
              </label>
              <RatingStars
                rating={rating?.rating || null}
                onRatingChange={(newRating) => {
                  if (rating && rating.rating === newRating) {
                    deleteRating.mutate({ itemType: "show", itemId: showId });
                  } else {
                    setRating.mutate({
                      itemType: "show",
                      itemId: showId,
                      rating: newRating,
                    });
                  }
                }}
                interactive
                showValue
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-6">
              <Card className="hover:bg-white/[0.05] transition-colors">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30 shrink-0">
                      <Eye className="h-4 w-4 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-bold text-white">
                        {show.watched_episodes}
                      </div>
                      <div className="text-xs text-white/40">Watched</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover:bg-white/[0.05] transition-colors">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30 shrink-0">
                      <FilmIcon className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-bold text-white">
                        {show.total_episodes || 0}
                      </div>
                      <div className="text-xs text-white/40">Total</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover:bg-white/[0.05] transition-colors">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 shrink-0">
                      <Percent className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-bold text-white">
                        {progress}%
                      </div>
                      <div className="text-xs text-white/40">Complete</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover:bg-white/[0.05] transition-colors">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30 shrink-0">
                      <Clock className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-bold text-white">
                        {Math.round(show.total_watch_time_minutes / 60)}
                      </div>
                      <div className="text-xs text-white/40">Hours</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {(show.total_episodes && show.total_episodes > 0) ||
            show.first_watched_at ||
            show.last_watched_at ? (
              <div className="mb-6 p-3 sm:p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm mb-2">
                  <span className="text-white/50">
                    {show.last_watched_at ? (
                      <>
                        Last watched{" "}
                        {new Date(show.last_watched_at).toLocaleDateString()}
                      </>
                    ) : show.first_watched_at ? (
                      <>
                        First watched{" "}
                        {new Date(show.first_watched_at).toLocaleDateString()}
                      </>
                    ) : (
                      "Episode Progress"
                    )}
                  </span>
                  {show.total_episodes && show.total_episodes > 0 && (
                    <span className="font-medium text-white shrink-0">
                      {show.watched_episodes}/{show.total_episodes} · {progress}%
                    </span>
                  )}
                </div>
                {show.total_episodes && show.total_episodes > 0 && (
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            ) : null}

            <ReviewEditor
              review={review || null}
              onSave={(reviewText, notes) => {
                createOrUpdateReview.mutate({
                  itemType: "show",
                  itemId: showId,
                  reviewText,
                  notes,
                });
              }}
              onDelete={() => {
                deleteReview.mutate({ itemType: "show", itemId: showId });
              }}
              isLoading={createOrUpdateReview.isPending}
              isDeleting={deleteReview.isPending}
            />

            <div className="mt-6 space-y-4">
              {epList.length > 0 ? (
                <>
                  {nextEpisode && show.status !== "watched" && (
                    <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <PlayCircle className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-blue-400/70 mb-0.5">Next to watch</p>
                        <p className="text-sm font-medium text-white truncate">
                          S{nextEpisode.season_number}E{nextEpisode.episode_number}
                          {nextEpisode.title ? ` — ${nextEpisode.title}` : ""}
                        </p>
                      </div>
                    </div>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Tv className="h-5 w-5 text-purple-400" />
                        Episodes ({epList.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                    {seasons.map((seasonNum) => (
                      <SeasonSection
                        key={seasonNum}
                        seasonNumber={seasonNum}
                        episodes={seasonMap.get(seasonNum)!}
                        defaultOpen={
                          nextEpisode
                            ? nextEpisode.season_number === seasonNum
                            : seasonNum === seasons[seasons.length - 1]
                        }
                        jellyfinServerUrl={settings?.jellyfin_server_url}
                        jellyfinServerId={settings?.jellyfin_server_id}
                      />
                    ))}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Tv className="h-5 w-5 text-purple-400" />
                      Episodes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-white/50 text-center py-6">
                      No episodes synced yet. Run a sync to import episode data from Jellyfin.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
