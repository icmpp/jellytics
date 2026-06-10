"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useYearInReview, type YearInReview as YearInReviewType } from "@/hooks/useStats";
import { formatRuntime } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar, Film, Tv, Trophy, Clock, Download } from "lucide-react";
import { exportYearInReviewToPDF } from "@/lib/export";
import { ChartCard } from "@/components/ui/chart-card";

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => currentYear - i);

export function YearInReview() {
  const [year, setYear] = useState(currentYear);
  const { data, isLoading } = useYearInReview(year);

  return (
    <ChartCard
      title="Year in Review"
      icon={<Calendar className="h-5 w-5" />}
      isLoading={isLoading && !data}
      minHeight="min-h-[200px]"
      isEmpty={!data}
      emptyMessage={`no_data_for_${year}`}
      emptyDescription="try selecting a different year"
      emptyIcon={<Calendar className="h-10 w-10" />}
      titleExtra={
        <div className="flex items-center gap-2">
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v, 10))}>
            <SelectTrigger
              size="sm"
              className="w-[100px] rounded-sm border-[#16162a] bg-[#0a0a14] font-mono text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-sm border-[#16162a] bg-[#07070d] font-mono">
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={y.toString()} className="rounded-sm text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data && (
            <button
              type="button"
              onClick={() => exportYearInReviewToPDF(data, `year-in-review-${year}`)}
              className="inline-flex items-center gap-1.5 rounded-sm border border-[#16162a] bg-[#0a0a14] px-2.5 py-1.5 font-mono text-xs text-white/70 transition-colors hover:bg-[#0d0d1a] hover:text-violet-300"
            >
              <Download className="h-3.5 w-3.5" />
              pdf
            </button>
          )}
        </div>
      }
    >
      {data && <YearInReviewContent data={data} />}
    </ChartCard>
  );
}

function YearInReviewContent({ data }: { data: YearInReviewType }) {
  const topGenresList = useMemo(
    () =>
      Object.entries(data.top_genres || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    [data.top_genres],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard
          label="watch_time"
          value={formatRuntime(data.total_watch_minutes) ?? "0m"}
          icon={<Clock className="h-3.5 w-3.5 text-violet-400/70" />}
        />
        <StatCard
          label="episodes"
          value={data.episodes_watched.toString()}
          icon={<Tv className="h-3.5 w-3.5 text-blue-400/70" />}
        />
        <StatCard
          label="movies"
          value={data.movies_watched.toString()}
          icon={<Film className="h-3.5 w-3.5 text-cyan-400/70" />}
        />
        {topGenresList.length > 0 && (
          <StatCard
            label="top_genre"
            value={topGenresList[0][0]}
            icon={<Trophy className="h-3.5 w-3.5 text-amber-400/70" />}
          />
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {data.top_movies && data.top_movies.length > 0 && (
          <div>
            <p className="mb-2.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-violet-300/55">
              <Film className="h-3.5 w-3.5 text-violet-400/70" />
              <span className="text-violet-400/45 select-none">{"# "}</span>top_movies
            </p>
            <div className="space-y-1">
              {data.top_movies.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-sm border border-[#16162a] bg-[#0a0a14] px-3 py-2 font-mono text-sm transition-colors hover:border-violet-500/25 hover:bg-[#0d0d1a]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold text-white/30 w-5 text-center tabular-nums shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-white/80 truncate">{m.title}</span>
                  </div>
                  <span className="text-white/40 shrink-0 text-xs tabular-nums">
                    {formatRuntime(m.total_watch_time_minutes) ?? "0m"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {data.top_shows && data.top_shows.length > 0 && (
          <div>
            <p className="mb-2.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-violet-300/55">
              <Tv className="h-3.5 w-3.5 text-violet-400/70" />
              <span className="text-violet-400/45 select-none">{"# "}</span>top_shows
            </p>
            <div className="space-y-1">
              {data.top_shows.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-sm border border-[#16162a] bg-[#0a0a14] px-3 py-2 font-mono text-sm transition-colors hover:border-violet-500/25 hover:bg-[#0d0d1a]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold text-white/30 w-5 text-center tabular-nums shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-white/80 truncate">{s.title}</span>
                  </div>
                  <span className="text-white/40 shrink-0 text-xs tabular-nums">
                    {formatRuntime(s.total_watch_time_minutes)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {data.month_by_month && data.month_by_month.length > 0 && (
        <div>
          <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-violet-300/55">
            <span className="text-violet-400/45 select-none">{"# "}</span>month_by_month
          </p>
          <div className="overflow-x-auto rounded-sm border border-[#16162a]">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="bg-[#0a0a14]">
                  <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-violet-300/55 font-medium">
                    month
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-violet-300/55 font-medium">
                    watch_time
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-violet-300/55 font-medium">
                    episodes
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.month_by_month.map((row) => (
                  <tr
                    key={row.month}
                    className="border-t border-[#16162a] transition-colors hover:bg-[#0d0d1a]"
                  >
                    <td className="px-3 py-2.5 text-white/70">
                      {format(new Date(row.month + "-01"), "MMMM yyyy")}
                    </td>
                    <td className="px-3 py-2.5 text-right text-white/55 tabular-nums">
                      {formatRuntime(row.total_watch_minutes) ?? "0m"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-white/55 tabular-nums">
                      {row.episodes_watched}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
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
