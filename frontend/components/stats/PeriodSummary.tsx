"use client";

import { useState } from "react";
import { usePeriodSummary } from "@/hooks/useStats";
import { formatRuntime } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

export function PeriodSummary() {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const { data, isLoading } = usePeriodSummary(period);

  const periodLabel = period === "month" ? "This Month" : "This Year";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Period Summary</h2>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-white/10">
          {(["month", "year"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {p === "month" ? "Month" : "Year"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <>
            <p className="text-xs text-white/40 mb-4 uppercase tracking-wider">
              {periodLabel}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Stat
                label="Watch Time"
                value={formatRuntime(data.total_watch_minutes) ?? "—"}
              />
              <Stat label="Episodes" value={data.episodes_watched.toString()} />
              <Stat label="Movies" value={data.movies_watched.toString()} />
              <Stat label="Shows Started" value={data.shows_started.toString()} />
              <Stat label="Shows Completed" value={data.shows_completed.toString()} />
              {data.top_genre && <Stat label="Top Genre" value={data.top_genre} />}
            </div>
          </>
        ) : (
          <p className="text-sm text-white/30 text-center py-4">
            No data for {periodLabel.toLowerCase()} yet.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
      <p className="text-[11px] text-white/40 mb-1">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}
