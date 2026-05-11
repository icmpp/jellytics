"use client";

import { useState, useMemo, memo, type MouseEvent } from "react";
import { useWatchlist, type WatchlistItem } from "@/hooks/useWatchlist";
import { SimpleMediaGridPage } from "@/components/media";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bookmark, Film, Tv, Clock, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import { getImageUrl, getMoviePosterUrl, getShowPosterUrl, cn } from "@/lib/utils";
import { PosterImage } from "@/components/ui/poster-image";
import { RemoveFromWatchlistButton } from "@/components/watchlist";
import { useMovies } from "@/hooks/useMovies";
import { useShows } from "@/hooks/useShows";

const ABOVE_THE_FOLD_COUNT = 8;

const WatchlistCard = memo(function WatchlistCard({
  item,
  index = 0,
}: {
  item: WatchlistItem;
  index?: number;
}) {
  const isShow = item.item_type === "show";
  const href = isShow ? `/shows/${item.item_id}` : `/movies/${item.item_id}`;
  const posterSrc = item.jellyfin_id
    ? getImageUrl(isShow ? "shows" : "movies", item.jellyfin_id, "poster")
    : undefined;

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      href={href}
      aria-label={`View details for ${item.title}`}
      className="block min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div
        className={cn(
          "card-border group relative rounded-2xl p-[2px]",
          "shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5),0_1px_4px_-1px_rgba(0,0,0,0.35)]",
        )}
      >
        <div className="relative isolate aspect-2/3 w-full cursor-pointer overflow-hidden rounded-[calc(1rem-2px)] bg-zinc-950">
          <PosterImage
            src={posterSrc}
            alt={item.title}
            type={isShow ? "show" : "movie"}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            iconSize="h-10 w-10"
            showLabel={false}
            priority={index < ABOVE_THE_FOLD_COUNT}
          />

          {/* Bottom gradient */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/90 via-black/35 to-black/10"
          />

          {/* Type badge — top left */}
          <span
            aria-label={isShow ? "TV show" : "Movie"}
            className={cn(
              "absolute left-2 top-2 z-10",
              "flex h-7 w-7 items-center justify-center rounded-full",
              "bg-black/55 ring-1 ring-white/15 backdrop-blur-md",
            )}
          >
            {isShow ? (
              <Tv className="h-3.5 w-3.5 text-white/70" />
            ) : (
              <Film className="h-3.5 w-3.5 text-white/70" />
            )}
          </span>

          {/* Remove button — top right, always visible */}
          <div className="absolute right-2 top-2 z-10" onClick={stop}>
            <RemoveFromWatchlistButton
              watchlistItemId={item.id}
              showConfirmation
              variant="ghost"
              size="icon-sm"
              className={cn(
                "h-7 w-7 rounded-full backdrop-blur-md",
                "bg-black/55 ring-1 ring-white/15 text-white/60",
                "hover:bg-red-500/30 hover:text-red-300 hover:ring-red-500/40",
                "transition-all duration-150",
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </RemoveFromWatchlistButton>
          </div>

          {/* Bottom info */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 px-3 pb-3 pt-10">
            <h3
              className={cn(
                "line-clamp-2 text-[0.8125rem] font-semibold leading-snug tracking-tight text-white",
                "transition-colors duration-200 group-hover:text-primary/90",
              )}
            >
              {item.title}
            </h3>
            <p className="flex items-center gap-1 text-[10px] font-medium tabular-nums tracking-wide text-white/50">
              <Clock className="h-3 w-3 shrink-0" />
              {formatDistanceToNow(new Date(item.added_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
});

const EmptyWatchlist = memo(function EmptyWatchlist({
  typeFilter,
}: {
  typeFilter: "all" | "show" | "movie";
}) {
  const { data: moviesData } = useMovies({ limit: 4 });
  const { data: showsData } = useShows({ limit: 4 });

  const shown = useMemo(() => {
    const teasers: { id: number; title: string; type: "movie" | "show"; src: string }[] = [];
    if (typeFilter !== "show") {
      moviesData?.movies?.slice(0, 3).forEach((m) => {
        teasers.push({
          id: m.id,
          title: m.title,
          type: "movie",
          src: getMoviePosterUrl(m.jellyfin_id),
        });
      });
    }
    if (typeFilter !== "movie") {
      showsData?.shows?.slice(0, 3).forEach((s) => {
        teasers.push({
          id: s.id,
          title: s.title,
          type: "show",
          src: getShowPosterUrl(s.jellyfin_id),
        });
      });
    }
    return teasers.slice(0, 4);
  }, [moviesData, showsData, typeFilter]);

  return (
    <div className="flex flex-col items-center py-16 gap-8">
      {shown.length > 0 && (
        <div className="flex gap-3 opacity-60">
          {shown.map((t) => (
            <Link key={`${t.type}-${t.id}`} href={`/${t.type}s/${t.id}`}>
              <div className="relative w-20 aspect-2/3 rounded-xl overflow-hidden bg-white/4 border border-white/8 hover:opacity-90 transition-opacity">
                <Image src={t.src} alt={t.title} fill className="object-cover" sizes="80px" />
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="text-center">
        <Bookmark className="h-12 w-12 text-white/20 mx-auto mb-4" />
        <p className="text-white/60 text-lg mb-2 font-medium">
          {typeFilter === "all" ? "Your watchlist is empty" : `No ${typeFilter}s in your watchlist`}
        </p>
        <p className="text-sm text-white/35 mb-6 max-w-xs mx-auto">
          {typeFilter === "all"
            ? "Browse your library and save titles for later."
            : `Add some ${typeFilter}s to keep track of what you want to watch.`}
        </p>
        <div className="flex gap-3 justify-center">
          {typeFilter !== "movie" && (
            <Link href="/shows">
              <Button variant="outline" className="gap-2">
                <Tv className="h-4 w-4" />
                Browse Shows
              </Button>
            </Link>
          )}
          {typeFilter !== "show" && (
            <Link href="/movies">
              <Button variant="outline" className="gap-2">
                <Film className="h-4 w-4" />
                Browse Movies
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
});

type SortOrder = "date_added" | "title_asc" | "title_desc" | "type";

export default function WatchlistPage() {
  const [filter, setFilter] = useState<"all" | "show" | "movie">("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date_added");
  const { data, isLoading, isFetching } = useWatchlist();

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    return [...items]
      .filter((item) => (filter === "all" ? true : item.item_type === filter))
      .sort((a, b) => {
        if (sortOrder === "title_asc") return a.title.localeCompare(b.title);
        if (sortOrder === "title_desc") return b.title.localeCompare(a.title);
        if (sortOrder === "type") return a.item_type.localeCompare(b.item_type);
        return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
      });
  }, [data?.items, filter, sortOrder]);

  const breadcrumbItems = useMemo(
    () => [{ icon: "home" as const, href: "/dashboard" }, { label: "Watchlist" }],
    [],
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Select value={filter} onValueChange={(value: "all" | "show" | "movie") => setFilter(value)}>
        <SelectTrigger className="w-[130px] h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Items</SelectItem>
          <SelectItem value="show">Shows</SelectItem>
          <SelectItem value="movie">Movies</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sortOrder} onValueChange={(value: SortOrder) => setSortOrder(value)}>
        <SelectTrigger className="w-[150px] h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date_added">Date Added</SelectItem>
          <SelectItem value="title_asc">Title A–Z</SelectItem>
          <SelectItem value="title_desc">Title Z–A</SelectItem>
          <SelectItem value="type">Media Type</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <SimpleMediaGridPage<WatchlistItem>
      breadcrumb={breadcrumbItems}
      title="Watchlist"
      description="Your saved shows and movies"
      icon={<Bookmark className="h-6 w-6 sm:h-7 sm:w-7 text-purple-400 shrink-0" />}
      actions={actions}
      isLoading={isLoading}
      isError={!data && !isLoading}
      isFetching={isFetching}
      errorContent={
        <div className="flex flex-col items-center py-16 text-center">
          <Bookmark className="h-16 w-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/60 text-lg mb-2">Failed to load watchlist</p>
        </div>
      }
      isEmpty={filteredItems.length === 0}
      emptyContent={<EmptyWatchlist typeFilter={filter} />}
      items={filteredItems}
      renderCard={(item, index) => <WatchlistCard item={item} index={index} />}
      getItemKey={(item) => String(item.id)}
    />
  );
}
