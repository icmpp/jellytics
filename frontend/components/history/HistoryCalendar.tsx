"use client";

import { useMemo, useState } from "react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WatchHistoryItem } from "@/hooks/useWatchHistory";

export interface DayActivity {
  date: string;
  count: number;
  totalMinutes: number;
  items: WatchHistoryItem[];
}

interface HistoryCalendarProps {
  items: WatchHistoryItem[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function HistoryCalendar({ items, selectedDate, onSelectDate }: HistoryCalendarProps) {
  const activityByDate = useMemo(() => {
    const map: Record<string, DayActivity> = {};
    for (const item of items) {
      const dateKey = format(parseISO(item.watchedAt), "yyyy-MM-dd");
      if (!map[dateKey]) {
        map[dateKey] = { date: dateKey, count: 0, totalMinutes: 0, items: [] };
      }
      map[dateKey].count += 1;
      map[dateKey].totalMinutes += item.totalWatchTime ?? item.duration ?? 0;
      map[dateKey].items.push(item);
    }
    return map;
  }, [items]);

  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) return parseISO(selectedDate);
    if (items.length) return parseISO(items[0].watchedAt);
    return new Date();
  });

  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);
  if (prevSelectedDate !== selectedDate) {
    setPrevSelectedDate(selectedDate);
    if (selectedDate) setViewDate(parseISO(selectedDate));
  }

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate));
    const end = endOfWeek(endOfMonth(viewDate));
    const days: Date[] = [];
    let current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [viewDate]);

  return (
    <div className="overflow-hidden rounded-sm border border-[#16162a] bg-[#0a0a14] font-mono">
      <div
        className="flex items-center justify-between border-b border-[#16162a] px-4 py-2.5"
        style={{ background: "#06060d" }}
      >
        <button
          onClick={() => setViewDate(subMonths(viewDate, 1))}
          className="rounded-sm p-1.5 text-white/40 transition-colors hover:bg-violet-500/10 hover:text-violet-300"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold lowercase text-violet-300/90">
          {format(viewDate, "MMMM yyyy")}
        </h2>
        <button
          onClick={() => setViewDate(addMonths(viewDate, 1))}
          className="rounded-sm p-1.5 text-white/40 transition-colors hover:bg-violet-500/10 hover:text-violet-300"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="py-1 text-center text-[11px] lowercase tracking-wide text-violet-400/40"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const activity = activityByDate[dateKey];
            const hasActivity = !!activity && activity.count > 0;
            const isSelected = selectedDate && isSameDay(day, parseISO(selectedDate));
            const isCurrentMonth = isSameMonth(day, viewDate);
            const isTodayDate = isToday(day);

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onSelectDate(hasActivity ? (isSelected ? null : dateKey) : null)}
                className={cn(
                  "relative flex h-10 flex-col items-center justify-center rounded-sm text-sm tabular-nums transition-colors",
                  !isCurrentMonth
                    ? "text-white/20"
                    : isSelected
                      ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/40"
                      : hasActivity
                        ? "bg-[#0d0d1a] text-white/90 hover:bg-violet-500/10"
                        : "text-white/40 hover:bg-[#0d0d1a]",
                )}
                aria-label={`${format(day, "PPP")}${hasActivity ? `, ${activity.count} items` : ""}`}
              >
                {format(day, "d")}
                {hasActivity && (
                  <span
                    className={cn(
                      "absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full",
                      isSelected ? "bg-violet-300" : "bg-violet-400/80",
                    )}
                  />
                )}
                {isTodayDate && !isSelected && (
                  <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white/40" />
                )}
              </button>
            );
          })}
        </div>
        {selectedDate && activityByDate[selectedDate] && (
          <div className="mt-4 border-t border-[#16162a] pt-4">
            <p className="text-xs text-violet-300/50">
              <span className="select-none text-violet-400/45">{"# "}</span>
              {activityByDate[selectedDate].count} item
              {activityByDate[selectedDate].count !== 1 ? "s" : ""} ·{" "}
              {Math.floor(activityByDate[selectedDate].totalMinutes / 60)}h{" "}
              {activityByDate[selectedDate].totalMinutes % 60}m watched
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
