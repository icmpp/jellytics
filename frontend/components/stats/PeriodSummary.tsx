"use client";

import { useState } from "react";
import { usePeriodSummary } from "@/hooks/useStats";
import { formatRuntime } from "@/lib/utils";
import { CalendarDays, Clock, Tv, Film, PlayCircle, CheckCircle2, Sparkles } from "lucide-react";
import { ChartCard } from "@/components/ui/chart-card";

export function PeriodSummary() {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const { data, isLoading } = usePeriodSummary(period);

  const periodLabel = period === "month" ? "This Month" : "This Year";

  return (
    <ChartCard
      title="Period Summary"
      icon={<CalendarDays className="h-5 w-5 text-purple-400" />}
      isLoading={isLoading}
      minHeight="min-h-[160px]"
      isEmpty={!data}
      emptyMessage={`No data for ${periodLabel.toLowerCase()} yet`}
      emptyIcon={<CalendarDays className="h-10 w-10" />}
      titleExtra={
        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
          {(["month", "year"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
                period === p
                  ? "bg-purple-500/30 text-purple-100 shadow-sm shadow-purple-500/20"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {p === "month" ? "Month" : "Year"}
            </button>
          ))}
        </div>
      }
    >
      {data && (
        <>
          <p className="text-[11px] uppercase tracking-[0.12em] text-white/40 mb-3">
            {periodLabel}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Stat
              label="Watch Time"
              value={formatRuntime(data.total_watch_minutes) ?? "—"}
              icon={<Clock className="h-3.5 w-3.5 text-purple-400" />}
            />
            <Stat
              label="Episodes"
              value={data.episodes_watched.toString()}
              icon={<Tv className="h-3.5 w-3.5 text-blue-400" />}
            />
            <Stat
              label="Movies"
              value={data.movies_watched.toString()}
              icon={<Film className="h-3.5 w-3.5 text-cyan-400" />}
            />
            <Stat
              label="Shows Started"
              value={data.shows_started.toString()}
              icon={<PlayCircle className="h-3.5 w-3.5 text-emerald-400" />}
            />
            <Stat
              label="Shows Completed"
              value={data.shows_completed.toString()}
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />}
            />
            {data.top_genre && (
              <Stat
                label="Top Genre"
                value={data.top_genre}
                icon={<Sparkles className="h-3.5 w-3.5 text-pink-400" />}
              />
            )}
          </div>
        </>
      )}
    </ChartCard>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="group rounded-xl border border-white/8 bg-white/3 p-3 transition-colors duration-200 hover:border-white/12 hover:bg-white/5">
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon}
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/40">{label}</p>
      </div>
      <p className="text-lg font-bold text-white tabular-nums truncate">{value}</p>
    </div>
  );
}
