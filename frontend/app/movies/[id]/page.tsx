"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useMovie } from "@/hooks/useMovies";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading-skeleton";
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
import Link from "next/link";
import Image from "next/image";
import { AddRemoveWatchlistButton } from "@/components/watchlist/AddRemoveWatchlistButton";
import { AddToCollectionButton } from "@/components/collections";
import { AddTagButton, TagBadge } from "@/components/media";
import { RemoveFromLibraryButton } from "@/components/library/RemoveFromLibraryButton";
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
        <div className="text-center py-16">
          <Film className="h-16 w-16 text-white/20 mx-auto mb-4" />
          <p className="text-red-400 text-lg mb-2">Movie not found</p>
          <p className="text-white/40 text-sm mb-6">
            The movie you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link href="/movies">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Movies
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const watchStatusText = getWatchStatusText(movie.status, {
    watchCount: movie.watch_count,
    mediaType: "movie",
  });

  return (
    <AppLayout>
      <div className="flex justify-start mb-4 md:mb-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {movie.removed_from_library && (
        <div className="mb-4 md:mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
          <Archive className="h-4 w-4 shrink-0" />
          <span>Removed from library. Viewing preserved data.</span>
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
                <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-3 wrap-break-word">
                  {movie.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-white/50">
                  {movie.year && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      <span>{movie.year}</span>
                    </div>
                  )}
                  {movie.runtime_minutes && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      <span>{formatRuntime(movie.runtime_minutes)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {movie.status === "watched" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : movie.status === "watching" ? (
                      <PlayCircle className="h-4 w-4 text-blue-400" />
                    ) : (
                      <Film className="h-4 w-4" />
                    )}
                    <span>{watchStatusText}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {settings?.jellyfin_server_url && movie.jellyfin_id && (
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
                      aria-label={
                        movie.completion_percentage > 0 ? "Resume in Jellyfin" : "Play in Jellyfin"
                      }
                    >
                      <PlayCircle className="size-6" />
                    </Button>
                  </a>
                )}
                {!movie.removed_from_library && (
                  <>
                    <AddRemoveWatchlistButton
                      itemType="movie"
                      itemId={movieId}
                      variant="outline"
                      size="icon"
                      iconOnly
                    />
                    <AddToCollectionButton
                      itemType="movie"
                      itemId={movieId}
                      variant="outline"
                      size="icon"
                      iconOnly
                    />
                    <AddTagButton
                      itemType="movie"
                      itemId={movieId}
                      variant="outline"
                      size="icon"
                      iconOnly
                    />
                    <RemoveFromLibraryButton
                      itemType="movie"
                      itemId={movieId}
                      itemTitle={movie.title}
                      variant="outline"
                      size="icon"
                      iconOnly
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
                        itemType: "movie",
                        itemId: movieId,
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

            {movie.overview && (
              <p className="text-white/60 mb-6 leading-relaxed wrap-break-word">{movie.overview}</p>
            )}

            <div className="mb-6">
              <label className="text-sm font-medium text-white/40 mb-3 block">Your Rating</label>
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
              <Card className="hover:bg-white/5 transition-colors">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30 shrink-0">
                      <Clock className="h-4 w-4 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-bold text-white">
                        {Math.round(movie.total_watch_time_minutes / 60)}
                      </div>
                      <div className="text-xs text-white/40">Hours</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover:bg-white/5 transition-colors">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30 shrink-0">
                      <RotateCcw className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-bold text-white">
                        {movie.watch_count}
                      </div>
                      <div className="text-xs text-white/40">Watches</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover:bg-white/5 transition-colors">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 shrink-0">
                      <Percent className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-bold text-white">
                        {Math.round(movie.completion_percentage)}%
                      </div>
                      <div className="text-xs text-white/40">Complete</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {movie.first_watched_at && (
                <Card className="hover:bg-white/5 transition-colors">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30 shrink-0">
                        <Eye className="h-4 w-4 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white">
                          {new Date(movie.first_watched_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-xs text-white/40">First Watched</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {movie.completion_percentage > 0 && movie.completion_percentage < 100 && (
              <div className="mb-6 p-3 sm:p-4 rounded-xl bg-white/3 border border-white/8">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/50">Watch Progress</span>
                  <span className="font-medium text-white">
                    {Math.round(movie.completion_percentage)}%
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-purple-500 to-purple-400 transition-all"
                    style={{
                      width: `${Math.min(100, movie.completion_percentage)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {(movie.first_watched_at || movie.last_watched_at) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 text-sm">
                {movie.first_watched_at && (
                  <div className="p-3 rounded-xl bg-white/3 border border-white/8">
                    <span className="text-white/40 block mb-1">First Watched</span>
                    <span className="text-white font-medium">
                      {new Date(movie.first_watched_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {movie.last_watched_at && (
                  <div className="p-3 rounded-xl bg-white/3 border border-white/8">
                    <span className="text-white/40 block mb-1">Last Watched</span>
                    <span className="text-white font-medium">
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

            <div className="flex flex-wrap gap-3 mt-6">
              {movie.imdb_id && (
                <a
                  href={`https://www.imdb.com/title/${movie.imdb_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    IMDB
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </Button>
                </a>
              )}
              {movie.tmdb_id && (
                <a
                  href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    TMDB
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
