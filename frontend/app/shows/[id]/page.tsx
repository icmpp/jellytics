"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useShow, type Episode } from "@/hooks/useShows";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { EmptyTerminal, TerminalAction } from "@/components/media/EmptyTerminal";
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
import Image from "next/image";
import { AddRemoveWatchlistButton } from "@/components/watchlist/AddRemoveWatchlistButton";
import { AddToCollectionButton } from "@/components/collections";
import { AddTagButton, TagBadge } from "@/components/media";
import {
  DETAIL_ACTION_BTN,
  DETAIL_ACTION_BTN_PRIMARY,
  DETAIL_ACTION_BTN_DANGER,
} from "@/components/media/detail-action-button";
import { RemoveFromLibraryButton } from "@/components/library/RemoveFromLibraryButton";
import { SidebarTooltip } from "@/components/layout/SidebarTooltip";
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
import { useReview, useCreateOrUpdateReview, useDeleteReview } from "@/hooks/useReviews";
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
    <div className="rounded-sm border border-[#16162a] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3.5 min-h-[48px] bg-[#0a0a14] hover:bg-[#0d0d1a] active:bg-[#0d0d1a] transition-colors text-left touch-manipulation tap-target font-mono"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-violet-400/60 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-violet-400/35 shrink-0" />
        )}
        <span className="flex-1 text-sm text-violet-100">
          {seasonNumber === 0 ? "specials" : `season_${seasonNumber}`}
        </span>
        <span className="text-xs text-white/40 shrink-0 tabular-nums">
          {watched}/{episodes.length}
        </span>
        <div className="w-12 sm:w-16 bg-[#16162a] rounded-sm h-1.5 shrink-0 overflow-hidden">
          <div
            className="h-full rounded-sm bg-[#8b5cf6] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </button>

      {open && (
        <div className="divide-y divide-[#16162a]">
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
  const completion = typeof raw === "number" ? Math.round(raw) : undefined;

  const playUrl =
    jellyfinServerUrl && episode.jellyfin_id
      ? buildJellyfinItemUrl(jellyfinServerUrl, episode.jellyfin_id, jellyfinServerId, "episode")
      : null;

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3.5 min-h-[44px] sm:min-h-0 hover:bg-[#0d0d1a] transition-colors active:bg-[#0d0d1a] font-mono">
      <div className="w-12 sm:w-14 shrink-0 text-center">
        <span className="text-xs text-violet-300/70 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-sm tabular-nums">
          e{episode.episode_number}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/90 truncate">{episode.title || "untitled"}</p>
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
          <div className="mt-1.5 w-full bg-[#16162a] rounded-sm h-1 overflow-hidden">
            <div className="h-full bg-[#8b5cf6] rounded-sm" style={{ width: `${completion}%` }} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {playUrl && (
          <a
            href={playUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-sm bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 transition-colors"
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
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/25">
            <CheckCircle2 className="h-3 w-3" />
            watched
          </div>
        ) : completion !== undefined && completion > 0 ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-violet-500/10 text-violet-300 text-xs border border-violet-500/25 tabular-nums">
            <PlayCircle className="h-3 w-3" />
            {completion}%
          </div>
        ) : (
          <div className="px-2 py-0.5 rounded-sm bg-[#0a0a14] text-white/35 text-xs border border-[#16162a]">
            pending
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

  const { seasonMap, seasons, nextEpisode, epList } = useMemo(() => {
    const epList = data?.episodes ?? [];
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
    return { seasonMap: map, seasons: seasonNums, nextEpisode: next, epList };
  }, [data]);

  const genres = useMemo(() => (data?.show ? parseGenres(data.show.genre) : []), [data]);
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
            <Skeleton className="aspect-2/3 w-full" />
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
        <EmptyTerminal
          path={`shows/${params.id}`}
          command={`cat show --id=${params.id}`}
          output="error: not found"
          icon={Tv}
          headline="show not found"
          subtext="the show you're looking for doesn't exist or was removed."
          statusLabel="404"
          actions={
            <TerminalAction
              href="/shows"
              icon={ArrowLeft}
              label="back to shows"
              variant="primary"
            />
          }
        />
      </AppLayout>
    );
  }

  const { show } = data;

  const progress = show.total_episodes
    ? Math.round((show.watched_episodes / show.total_episodes) * 100)
    : 0;

  const watchStatusText = getWatchStatusText(show.status, {
    mediaType: "show",
  });

  return (
    <AppLayout>
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] md:top-0 z-10 -mx-4 px-4 md:-mx-8 md:px-8 h-[64px] flex items-center bg-[#050508]">
        <div className="-ml-1.5">
          <Breadcrumb items={breadcrumbItems} />
        </div>
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, rgba(139,92,246,0.25) 0%, #1e1e32 22%, transparent 65%)",
          }}
        />
      </div>

      <div className="mt-4 md:mt-8 space-y-4 md:space-y-6">
        {show.removed_from_library && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-mono">
            <Archive className="h-4 w-4 shrink-0" />
            <span># removed from library — viewing preserved data</span>
          </div>
        )}

        {show.deleted_from_jellyfin && !show.removed_from_library && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-mono">
            <Archive className="h-4 w-4 shrink-0" />
            <span>
              # archived — removed from Jellyfin
              {show.archived_at ? ` on ${new Date(show.archived_at).toLocaleDateString()}` : ""} ·
              stats preserved
            </span>
          </div>
        )}

        <div className="grid gap-6 md:gap-8 lg:grid-cols-[280px_1fr] min-w-0 w-full">
          <div className="shrink-0 w-full max-w-[180px] sm:max-w-[200px] mx-auto lg:max-w-none lg:mx-0">
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
                  <div className="flex items-center gap-3 min-w-0 mb-2 sm:mb-3">
                    <span
                      className="text-violet-400 text-base font-mono shrink-0 select-none phosphor-glow"
                      aria-hidden="true"
                    >
                      {">"}
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-mono font-semibold text-white wrap-break-word leading-tight">
                      {show.title}
                    </h1>
                    <span className="cursor-blink text-violet-400/60 text-2xl leading-tight shrink-0 select-none">
                      _
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-sm text-white/50">
                    {show.year && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-violet-400/50" />
                          <span className="tabular-nums">{show.year}</span>
                        </div>
                        <span aria-hidden className="text-white/15">
                          ·
                        </span>
                      </>
                    )}
                    <div className="flex items-center gap-1.5">
                      {show.status === "watched" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : show.status === "watching" ? (
                        <PlayCircle className="h-3.5 w-3.5 text-violet-300" />
                      ) : (
                        <Tv className="h-3.5 w-3.5 text-violet-400/50" />
                      )}
                      <span className="text-white/70">{watchStatusText}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {settings?.jellyfin_server_url && show.jellyfin_id && (
                    <SidebarTooltip
                      placement="bottom"
                      label={
                        show.status === "watching" || (show.watched_episodes ?? 0) > 0
                          ? "resume in jellyfin"
                          : "play in jellyfin"
                      }
                    >
                      <a
                        href={buildJellyfinItemUrl(
                          settings.jellyfin_server_url,
                          show.jellyfin_id,
                          settings.jellyfin_server_id,
                          "show",
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          variant="outline"
                          size="icon"
                          className={DETAIL_ACTION_BTN_PRIMARY}
                          aria-label={
                            show.status === "watching" || (show.watched_episodes ?? 0) > 0
                              ? "Resume in Jellyfin"
                              : "Play in Jellyfin"
                          }
                        >
                          <PlayCircle />
                        </Button>
                      </a>
                    </SidebarTooltip>
                  )}
                  {!show.removed_from_library && (
                    <>
                      <SidebarTooltip placement="bottom" label="watchlist">
                        <AddRemoveWatchlistButton
                          itemType="show"
                          itemId={showId}
                          variant="outline"
                          size="icon"
                          iconOnly
                          className={DETAIL_ACTION_BTN}
                        />
                      </SidebarTooltip>
                      <SidebarTooltip placement="bottom" label="add to collection">
                        <AddToCollectionButton
                          itemType="show"
                          itemId={showId}
                          variant="outline"
                          size="icon"
                          iconOnly
                          className={DETAIL_ACTION_BTN}
                        />
                      </SidebarTooltip>
                      <SidebarTooltip placement="bottom" label="add tag">
                        <AddTagButton
                          itemType="show"
                          itemId={showId}
                          variant="outline"
                          size="icon"
                          iconOnly
                          className={DETAIL_ACTION_BTN}
                        />
                      </SidebarTooltip>
                      <span aria-hidden className="mx-0.5 h-6 w-px bg-[#16162a]" />
                      {/* No tooltip — it's the rightmost button and a "remove from library"
                          label overflows the viewport edge; the icon is self-explanatory. */}
                      <RemoveFromLibraryButton
                        itemType="show"
                        itemId={showId}
                        itemTitle={show.title}
                        variant="outline"
                        size="icon"
                        iconOnly
                        className={DETAIL_ACTION_BTN_DANGER}
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
                      className="px-2.5 py-1 rounded-sm text-xs font-mono bg-[#0a0a14] text-violet-300/80 border border-[#16162a]"
                    >
                      <span className="select-none text-violet-400/40">#</span>
                      {genre.toLowerCase()}
                    </span>
                  ))}
                </div>
              )}

              {show.overview && (
                <p className="text-white/60 mb-6 leading-relaxed wrap-break-word">
                  {show.overview}
                </p>
              )}

              <div className="mb-6">
                <label className="text-[10px] font-mono tracking-[0.12em] uppercase text-violet-300/55 mb-3 block select-none">
                  <span className="text-violet-400/45">{"//"} </span>rating
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
                <Card className="hover:bg-violet-500/5 transition-colors">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-2 rounded-sm bg-violet-500/10 border border-violet-500/30 shrink-0">
                        <Eye className="h-4 w-4 text-violet-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg sm:text-xl font-mono font-semibold text-white">
                          {show.watched_episodes}
                        </div>
                        <div className="text-[9px] sm:text-[10px] font-mono text-violet-300/65 uppercase tracking-[0.12em] select-none">
                          {"//"} watched
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="hover:bg-violet-500/5 transition-colors">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-2 rounded-sm bg-violet-500/10 border border-violet-500/30 shrink-0">
                        <FilmIcon className="h-4 w-4 text-violet-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg sm:text-xl font-mono font-semibold text-white">
                          {show.total_episodes || 0}
                        </div>
                        <div className="text-[9px] sm:text-[10px] font-mono text-violet-300/65 uppercase tracking-[0.12em] select-none">
                          {"//"} total
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="hover:bg-violet-500/5 transition-colors">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-2 rounded-sm bg-violet-500/10 border border-violet-500/30 shrink-0">
                        <Percent className="h-4 w-4 text-violet-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg sm:text-xl font-mono font-semibold text-white">
                          {progress}%
                        </div>
                        <div className="text-[9px] sm:text-[10px] font-mono text-violet-300/65 uppercase tracking-[0.12em] select-none">
                          {"//"} complete
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="hover:bg-violet-500/5 transition-colors">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-2 rounded-sm bg-violet-500/10 border border-violet-500/30 shrink-0">
                        <Clock className="h-4 w-4 text-violet-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg sm:text-xl font-mono font-semibold text-white">
                          {Math.round(show.total_watch_time_minutes / 60)}
                        </div>
                        <div className="text-[9px] sm:text-[10px] font-mono text-violet-300/65 uppercase tracking-[0.12em] select-none">
                          {"//"} hours
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {(show.total_episodes && show.total_episodes > 0) ||
              show.first_watched_at ||
              show.last_watched_at ? (
                <div className="mb-6 p-3 sm:p-4 rounded-sm bg-[#07070d] border border-[#16162a] font-mono">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm mb-2">
                    <span className="text-white/50">
                      <span className="select-none text-violet-400/45">{"// "}</span>
                      {show.last_watched_at ? (
                        <>last_watched {new Date(show.last_watched_at).toLocaleDateString()}</>
                      ) : show.first_watched_at ? (
                        <>first_watched {new Date(show.first_watched_at).toLocaleDateString()}</>
                      ) : (
                        "episode_progress"
                      )}
                    </span>
                    {show.total_episodes && show.total_episodes > 0 && (
                      <span className="text-violet-200 shrink-0 tabular-nums">
                        {show.watched_episodes}/{show.total_episodes} · {progress}%
                      </span>
                    )}
                  </div>
                  {show.total_episodes && show.total_episodes > 0 && (
                    <div className="w-full bg-[#16162a] rounded-sm h-2 overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-[#8b5cf6] to-violet-400 transition-all"
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
                      <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-sm bg-violet-500/10 border border-violet-500/20 font-mono">
                        <div className="p-2 rounded-sm bg-violet-500/15">
                          <PlayCircle className="h-5 w-5 text-violet-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-violet-300/70 mb-0.5">
                            <span className="select-none text-violet-400/45"># </span>next_to_watch
                          </p>
                          <p className="text-sm text-white/90 truncate tabular-nums">
                            s{nextEpisode.season_number}e{nextEpisode.episode_number}
                            {nextEpisode.title ? ` — ${nextEpisode.title}` : ""}
                          </p>
                        </div>
                      </div>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2 font-mono">
                          <Tv className="h-5 w-5 text-violet-400" />
                          <span className="text-violet-400/50 text-sm select-none">
                            {"//"}
                          </span>{" "}
                          episodes
                          <span className="text-violet-300/40 text-sm font-normal">
                            ({epList.length})
                          </span>
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
                      <CardTitle className="text-white flex items-center gap-2 font-mono">
                        <Tv className="h-5 w-5 text-violet-400" />
                        <span className="text-violet-400/50 text-sm select-none">{"//"}</span>{" "}
                        episodes
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
      </div>
    </AppLayout>
  );
}
