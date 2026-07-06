"use client";

import { useState, useMemo, useCallback, useId, memo } from "react";
import { useWatchHistory, type WatchHistoryItem } from "@/hooks/useWatchHistory";
import { AppLayout, PageHeader, PageContent } from "@/components/layout";
import { EmptyTerminal, TerminalAction } from "@/components/media";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Archive,
  Calendar,
  CalendarDays,
  Clock,
  Film,
  Tv,
  ChevronRight,
  History,
  LayoutList,
  Loader2,
  Filter,
  X,
  ExternalLink,
  PlayCircle,
  CheckCircle2,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import { cn, formatRuntime, resolvePosterUrl } from "@/lib/utils";
import { HistoryCalendar } from "@/components/history/HistoryCalendar";

function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "today";
  if (isYesterday(date)) return "yesterday";
  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) {
    return format(date, "EEE, MMM d").toLowerCase();
  }
  return format(date, "EEE, MMM d, yyyy").toLowerCase();
}

/** Terminal date-group divider — mirrors the watchlist "# suggested" rule. */
function DateGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-4 flex items-center gap-2.5 font-mono">
      <span className="whitespace-nowrap text-xs text-violet-300/70">
        <span className="select-none text-violet-400/45">{"# "}</span>
        {label}
      </span>
      <span className="whitespace-nowrap text-[11px] tabular-nums text-white/30">
        {count} {count === 1 ? "item" : "items"}
      </span>
      <div
        className="h-px flex-1"
        style={{ background: "linear-gradient(90deg, #16162a 60%, transparent)" }}
      />
    </div>
  );
}

