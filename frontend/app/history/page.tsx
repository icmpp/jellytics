"use client";

import { useState, useMemo, useCallback, memo } from "react";
import { useWatchHistory, type WatchHistoryItem } from "@/hooks/useWatchHistory";
import { AppLayout, PageHeader, PageContent } from "@/components/layout";
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
  X,
  ExternalLink,
  PlayCircle,
  CheckCircle2,
} from "lucide-react";
import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  parseISO,
} from "date-fns";
import Link from "next/link";
import Image from "next/image";
import { formatRuntime, resolvePosterUrl, PROGRESS_BAR_CLASS } from "@/lib/utils";
import { HistoryCalendar } from "@/components/history/HistoryCalendar";

function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) {
    return format(date, "EEE, MMM d");
  }
  return format(date, "EEE, MMM d, yyyy");
}

function DetailSheet({
  item,
  onClose,
}: {
  item: WatchHistoryItem | null;
  onClose: () => void;
}) {
  if (!item) return null;

  const detailHref =
    item.type === "episode" && item.showId
      ? `/shows/${item.showId}`
      : item.type === "movie" && item.movieId
        ? `/movies/${item.movieId}`
        : null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm min-w-0 bg-[#0d0d14] border-l border-white/[0.08] shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <h2 className="text-sm font-semibold text-white">Watch Details</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex gap-4">
            {resolvePosterUrl(item.posterUrl) && (
              <div className="relative w-20 aspect-[2/3] rounded-xl overflow-hidden shrink-0">
                <Image
                  src={resolvePosterUrl(item.posterUrl)!}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="p-1 rounded bg-purple-500/20">
                  {item.type === "episode" ? (
                    <Tv className="h-3 w-3 text-purple-400" />
                  ) : (
                    <Film className="h-3 w-3 text-purple-400" />
                  )}
                </div>
                <span className="text-xs text-white/40 capitalize">{item.type === "episode" ? "Show" : "Movie"}</span>
              </div>
              <h3 className="font-semibold text-white text-base leading-tight mb-1">{item.title}</h3>
              {item.showTitle && (
                <p className="text-sm text-white/50">{item.showTitle}</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <InfoRow
              label="Last Watched"
              value={format(parseISO(item.watchedAt), "PPP p")}
              icon={<Calendar className="h-3.5 w-3.5" />}
            />
            {item.firstWatchedAt && item.firstWatchedAt !== item.watchedAt && (
              <InfoRow
                label="First Watched"
                value={format(parseISO(item.firstWatchedAt), "PPP")}
                icon={<Clock className="h-3.5 w-3.5" />}
              />
            )}
            {item.totalWatchTime !== undefined && item.totalWatchTime > 0 && (
              <InfoRow
                label="Total Watch Time"
                value={formatRuntime(item.totalWatchTime) ?? "—"}
                icon={<Clock className="h-3.5 w-3.5" />}
              />
            )}
            {item.watchCount !== undefined && item.watchCount > 0 && (
              <InfoRow
                label={item.type === "episode" ? "Episodes Watched" : "Times Watched"}
                value={item.watchCount.toString()}
                icon={<PlayCircle className="h-3.5 w-3.5" />}
              />
            )}
            {item.completionPercentage !== undefined && item.completionPercentage > 0 && (
              <InfoRow
                label="Completion"
                value={`${item.completionPercentage}%`}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              />
            )}
            {item.status && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  item.status === "watched"
                    ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                    : item.status === "watching"
                      ? "border-blue-500/30 text-blue-400 bg-blue-500/10"
                      : "border-white/10 text-white/40 bg-white/5"
                }`}>
                  {item.status}
                </span>
              </div>
            )}
          </div>

          {item.completionPercentage !== undefined && item.completionPercentage > 0 && (
            <div>
              <div className={PROGRESS_BAR_CLASS}>
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${Math.min(item.completionPercentage, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {detailHref && (
          <div className="p-5 border-t border-white/[0.08]">
            <Link
              href={detailHref}
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-white/[0.06] border border-white/[0.10] text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.10] transition-all"
            >
              <ExternalLink className="h-4 w-4" />
              View Full Details
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-xs text-white/40">
        {icon}
        {label}
      </div>
      <span className="text-xs text-white/70 font-medium">{value}</span>
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
  return (
    <button
      onClick={() => onSelect(item)}
      className="group w-full text-left"
    >
      <div
        className={`rounded-2xl backdrop-blur-xl border transition-all p-5 ${
          item.removedFromLibrary
            ? "bg-white/[0.02] border-amber-500/20 hover:bg-white/[0.04] hover:border-amber-500/30 opacity-90"
            : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.12]"
        }`}
      >
        <div className="flex items-center gap-5">
          {resolvePosterUrl(item.posterUrl) && (
            <div className="relative w-16 h-24 flex-shrink-0 rounded-xl overflow-hidden shadow-lg shadow-black/20">
              <Image
                src={resolvePosterUrl(item.posterUrl)!}
                alt={item.title}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-purple-500/20 flex-shrink-0">
                  {item.type === "episode" ? (
                    <Tv className="h-3.5 w-3.5 text-purple-400" />
                  ) : (
                    <Film className="h-3.5 w-3.5 text-purple-400" />
                  )}
                </div>
                <h3
                  className={`font-semibold text-sm truncate transition-colors ${
                    item.removedFromLibrary
                      ? "text-white/70 group-hover:text-amber-400/90"
                      : "text-white group-hover:text-purple-400"
                  }`}
                >
                  {item.title}
                </h3>
                {item.removedFromLibrary && (
                  <span title="Removed from library">
                    <Archive className="h-3.5 w-3.5 text-amber-400/70 flex-shrink-0" aria-hidden />
                  </span>
                )}
              </div>

              {(item.showTitle ||
                (item.seasonNumber !== undefined &&
                  item.episodeNumber !== undefined)) && (
                <div className="flex items-center gap-2 pl-9">
                  {item.showTitle && (
                    <p className="text-sm text-white/50 truncate">
                      {item.showTitle}
                    </p>
                  )}
                  {item.seasonNumber !== undefined &&
                    item.episodeNumber !== undefined && (
                      <>
                        {item.showTitle && (
                          <span className="text-white/20">·</span>
                        )}
                        <p className="text-sm text-white/40 flex-shrink-0">
                          S{item.seasonNumber} E{item.episodeNumber}
                        </p>
                      </>
                    )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-white/40">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {formatDistanceToNow(parseISO(item.watchedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              {item.duration && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="text-xs text-white/40">
                    {Math.floor(item.duration / 60)}h {item.duration % 60}m
                  </span>
                </>
              )}
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-white/20 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </div>
      </div>
    </button>
  );
});

type ViewMode = "list" | "calendar";

export default function HistoryPage() {
  const [filter, setFilter] = useState<"all" | "episode" | "movie">("all");
  const [timeRange, setTimeRange] = useState<
    "all" | "today" | "week" | "month"
  >("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedItem, setSelectedItem] = useState<WatchHistoryItem | null>(null);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(
    null,
  );

  const { data: history, isLoading, isError, refetch } = useWatchHistory({
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
            return (
              watchedDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            );
          case "month":
            return (
              watchedDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            );
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
    const sortedDates = Object.keys(grouped).sort((a, b) =>
      b.localeCompare(a),
    );
    return { grouped, sortedDates };
  }, [filteredHistory]);

  const calendarFilteredItems = useMemo(() => {
    if (!calendarSelectedDate) return filteredHistory;
    return filteredHistory.filter(
      (item) =>
        format(parseISO(item.watchedAt), "yyyy-MM-dd") === calendarSelectedDate,
    );
  }, [filteredHistory, calendarSelectedDate]);

  const handleSelectItem = useCallback((item: WatchHistoryItem) => {
    setSelectedItem(item);
  }, []);

  const handleCloseDetailSheet = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const breadcrumbItems = useMemo(
    () => [
      { icon: "home" as const, href: "/dashboard" },
      { label: "History" },
    ],
    [],
  );

  return (
    <AppLayout>
      <PageContent>
        <PageHeader
          breadcrumb={breadcrumbItems}
          title="Watch History"
          description="Your viewing timeline"
          icon={<History className="h-6 w-6 sm:h-7 sm:w-7 text-purple-400 shrink-0" />}
          actions={
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex h-11 rounded-lg border border-white/8 overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                viewMode === "list"
                  ? "bg-purple-500/20 text-purple-400"
                  : "text-white/50 hover:text-white"
              }`}
              aria-pressed={viewMode === "list"}
            >
              <LayoutList className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                viewMode === "calendar"
                  ? "bg-purple-500/20 text-purple-400"
                  : "text-white/50 hover:text-white"
              }`}
              aria-pressed={viewMode === "calendar"}
            >
              <CalendarDays className="h-4 w-4" />
              Calendar
            </button>
          </div>
          <Select
            value={filter}
            onValueChange={(value: "all" | "episode" | "movie") =>
              setFilter(value)
            }
          >
            <SelectTrigger className="w-[140px] h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="episode">Episodes</SelectItem>
              <SelectItem value="movie">Movies</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={timeRange}
            onValueChange={(value: "all" | "today" | "week" | "month") =>
              setTimeRange(value)
            }
          >
            <SelectTrigger className="w-[140px] h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
          }
        />

        {isLoading && (
          <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-white/40">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
            <span>Loading watch history...</span>
            </div>
          </div>
        )}

        {!isLoading && isError && (
        <div className="text-center py-16">
          <History className="h-16 w-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/60 text-lg mb-2">Failed to load watch history</p>
          <p className="text-sm text-white/40 mb-4">
            Something went wrong. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors text-sm font-medium"
          >
            Retry
          </button>
        </div>
        )}

        {!isLoading && !isError && filteredHistory.length === 0 && (
        <div className="text-center py-16">
          <History className="h-16 w-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/60 text-lg mb-2">No watch history found</p>
          <p className="text-sm text-white/40">
            Try adjusting your filters or start watching some content
          </p>
        </div>
        )}

        {!isLoading && filteredHistory.length > 0 && viewMode === "calendar" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <HistoryCalendar
              items={filteredHistory}
              selectedDate={calendarSelectedDate}
              onSelectDate={setCalendarSelectedDate}
            />
            <div className="space-y-4">
              {calendarSelectedDate ? (
                <>
                  <div className="flex items-center gap-4 -ml-0.5">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="h-4 w-4 text-purple-400 opacity-70" />
                      <h2 className="text-sm font-medium text-white/70">
                        {formatDateHeader(calendarSelectedDate)}
                      </h2>
                      <span className="text-white/30">·</span>
                      <span className="text-sm text-white/40">
                        {calendarFilteredItems.length}{" "}
                        {calendarFilteredItems.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-linear-to-r from-white/8 to-transparent" />
                  </div>
                  <div className="grid gap-3">
                    {calendarFilteredItems.map((item) => (
                      <HistoryItemCard
                        key={item.id}
                        item={item}
                        onSelect={handleSelectItem}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[200px] rounded-2xl border border-white/6 bg-white/2">
                  <p className="text-sm text-white/30">Select a day to see what you watched</p>
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
                <div className="flex items-center gap-4 -ml-0.5">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="h-4 w-4 text-purple-400 opacity-70" />
                    <h2 className="text-sm font-medium text-white/70">
                      {formatDateHeader(dateKey)}
                    </h2>
                    <span className="text-white/30">·</span>
                    <span className="text-sm text-white/40">
                      {items.length} {items.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                </div>

                <div className="grid gap-3">
                  {items.map((item) => (
                    <HistoryItemCard
                      key={item.id}
                      item={item}
                      onSelect={handleSelectItem}
                    />
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
