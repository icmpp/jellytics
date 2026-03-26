"use client";

import { useState, useMemo, memo } from "react";
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
import {
  getImageUrl,
  getMoviePosterUrl,
  getShowPosterUrl,
  cn,
  MEDIA_CARD_BASE,
  MEDIA_CARD_TITLE_CLASS,
} from "@/lib/utils";
import { PosterImage } from "@/components/ui/poster-image";
import { RemoveFromWatchlistButton } from "@/components/watchlist";
import { useMovies } from "@/hooks/useMovies";
import { useShows } from "@/hooks/useShows";

const ABOVE_THE_FOLD_COUNT = 8; // Eager-load images for first ~2 rows

const WatchlistCard = memo(function WatchlistCard({
  item,
  index = 0,
}: {
  item: WatchlistItem;
  index?: number;
}) {
  const isShow = item.item_type === "show";
  const href = isShow ? `/shows/${item.item_id}` : `/movies/${item.item_id}`;
  const loadImageEagerly = index < ABOVE_THE_FOLD_COUNT;

  return (
    <Link
      href={href}
      className={cn(MEDIA_CARD_BASE, "block min-w-0 h-full flex flex-col group relative cursor-pointer")}
    >
      <div
        className="absolute top-2 right-2 z-10"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <RemoveFromWatchlistButton
          watchlistItemId={item.id}
          showConfirmation={true}
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 rounded-lg bg-black/60 border border-white/20 text-white/80 hover:bg-red-500/30 hover:text-red-300 hover:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
        >
          <Trash2 className="h-4 w-4" />
        </RemoveFromWatchlistButton>
      </div>

      <div className="relative aspect-[2/3] w-full overflow-hidden shrink-0">
        <PosterImage
          src={
            item.jellyfin_id
              ? getImageUrl(
                  isShow ? "shows" : "movies",
                  item.jellyfin_id,
                  "poster",
                )
              : undefined
          }
          alt={item.title}
          type={isShow ? "show" : "movie"}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          hoverScale
          iconSize="h-12 w-12"
          showLabel={false}
          priority={loadImageEagerly}
        />
      </div>

      <div className="p-4 flex-1 min-h-0 flex flex-col">
        <h3 className={cn(MEDIA_CARD_TITLE_CLASS, "group-hover:text-purple-400 transition-colors")}>
          {item.title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <Clock className="h-3 w-3" />
          <span>
            Added{" "}
            {formatDistanceToNow(new Date(item.added_at), {
              addSuffix: true,
            })}
          </span>
        </div>
      </div>
    </Link>
  );
});

const EmptyWatchlist = memo(function EmptyWatchlist({ typeFilter }: { typeFilter: "all" | "show" | "movie" }) {
  const { data: moviesData } = useMovies({ limit: 4 });
  const { data: showsData } = useShows({ limit: 4 });

  const shown = useMemo(() => {
    const teasers: { id: number; title: string; type: "movie" | "show"; src: string }[] = [];
    if (typeFilter !== "show") {
      moviesData?.movies?.slice(0, 3).forEach((m) => {
        teasers.push({ id: m.id, title: m.title, type: "movie", src: getMoviePosterUrl(m.jellyfin_id) });
      });
    }
    if (typeFilter !== "movie") {
      showsData?.shows?.slice(0, 3).forEach((s) => {
        teasers.push({ id: s.id, title: s.title, type: "show", src: getShowPosterUrl(s.jellyfin_id) });
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
              <div className="relative w-20 aspect-[2/3] rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.08] hover:opacity-90 transition-opacity">
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
    () => [
      { icon: "home" as const, href: "/dashboard" },
      { label: "Watchlist" },
    ],
    [],
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Select
        value={filter}
        onValueChange={(value: "all" | "show" | "movie") => setFilter(value)}
      >
        <SelectTrigger className="w-[130px] h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Items</SelectItem>
          <SelectItem value="show">Shows</SelectItem>
          <SelectItem value="movie">Movies</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={sortOrder}
        onValueChange={(value: SortOrder) => setSortOrder(value)}
      >
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
      countLabel={`${filteredItems.length} ${filteredItems.length === 1 ? "item" : "items"} in watchlist`}
      items={filteredItems}
      renderCard={(item, index) => (
        <WatchlistCard item={item} index={index} />
      )}
      getItemKey={(item) => String(item.id)}
    />
  );
}
