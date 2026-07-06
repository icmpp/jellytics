"use client";

import { useState } from "react";
import { usePeriodSummary } from "@/hooks/useStats";
import { formatRuntime } from "@/lib/utils";
import { CalendarDays, Clock, Tv, Film, PlayCircle, CheckCircle2, Sparkles } from "lucide-react";
import { ChartCard } from "@/components/ui/chart-card";
import { StatSegmented } from "@/components/stats/StatSegmented";

export function PeriodSummary() {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const { data, isLoading } = usePeriodSummary(period);

  const periodLabel = period === "month" ? "this_month" : "this_year";

  return (
    <ChartCard
      title="Period Summary"
      icon={<CalendarDays className="h-5 w-5" />}
      isLoading={isLoading}
      minHeight="min-h-[160px]"
      isEmpty={!data}
      emptyMessage={`no_data_for_${periodLabel}_yet`}
      emptyIcon={<CalendarDays className="h-10 w-10" />}
      titleExtra={
        <StatSegmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: "month", label: "month" },
            { value: "year", label: "year" },
          ]}
        />
      }
    >
      {data && (
        <>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-violet-300/55">
            <span className="text-violet-400/45 select-none">{"# "}</span>
            {periodLabel}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Stat
              label="watch_time"
              value={formatRuntime(data.total_watch_minutes) ?? "—"}
              icon={<Clock className="h-3.5 w-3.5 text-violet-400/70" />}
            />
            <Stat
              label="episodes"
              value={data.episodes_watched.toString()}
              icon={<Tv className="h-3.5 w-3.5 text-blue-400/70" />}
            />
            <Stat
              label="movies"
              value={data.movies_watched.toString()}
              icon={<Film className="h-3.5 w-3.5 text-cyan-400/70" />}
            />
            <Stat
              label="shows_started"
              value={data.shows_started.toString()}
              icon={<PlayCircle className="h-3.5 w-3.5 text-emerald-400/70" />}
            />
            <Stat
              label="shows_completed"
              value={data.shows_completed.toString()}
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-amber-400/70" />}
            />
            {data.top_genre && (
              <Stat
                label="top_genre"
                value={data.top_genre}
                icon={<Sparkles className="h-3.5 w-3.5 text-pink-400/70" />}
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
    <div className="group rounded-sm border border-[#16162a] bg-[#0a0a14] p-3 transition-colors duration-200 hover:border-violet-500/25 hover:bg-[#0d0d1a]">
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon}
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-violet-300/55 truncate">
          {label}
        </p>
      </div>
      <p className="font-mono text-lg font-bold text-white tabular-nums truncate">{value}</p>
    </div>
  );
}
