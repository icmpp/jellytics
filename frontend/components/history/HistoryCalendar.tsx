"use client";

import { useMemo, useState, useEffect } from "react";
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

export function HistoryCalendar({
  items,
  selectedDate,
  onSelectDate,
}: HistoryCalendarProps) {
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

  useEffect(() => {
    if (selectedDate) {
      setViewDate(parseISO(selectedDate));
    }
  }, [selectedDate]);

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
    <div className="rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
        <button
          onClick={() => setViewDate(subMonths(viewDate, 1))}
          className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-semibold text-white">
          {format(viewDate, "MMMM yyyy")}
        </h2>
        <button
          onClick={() => setViewDate(addMonths(viewDate, 1))}
          className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="text-center text-xs text-white/40 font-medium py-1"
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
            const isSelected =
              selectedDate && isSameDay(day, parseISO(selectedDate));
            const isCurrentMonth = isSameMonth(day, viewDate);
            const isTodayDate = isToday(day);

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() =>
                  onSelectDate(
                    hasActivity
                      ? isSelected
                        ? null
                        : dateKey
                      : null,
                  )
                }
                className={`relative h-10 rounded-lg text-sm transition-colors flex flex-col items-center justify-center ${
                  !isCurrentMonth
                    ? "text-white/20"
                    : isSelected
                      ? "bg-purple-500/30 text-purple-300 ring-1 ring-purple-400/50"
                      : hasActivity
                        ? "bg-white/[0.08] text-white hover:bg-white/[0.12]"
                        : "text-white/50 hover:bg-white/[0.04]"
                }`}
                aria-label={`${format(day, "PPP")}${hasActivity ? `, ${activity.count} items` : ""}`}
              >
                {format(day, "d")}
                {hasActivity && (
                  <span
                    className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                      isSelected ? "bg-purple-300" : "bg-purple-400/80"
                    }`}
                  />
                )}
                {isTodayDate && !isSelected && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/50" />
                )}
              </button>
            );
          })}
        </div>
        {selectedDate && activityByDate[selectedDate] && (
          <div className="mt-4 pt-4 border-t border-white/[0.08]">
            <p className="text-xs text-white/40">
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