/** Terminal summary strip — totals for the currently filtered history. */
function HistoryStats({ items }: { items: WatchHistoryItem[] }) {
  const stats = useMemo(() => {
    let minutes = 0;
    let episodes = 0;
    for (const it of items) {
      minutes += it.totalWatchTime ?? it.duration ?? 0;
      if (it.type === "episode") episodes += 1;
    }
    return { total: items.length, minutes, episodes, movies: items.length - episodes };
  }, [items]);

  const cells: { label: string; value: string }[] = [
    { label: "entries", value: stats.total.toLocaleString() },
    { label: "watch_time", value: formatRuntime(stats.minutes) ?? "0m" },
    { label: "episodes", value: stats.episodes.toLocaleString() },
    { label: "movies", value: stats.movies.toLocaleString() },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-sm border border-[#16162a] bg-[#0a0a14] px-4 py-3 font-mono transition-colors hover:border-violet-500/25"
        >
          <p className="text-[11px] text-violet-300/45">
            <span className="select-none text-violet-400/40">{"# "}</span>
            {c.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-white/90">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

/** Two-segment list/calendar toggle styled like StatusSegmented. */
function ViewModeSegmented({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const layoutId = useId();
  const segments: { value: ViewMode; label: string; icon: typeof LayoutList }[] = [
    { value: "list", label: "list", icon: LayoutList },
    { value: "calendar", label: "calendar", icon: CalendarDays },
  ];

  return (
    <div
      role="tablist"
      aria-label="View mode"
      className="inline-flex h-11 items-stretch overflow-hidden rounded-sm border border-[#16162a] bg-[#06060d]"
    >
      {segments.map((seg) => {
        const active = value === seg.value;
        const Icon = seg.icon;
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
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 z-0 bg-[#07070d]"
                style={{ boxShadow: "inset 0 1.5px 0 #8b5cf6" }}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <Icon
              className={cn(
                "relative z-10 h-3.5 w-3.5 shrink-0",
                active ? "text-violet-400 phosphor-glow" : "text-violet-400/35",
              )}
            />
            <span className="relative z-10">
              {seg.label}
              {active && <span className="cursor-blink ml-px text-violet-400/80">_</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Terminal-styled select, mirroring the library's SortSelect. */
function TerminalSelect<T extends string>({
  value,
  onChange,
  options,
  icon: Icon,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  icon: typeof Filter;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <Select
      open={open}
      onOpenChange={setOpen}
      value={value}
      onValueChange={(v) => onChange(v as T)}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "h-11 w-auto min-w-[130px] shrink-0 rounded-sm font-mono",
          "focus:ring-0 focus:border-violet-500/30 focus:bg-violet-500/10",
          "data-[state=open]:ring-0 data-[state=open]:border-violet-500/30 data-[state=open]:bg-violet-500/10 data-[state=open]:text-violet-300 data-[state=open]:[&_svg]:text-violet-300/70",
          open
            ? "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15"
            : "border-[#16162a] bg-[#0a0a14] hover:bg-[#0d0d1a]",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-white/40" />
          <SelectValue>
            <span className="truncate">{current.label}</span>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent
        align="end"
        collisionPadding={8}
        className="max-w-[220px] rounded-sm border-[#16162a] bg-[#07070d] font-mono"
      >
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="rounded-sm text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DetailSheet({ item, onClose }: { item: WatchHistoryItem | null; onClose: () => void }) {
  if (!item) return null;

  const detailHref =
    item.type === "episode" && item.showId
      ? `/shows/${item.showId}`
      : item.type === "movie" && item.movieId
        ? `/movies/${item.movieId}`
        : null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full min-w-0 max-w-sm flex-col overflow-hidden border-l border-[#16162a] bg-[#07070d] font-mono shadow-2xl">
        {/* Terminal chrome header */}
        <div
          className="flex items-center justify-between border-b border-[#16162a] px-5 py-3.5"
          style={{ background: "#06060d" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#ef4444]/70" />
              <div className="h-2 w-2 rounded-full bg-[#f59e0b]/70" />
              <div className="h-2 w-2 rounded-full bg-[#22c55e]/70" />
            </div>
            <span className="text-xs text-violet-400/70">
              <span className="select-none text-white/30">{"# "}</span>watch details
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm p-1 text-white/40 transition-colors hover:bg-[#0d0d1a] hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex gap-4">
            {resolvePosterUrl(item.posterUrl) && (
              <div className="relative aspect-2/3 w-20 shrink-0 overflow-hidden rounded-sm border border-[#16162a]">
                <Image
                  src={resolvePosterUrl(item.posterUrl)!}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-sm border border-violet-500/15 bg-violet-500/5">
                  {item.type === "episode" ? (
                    <Tv className="h-3 w-3 text-violet-400/70" />
                  ) : (
                    <Film className="h-3 w-3 text-violet-400/70" />
                  )}
                </span>
                <span className="text-xs lowercase text-white/40">
                  {item.type === "episode" ? "show" : "movie"}
                </span>
              </div>
              <h3 className="mb-1 text-base font-semibold leading-tight text-white">
                {item.title}
              </h3>
              {item.showTitle && <p className="text-sm text-white/50">{item.showTitle}</p>}
            </div>
          </div>

          <div className="space-y-3">
            <InfoRow
              label="last watched"
              value={format(parseISO(item.watchedAt), "PPP p")}
              icon={<Calendar className="h-3.5 w-3.5" />}
            />
            {item.firstWatchedAt && item.firstWatchedAt !== item.watchedAt && (
              <InfoRow
                label="first watched"
                value={format(parseISO(item.firstWatchedAt), "PPP")}
                icon={<Clock className="h-3.5 w-3.5" />}
              />
            )}
            {item.totalWatchTime !== undefined && item.totalWatchTime > 0 && (
              <InfoRow
                label="total watch time"
                value={formatRuntime(item.totalWatchTime) ?? "—"}
                icon={<Clock className="h-3.5 w-3.5" />}
              />
            )}
            {item.watchCount !== undefined && item.watchCount > 0 && (
              <InfoRow
                label={item.type === "episode" ? "episodes watched" : "times watched"}
                value={item.watchCount.toString()}
                icon={<PlayCircle className="h-3.5 w-3.5" />}
              />
            )}
            {item.completionPercentage !== undefined && item.completionPercentage > 0 && (
              <InfoRow
                label="completion"
                value={`${Math.round(item.completionPercentage)}%`}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              />
            )}
            {item.status && (
              <div className="flex items-center justify-between">
                <span className="text-xs lowercase text-white/40">status</span>
                <span
                  className={cn(
                    "rounded-sm border px-2 py-0.5 text-xs lowercase",
                    item.status === "watched"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : item.status === "watching"
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                        : "border-[#16162a] bg-[#0a0a14] text-white/40",
                  )}
                >
                  {item.status}
                </span>
              </div>
            )}
          </div>

          {item.completionPercentage !== undefined && item.completionPercentage > 0 && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-inset ring-white/6">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${Math.min(item.completionPercentage, 100)}%` }}
              />
            </div>
          )}
        </div>

        {detailHref && (
          <div className="border-t border-[#16162a] p-5">
            <Link
              href={detailHref}
              onClick={onClose}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-sm border border-[#16162a] bg-[#0a0a14] text-sm text-white/70 transition-colors hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300"
            >
              <ExternalLink className="h-4 w-4" />
              view full details
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-xs lowercase text-white/40">
        {icon}
        {label}
      </div>
      <span className="text-xs font-medium text-white/70">{value}</span>
    </div>
  );
}

const HistoryItemCard = memo(function HistoryItemCard({
  item,
  onSelect,
}: {
  item: WatchHistoryItem;
  onSelect: (item: WatchHistoryItem) => void;
}) {
  const removed = item.removedFromLibrary;
  const posterSrc = resolvePosterUrl(item.posterUrl);
  const watched = parseISO(item.watchedAt);
  const absTime = format(watched, "h:mm a").toLowerCase();
  const relTime = formatDistanceToNow(watched, { addSuffix: true });
  const durationLabel = item.duration
    ? `${Math.floor(item.duration / 60)}h ${item.duration % 60}m`
    : null;
  const pct =
    typeof item.completionPercentage === "number" && item.completionPercentage > 0
      ? Math.round(Math.min(item.completionPercentage, 100))
      : null;

  return (
    <button onClick={() => onSelect(item)} className="group w-full text-left">
      <div
        className={cn(
          "flex items-stretch gap-3.5 rounded-sm border p-3.5 font-mono transition-colors",
          removed
            ? "border-amber-500/25 bg-amber-500/3 hover:border-amber-500/40 hover:bg-amber-500/6"
            : "border-[#16162a] bg-[#0a0a14] hover:border-violet-500/30 hover:bg-[#0d0d1a]",
        )}
      >
        {/* Leading thumb — poster, or a type-icon fallback so every row keeps a left anchor */}
        <div
          className={cn(
            "relative h-18 w-12 shrink-0 overflow-hidden rounded-sm border",
            removed ? "border-amber-500/20" : "border-[#16162a]",
          )}
        >
          {posterSrc ? (
            <Image src={posterSrc} alt={item.title} fill className="object-cover" sizes="48px" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-[#06060d]">
              {item.type === "episode" ? (
                <Tv
                  className={cn("h-5 w-5", removed ? "text-amber-400/50" : "text-violet-400/40")}
                />
              ) : (
                <Film
                  className={cn("h-5 w-5", removed ? "text-amber-400/50" : "text-violet-400/40")}
                />
              )}
            </span>
          )}
        </div>

        {/* Title → subtitle → meta, flush-left for a single clean reading column */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                "truncate text-sm font-semibold transition-colors",
                removed
                  ? "text-white/70 group-hover:text-amber-400/90"
                  : "text-white/90 group-hover:text-violet-300",
              )}
            >
              {item.title}
            </h3>
            {removed && (
              <span title="Removed from library" className="shrink-0">
                <Archive className="h-3.5 w-3.5 text-amber-400/70" aria-hidden />
              </span>
            )}
          </div>

          {(item.showTitle ||
            (item.seasonNumber !== undefined && item.episodeNumber !== undefined)) && (
            <p className="truncate text-xs text-white/50">
              {item.showTitle}
              {item.seasonNumber !== undefined && item.episodeNumber !== undefined && (
                <span className="tabular-nums text-white/35">
                  {item.showTitle ? " · " : ""}S{item.seasonNumber} E{item.episodeNumber}
                </span>
              )}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/40">
            <span
              className={cn(
                "flex items-center gap-1",
                removed ? "text-amber-400/60" : "text-violet-300/55",
              )}
            >
              {item.type === "episode" ? <Tv className="h-3 w-3" /> : <Film className="h-3 w-3" />}
              {item.type === "episode" ? "show" : "movie"}
            </span>
            {durationLabel && (
              <>
                <span className="text-white/20">·</span>
                <span className="tabular-nums">{durationLabel}</span>
              </>
            )}
            {pct !== null && (
              <>
                <span className="text-white/20">·</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1 w-12 overflow-hidden rounded-full bg-black/40 ring-1 ring-inset ring-white/6">
                    <span
                      className="block h-full rounded-full bg-violet-500"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="text-[10px] tabular-nums text-white/40">{pct}%</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* When + affordance, centered against the row height */}
        <div className="flex shrink-0 items-center gap-2.5 self-center sm:gap-3">
          <div className="flex flex-col items-end gap-0.5 text-right">
            <span className="text-xs tabular-nums text-white/55">{absTime}</span>
            <span className="hidden text-[11px] tabular-nums text-white/30 sm:block">
              {relTime}
            </span>
          </div>
          <ChevronRight className="h-5 w-5 text-white/20 transition-all group-hover:translate-x-0.5 group-hover:text-violet-400" />
        </div>
      </div>
    </button>
  );
});

type ViewMode = "list" | "calendar";

const TYPE_OPTIONS: { value: "all" | "episode" | "movie"; label: string }[] = [
  { value: "all", label: "all_items" },
  { value: "episode", label: "episodes" },
  { value: "movie", label: "movies" },
];

const TIME_OPTIONS: { value: "all" | "today" | "week" | "month"; label: string }[] = [
  { value: "all", label: "all_time" },
  { value: "today", label: "today" },
  { value: "week", label: "this_week" },
  { value: "month", label: "this_month" },
];

export default function HistoryPage() {
  const [filter, setFilter] = useState<"all" | "episode" | "movie">("all");
  const [timeRange, setTimeRange] = useState<"all" | "today" | "week" | "month">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedItem, setSelectedItem] = useState<WatchHistoryItem | null>(null);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);

  const {
    data: history,
    isLoading,
    isError,
    refetch,
  } = useWatchHistory({
    limit: 500,
    type: filter,
  });

  const filteredHistory = useMemo(() => {
    return (
      history?.filter((item) => {
        if (filter !== "all" && item.type !== filter) return false;

        const watchedDate = parseISO(item.watchedAt);
        const now = new Date();

        switch (timeRange) {
          case "today":
            return isToday(watchedDate);
          case "week":
            return watchedDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          case "month":
            return watchedDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          default:
            return true;
        }
      }) ?? []
    );
  }, [history, filter, timeRange]);

  const { grouped, sortedDates } = useMemo(() => {
    const grouped: Record<string, WatchHistoryItem[]> = {};
    for (const item of filteredHistory) {
      const dateKey = format(parseISO(item.watchedAt), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(item);
    }
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    return { grouped, sortedDates };
  }, [filteredHistory]);

  const calendarFilteredItems = useMemo(() => {
    if (!calendarSelectedDate) return filteredHistory;
    return filteredHistory.filter(
      (item) => format(parseISO(item.watchedAt), "yyyy-MM-dd") === calendarSelectedDate,
    );
  }, [filteredHistory, calendarSelectedDate]);

  const handleSelectItem = useCallback((item: WatchHistoryItem) => {
    setSelectedItem(item);
  }, []);

  const handleCloseDetailSheet = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const breadcrumbItems = useMemo(
    () => [{ icon: "home" as const, href: "/dashboard" }, { label: "History" }],
    [],
  );

  return (
    <AppLayout>
      <PageHeader
        breadcrumb={breadcrumbItems}
        title="Watch History"
        description="your viewing timeline"
        actions={
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <ViewModeSegmented value={viewMode} onChange={setViewMode} />
            <TerminalSelect
              value={filter}
              onChange={setFilter}
              options={TYPE_OPTIONS}
              icon={Filter}
              ariaLabel="Filter by type"
            />
            <TerminalSelect
              value={timeRange}
              onChange={setTimeRange}
              options={TIME_OPTIONS}
              icon={Calendar}
              ariaLabel="Filter by time range"
            />
          </div>
        }
      />
      <PageContent>
        {isLoading && (
          <div className="flex items-center justify-center py-20 font-mono">
            <div className="flex items-center gap-2.5 text-xs text-violet-300/60">
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
              <span>
                <span className="select-none text-violet-400/60">$ </span>loading watch history...
              </span>
            </div>
          </div>
        )}

        {!isLoading && isError && (
          <div className="flex flex-col items-center py-20 text-center font-mono">
            <History className="mb-5 h-10 w-10 text-violet-400/30" />
            <p className="mb-1.5 text-base text-white/70">
              <span className="select-none text-red-400/70">{"! "}</span>failed to load watch
              history
            </p>
            <p className="mb-5 text-xs text-violet-300/45">
              <span className="select-none text-violet-400/45">{"# "}</span>something went wrong,
              please try again
            </p>
            <TerminalAction label="retry" onClick={() => refetch()} />
          </div>
        )}

        {!isLoading && !isError && filteredHistory.length === 0 && (
          <EmptyTerminal
            path="history"
            statusLabel="empty"
            command={
              <>
                history <span className="text-violet-300/70">--list</span>
              </>
            }
            output={
              <>
                query returned <span className="tabular-nums text-white/70">0</span> entries
              </>
            }
            icon={History}
            headline="no watch history found"
            subtext="try adjusting your filters or start watching some content"
            actions={
              <>
                <TerminalAction href="/movies" icon={Film} label="browse_movies" />
                <TerminalAction href="/shows" icon={Tv} label="browse_shows" />
              </>
            }
          />
        )}

        {!isLoading && !isError && filteredHistory.length > 0 && (
          <HistoryStats items={filteredHistory} />
        )}

        {!isLoading && filteredHistory.length > 0 && viewMode === "calendar" && (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <HistoryCalendar
              items={filteredHistory}
              selectedDate={calendarSelectedDate}
              onSelectDate={setCalendarSelectedDate}
            />
            <div className="space-y-4">
              {calendarSelectedDate ? (
                <>
                  <DateGroupHeader
                    label={formatDateHeader(calendarSelectedDate)}
                    count={calendarFilteredItems.length}
                  />
                  <div className="grid gap-3">
                    {calendarFilteredItems.map((item) => (
                      <HistoryItemCard key={item.id} item={item} onSelect={handleSelectItem} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-[200px] items-center justify-center rounded-sm border border-[#16162a] bg-[#0a0a14] font-mono">
                  <p className="text-xs text-violet-300/40">
                    <span className="select-none text-violet-400/40">{"# "}</span>select a day to
                    see what you watched
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {!isLoading && filteredHistory.length > 0 && viewMode === "list" && (
          <div className="space-y-8">
            {sortedDates.map((dateKey) => {
              const items = grouped[dateKey];
              return (
                <div key={dateKey} className="space-y-4">
                  <DateGroupHeader label={formatDateHeader(dateKey)} count={items.length} />
                  <div className="grid gap-3">
                    {items.map((item) => (
                      <HistoryItemCard key={item.id} item={item} onSelect={handleSelectItem} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DetailSheet item={selectedItem} onClose={handleCloseDetailSheet} />
      </PageContent>
    </AppLayout>
  );
}
