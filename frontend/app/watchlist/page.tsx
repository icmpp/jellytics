"use client";

import { useState, useMemo, useId, useRef, useEffect, memo, type MouseEvent } from "react";
import { useWatchlist, type WatchlistItem } from "@/hooks/useWatchlist";
import { SimpleMediaGridPage, EmptyTerminal, TerminalAction } from "@/components/media";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Bookmark, Film, Tv, Clock, Trash2, ArrowUpDown, Search, X } from "lucide-react";
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
              "flex h-7 w-7 items-center justify-center rounded-sm",
              "bg-black/60 ring-1 ring-[#16162a] backdrop-blur-md",
            )}
          >
            {isShow ? (
              <Tv className="h-3.5 w-3.5 text-violet-300/70" />
            ) : (
              <Film className="h-3.5 w-3.5 text-violet-300/70" />
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
                "h-7 w-7 rounded-sm backdrop-blur-md",
                "bg-black/60 ring-1 ring-[#16162a] text-white/60",
                "hover:bg-red-500/20 hover:text-red-300 hover:ring-red-500/40",
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

  const noun = typeFilter === "all" ? "titles" : `${typeFilter}s`;

  return (
    <EmptyTerminal
      path="watchlist"
      statusLabel="empty"
      command={
        <>
          watchlist <span className="text-violet-300/70">--list</span>
          {typeFilter !== "all" && <span className="text-violet-300/70"> --type {typeFilter}</span>}
        </>
      }
      output={
        <>
          query returned <span className="tabular-nums text-white/70">0</span> {noun}
        </>
      }
      icon={Bookmark}
      headline={typeFilter === "all" ? "watchlist is empty" : `no ${typeFilter}s in watchlist`}
      subtext={
        typeFilter === "all"
          ? "browse your library and save titles for later"
          : `add some ${typeFilter}s to keep track of what you want to watch`
      }
      actions={
        <>
          {typeFilter !== "movie" && (
            <TerminalAction href="/shows" icon={Tv} label="browse_shows" />
          )}
          {typeFilter !== "show" && (
            <TerminalAction href="/movies" icon={Film} label="browse_movies" />
          )}
        </>
      }
    >
      {shown.length > 0 && (
        <div className="mt-7">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="select-none text-[11px] uppercase tracking-[0.2em] text-violet-400/55">
              # suggested
            </span>
            <div
              className="h-px flex-1"
              style={{ background: "linear-gradient(90deg, #16162a 60%, transparent)" }}
            />
          </div>
          <div className="flex justify-center gap-2.5">
            {shown.map((t) => (
              <Link
                key={`${t.type}-${t.id}`}
                href={`/${t.type}s/${t.id}`}
                className="group block w-[84px] shrink-0"
              >
                <div className="relative aspect-2/3 overflow-hidden rounded-sm border border-[#16162a] bg-[#0a0a14] transition-colors group-hover:border-violet-500/40">
                  <Image
                    src={t.src}
                    alt={t.title}
                    fill
                    className="object-cover opacity-70 transition-opacity group-hover:opacity-100"
                    sizes="84px"
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </EmptyTerminal>
  );
});

type SortOrder = "date_added" | "title_asc" | "title_desc" | "type";
type TypeFilter = "all" | "show" | "movie";

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "date_added", label: "date_added" },
  { value: "title_asc", label: "title_asc" },
  { value: "title_desc", label: "title_desc" },
  { value: "type", label: "media_type" },
];

/** Segmented type filter — mirrors the sidebar/StatusSegmented terminal control. */
function TypeSegmented({
  value,
  onChange,
  counts,
}: {
  value: TypeFilter;
  onChange: (v: TypeFilter) => void;
  counts: { all: number; show: number; movie: number };
}) {
  const layoutId = useId();
  const segments: { value: TypeFilter; label: string; count: number }[] = [
    { value: "all", label: "all", count: counts.all },
    { value: "show", label: "shows", count: counts.show },
    { value: "movie", label: "movies", count: counts.movie },
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter by media type"
      className="inline-flex h-11 items-stretch overflow-hidden rounded-sm border border-[#16162a] bg-[#06060d]"
    >
      {segments.map((seg) => {
        const active = value === seg.value;
        return (
          <button
            key={seg.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(seg.value)}
            className={cn(
              "group relative flex items-center gap-1.5 whitespace-nowrap border-r border-[#16162a] px-3 sm:px-4 text-xs font-mono transition-colors last:border-r-0",
              active ? "text-violet-300/90" : "text-white/40 hover:text-white/70",
            )}
          >
            {/* Sliding active highlight — mirrors the sidebar nav indicator */}
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 z-0 bg-[#07070d]"
                style={{ boxShadow: "inset 0 1.5px 0 #8b5cf6" }}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}

            <span
              className={cn(
                "relative z-10 w-2 shrink-0 select-none text-center",
                active
                  ? "text-violet-400 phosphor-glow"
                  : "text-violet-400/35 group-hover:text-violet-400/60",
              )}
              aria-hidden="true"
            >
              {active ? ">" : "·"}
            </span>

            <span
              className={cn(
                "relative z-10 transition-transform",
                !active && "group-hover:translate-x-0.5",
              )}
            >
              {seg.label}
              {active && <span className="cursor-blink ml-px text-violet-400/80">_</span>}
            </span>

            <span
              className={cn(
                "relative z-10 text-xs tabular-nums",
                active ? "text-violet-400/70" : "text-white/25",
              )}
            >
              {seg.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Sort select styled to match the library's terminal SortSelect. */
function WatchlistSort({ value, onChange }: { value: SortOrder; onChange: (v: SortOrder) => void }) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];

  return (
    <Select open={open} onOpenChange={setOpen} value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          "h-11 w-11 shrink-0 rounded-sm font-mono sm:w-auto sm:min-w-[170px]",
          "focus:ring-0 focus:border-violet-500/30 focus:bg-violet-500/10",
          "data-[state=open]:ring-0 data-[state=open]:border-violet-500/30 data-[state=open]:bg-violet-500/10 data-[state=open]:text-violet-300 data-[state=open]:[&_svg]:text-violet-300/70",
          open
            ? "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15"
            : "border-[#16162a] bg-[#0a0a14] hover:bg-[#0d0d1a]",
        )}
        title={`Sort: ${current.label}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            style={{ display: "flex" }}
          >
            <ArrowUpDown className="h-4 w-4 shrink-0 text-white/40" />
          </motion.div>
          <SelectValue>
            <span className="hidden truncate sm:block">{current.label}</span>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent
        align="end"
        collisionPadding={8}
        className="max-w-[220px] rounded-sm border-[#16162a] bg-[#07070d] font-mono"
      >
        {SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="rounded-sm text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Terminal-styled title filter with a `/`-to-focus affordance (mirrors MediaFilters). */
function WatchlistSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative min-w-48 flex-1">
      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
      <Input
        ref={ref}
        placeholder="search watchlist..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="Search watchlist"
        className="h-11 rounded-sm border-[#16162a] bg-[#0a0a14] pl-10 pr-9 font-mono focus:border-violet-500/50 focus:bg-[#0d0d1a] focus:ring-violet-500/20"
      />
      <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {value ? (
          <button
            className="rounded-sm p-1 text-white/40 transition-colors hover:bg-[#0d0d1a] hover:text-white"
            onClick={() => onChange("")}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          !focused && (
            <kbd
              className="hidden select-none rounded-sm px-1.5 py-0.5 text-[10px] font-mono text-violet-300/70 sm:block"
              style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}
            >
              /
            </kbd>
          )
        )}
      </div>
    </div>
  );
}

/** No-results state shown when a search query matches nothing. */
function WatchlistNoMatch({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <EmptyTerminal
      path="watchlist"
      statusLabel="no match"
      command={
        <>
          watchlist <span className="text-violet-300/70">search &quot;{query}&quot;</span>
        </>
      }
      output={
        <>
          query returned <span className="tabular-nums text-white/70">0</span> results
        </>
      }
      icon={Search}
      headline={`no results for "${query}"`}
      subtext="try a different search or clear your filters"
      actions={<TerminalAction icon={X} label="clear_search" onClick={onClear} />}
    />
  );
}

export default function WatchlistPage() {
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date_added");
  const [query, setQuery] = useState("");
  const { data, isLoading, isFetching } = useWatchlist();

  const normalizedQuery = query.trim().toLowerCase();
  const hasItems = (data?.items?.length ?? 0) > 0;
  const savedTotal = data?.total ?? 0;

  // Segment counts reflect the active search so the tabs stay honest while typing.
  const counts = useMemo(() => {
    const items = data?.items ?? [];
    const matched = normalizedQuery
      ? items.filter((item) => item.title.toLowerCase().includes(normalizedQuery))
      : items;
    let show = 0;
    for (const item of matched) if (item.item_type === "show") show += 1;
    return { all: matched.length, show, movie: matched.length - show };
  }, [data?.items, normalizedQuery]);

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    return [...items]
      .filter((item) => (filter === "all" ? true : item.item_type === filter))
      .filter((item) => (normalizedQuery ? item.title.toLowerCase().includes(normalizedQuery) : true))
      .sort((a, b) => {
        if (sortOrder === "title_asc") return a.title.localeCompare(b.title);
        if (sortOrder === "title_desc") return b.title.localeCompare(a.title);
        if (sortOrder === "type") return a.item_type.localeCompare(b.item_type);
        return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
      });
  }, [data?.items, filter, sortOrder, normalizedQuery]);

  const breadcrumbItems = useMemo(
    () => [{ icon: "home" as const, href: "/dashboard" }, { label: "Watchlist" }],
    [],
  );

  // Toolbar only matters once there's something to filter.
  const toolbar = hasItems ? (
    <div className="flex flex-wrap items-center gap-2">
      <WatchlistSearch value={query} onChange={setQuery} />
      <TypeSegmented value={filter} onChange={setFilter} counts={counts} />
      <WatchlistSort value={sortOrder} onChange={setSortOrder} />
    </div>
  ) : undefined;

  return (
    <SimpleMediaGridPage<WatchlistItem>
      breadcrumb={breadcrumbItems}
      title="Watchlist"
      description={
        savedTotal > 0
          ? `${savedTotal.toLocaleString()} ${savedTotal === 1 ? "title" : "titles"} saved to watch later`
          : "saved to watch later"
      }
      toolbar={toolbar}
      isLoading={isLoading}
      isError={!data && !isLoading}
      isFetching={isFetching}
      errorContent={
        <div className="flex flex-col items-center py-20 text-center font-mono">
          <Bookmark className="mb-5 h-10 w-10 text-violet-400/30" />
          <p className="mb-1.5 text-base text-white/70">
            <span className="select-none text-red-400/70">{"! "}</span>failed to load watchlist
          </p>
          <p className="text-xs text-violet-300/45">
            <span className="select-none text-violet-400/45">{"# "}</span>something went wrong,
            please try again
          </p>
        </div>
      }
      isEmpty={filteredItems.length === 0}
      emptyContent={
        normalizedQuery ? (
          <WatchlistNoMatch
            query={query.trim()}
            onClear={() => {
              setQuery("");
              setFilter("all");
            }}
          />
        ) : (
          <EmptyWatchlist typeFilter={filter} />
        )
      }
      items={filteredItems}
      renderCard={(item, index) => <WatchlistCard item={item} index={index} />}
      getItemKey={(item) => String(item.id)}
    />
  );
}
