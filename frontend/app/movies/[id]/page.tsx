"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useMovie } from "@/hooks/useMovies";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { EmptyTerminal, TerminalAction } from "@/components/media/EmptyTerminal";
import {
  ArrowLeft,
  Archive,
  Calendar,
  Clock,
  CheckCircle2,
  PlayCircle,
  Film,
  ExternalLink,
  Eye,
  RotateCcw,
  Percent,
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
  getMoviePosterUrl,
  formatRuntime,
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

export default function MovieDetailPage() {
  const params = useParams();
  const movieId = parseInt(params.id as string, 10);
  const [posterError, setPosterError] = useState(false);

  const { data: movie, isLoading, error } = useMovie(movieId);
  const { data: settings } = useSettings();
  const { data: rating } = useRating("movie", movieId);
  const { data: itemTags = [] } = useTagsForItem("movie", movieId);
  const removeTag = useRemoveTagFromItem();
  const setRating = useSetRating();
  const deleteRating = useDeleteRating();
  const { data: review } = useReview("movie", movieId);
  const createOrUpdateReview = useCreateOrUpdateReview();
  const deleteReview = useDeleteReview();

  const genres = useMemo(() => (movie ? parseGenres(movie.genre) : []), [movie]);
  const breadcrumbItems = useMemo(
    () => [
      { icon: "home" as const, href: "/dashboard" },
      { label: "Movies", href: "/movies" },
      { label: movie?.title ?? "" },
    ],
    [movie?.title],
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

  if (error || !movie) {
    return (
      <AppLayout>
        <EmptyTerminal
          path={`movies/${params.id}`}
          command={`cat movie --id=${params.id}`}
          output="error: not found"
          icon={Film}
          headline="movie not found"
          subtext="the movie you're looking for doesn't exist or was removed."
          statusLabel="404"
          actions={
            <TerminalAction
              href="/movies"
              icon={ArrowLeft}
              label="back to movies"
              variant="primary"
            />
          }
        />
      </AppLayout>
    );
  }

  const watchStatusText = getWatchStatusText(movie.status, {
    watchCount: movie.watch_count,
    mediaType: "movie",
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
        {movie.removed_from_library && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-mono">
            <Archive className="h-4 w-4 shrink-0" />
            <span># removed from library — viewing preserved data</span>
          </div>
        )}

        {movie.deleted_from_jellyfin && !movie.removed_from_library && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-mono">
            <Archive className="h-4 w-4 shrink-0" />
            <span>
              # archived — removed from Jellyfin
              {movie.archived_at ? ` on ${new Date(movie.archived_at).toLocaleDateString()}` : ""} ·
              stats preserved
            </span>
          </div>
        )}

        <div className="grid gap-6 md:gap-8 lg:grid-cols-[280px_1fr] min-w-0 w-full">
          <div className="shrink-0 w-full max-w-[180px] sm:max-w-[200px] mx-auto lg:max-w-none lg:mx-0">
            <div className={MEDIA_POSTER_CONTAINER}>
              {movie.jellyfin_id && !posterError ? (
                <Image
                  src={getMoviePosterUrl(movie.jellyfin_id)}
                  alt={movie.title}
                  fill
                  className="object-contain"
                  sizes="280px"
                  loading="eager"
                  priority
                  onError={() => setPosterError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film className="h-16 w-16 text-white/20" />
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
                      {movie.title}
                    </h1>
                    <span className="cursor-blink text-violet-400/60 text-2xl leading-tight shrink-0 select-none">
                      _
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-sm text-white/50">
                    {movie.year && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-violet-400/50" />
                          <span className="tabular-nums">{movie.year}</span>
                        </div>
                        <span aria-hidden className="text-white/15">
                          ·
                        </span>
                      </>
                    )}
                    {movie.runtime_minutes && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-violet-400/50" />
                          <span className="tabular-nums">
                            {formatRuntime(movie.runtime_minutes)}
                          </span>
                        </div>
                        <span aria-hidden className="text-white/15">
                          ·
                        </span>
                      </>
                    )}
                    <div className="flex items-center gap-1.5">
                      {movie.status === "watched" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : movie.status === "watching" ? (
                        <PlayCircle className="h-3.5 w-3.5 text-violet-300" />
                      ) : (
                        <Film className="h-3.5 w-3.5 text-violet-400/50" />
                      )}
                      <span className="text-white/70">{watchStatusText}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {settings?.jellyfin_server_url && movie.jellyfin_id && (
                    <SidebarTooltip
                      placement="bottom"
                      label={
                        movie.completion_percentage > 0 ? "resume in jellyfin" : "play in jellyfin"
                      }
                    >
                      <a
                        href={buildJellyfinItemUrl(
                          settings.jellyfin_server_url,
                          movie.jellyfin_id,
                          settings.jellyfin_server_id,
                          "movie",
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          variant="outline"
                          size="icon"
                          className={DETAIL_ACTION_BTN_PRIMARY}
                          aria-label={
                            movie.completion_percentage > 0
                              ? "Resume in Jellyfin"
                              : "Play in Jellyfin"
                          }
                        >
                          <PlayCircle />
                        </Button>
                      </a>
                    </SidebarTooltip>
                  )}
                  {!movie.removed_from_library && (
                    <>
                      <SidebarTooltip placement="bottom" label="watchlist">
                        <AddRemoveWatchlistButton
                          itemType="movie"
                          itemId={movieId}
                          variant="outline"
                          size="icon"
                          iconOnly
                          className={DETAIL_ACTION_BTN}
                        />
                      </SidebarTooltip>
                      <SidebarTooltip placement="bottom" label="add to collection">
                        <AddToCollectionButton
                          itemType="movie"
                          itemId={movieId}
                          variant="outline"
                          size="icon"
                          iconOnly
                          className={DETAIL_ACTION_BTN}
                        />
                      </SidebarTooltip>
                      <SidebarTooltip placement="bottom" label="add tag">
                        <AddTagButton
                          itemType="movie"
                          itemId={movieId}
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
                        itemType="movie"
                        itemId={movieId}
                        itemTitle={movie.title}
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
                          itemType: "movie",
                          itemId: movieId,
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

              {movie.overview && (
                <p className="text-white/60 mb-6 leading-relaxed wrap-break-word">
                  {movie.overview}
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
                      deleteRating.mutate({ itemType: "movie", itemId: movieId });
                    } else {
                      setRating.mutate({
                        itemType: "movie",
                        itemId: movieId,
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
                        <Clock className="h-4 w-4 text-violet-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg sm:text-xl font-mono font-semibold text-white">
                          {Math.round(movie.total_watch_time_minutes / 60)}
                        </div>
                        <div className="text-[9px] sm:text-[10px] font-mono text-violet-300/65 uppercase tracking-[0.12em] select-none">
                          {"//"} hours
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="hover:bg-violet-500/5 transition-colors">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-2 rounded-sm bg-violet-500/10 border border-violet-500/30 shrink-0">
                        <RotateCcw className="h-4 w-4 text-violet-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg sm:text-xl font-mono font-semibold text-white">
                          {movie.watch_count}
                        </div>
                        <div className="text-[9px] sm:text-[10px] font-mono text-violet-300/65 uppercase tracking-[0.12em] select-none">
                          {"//"} watches
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
                          {Math.round(movie.completion_percentage)}%
                        </div>
                        <div className="text-[9px] sm:text-[10px] font-mono text-violet-300/65 uppercase tracking-[0.12em] select-none">
                          {"//"} complete
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {movie.first_watched_at && (
                  <Card className="hover:bg-violet-500/5 transition-colors">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-2 rounded-sm bg-violet-500/10 border border-violet-500/30 shrink-0">
                          <Eye className="h-4 w-4 text-violet-300" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-mono font-semibold text-white">
                            {new Date(movie.first_watched_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-[9px] sm:text-[10px] font-mono text-violet-300/65 uppercase tracking-[0.12em] select-none">
                            {"//"} first watched
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {movie.completion_percentage > 0 && movie.completion_percentage < 100 && (
                <div className="mb-6 p-3 sm:p-4 rounded-sm bg-[#07070d] border border-[#16162a] font-mono">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/50">
                      <span className="select-none text-violet-400/45">{"// "}</span>watch_progress
                    </span>
                    <span className="text-violet-200 tabular-nums">
                      {Math.round(movie.completion_percentage)}%
                    </span>
                  </div>
                  <div className="w-full bg-[#16162a] rounded-sm h-2 overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-[#8b5cf6] to-violet-400 transition-all"
                      style={{
                        width: `${Math.min(100, movie.completion_percentage)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {(movie.first_watched_at || movie.last_watched_at) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 text-sm font-mono">
                  {movie.first_watched_at && (
                    <div className="p-3 rounded-sm bg-[#07070d] border border-[#16162a]">
                      <span className="text-white/40 block mb-1">
                        <span className="select-none text-violet-400/45">{"// "}</span>first_watched
                      </span>
                      <span className="text-violet-100 tabular-nums">
                        {new Date(movie.first_watched_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {movie.last_watched_at && (
                    <div className="p-3 rounded-sm bg-[#07070d] border border-[#16162a]">
                      <span className="text-white/40 block mb-1">
                        <span className="select-none text-violet-400/45">{"// "}</span>last_watched
                      </span>
                      <span className="text-violet-100 tabular-nums">
                        {new Date(movie.last_watched_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <ReviewEditor
                review={review || null}
                onSave={(reviewText, notes) => {
                  createOrUpdateReview.mutate({
                    itemType: "movie",
                    itemId: movieId,
                    reviewText,
                    notes,
                  });
                }}
                onDelete={() => {
                  deleteReview.mutate({ itemType: "movie", itemId: movieId });
                }}
                isLoading={createOrUpdateReview.isPending}
                isDeleting={deleteReview.isPending}
              />

              <div className="flex flex-wrap gap-2.5 mt-6">
                {movie.imdb_id && (
                  <a
                    href={`https://www.imdb.com/title/${movie.imdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-sm border border-[#16162a] bg-[#0a0a14] px-3.5 font-mono text-xs text-white/60 transition-colors hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300"
                  >
                    imdb
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {movie.tmdb_id && (
                  <a
                    href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-sm border border-[#16162a] bg-[#0a0a14] px-3.5 font-mono text-xs text-white/60 transition-colors hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300"
                  >
                    tmdb
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
