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
import { Button } from "@/components/ui/button";
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
      icon={<Calendar className="h-5 w-5 text-purple-400" />}
      isLoading={isLoading && !data}
      minHeight="min-h-[200px]"
      isEmpty={!data}
      emptyMessage={`No data for ${year}`}
      emptyDescription="Try selecting a different year"
      emptyIcon={<Calendar className="h-10 w-10" />}
      titleExtra={
        <div className="flex items-center gap-2">
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v, 10))}>
            <SelectTrigger size="sm" className="w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => exportYearInReviewToPDF(data, `year-in-review-${year}`)}
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
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
          label="Watch Time"
          value={formatRuntime(data.total_watch_minutes) ?? "0m"}
          icon={<Clock className="h-3.5 w-3.5 text-purple-400" />}
        />
        <StatCard
          label="Episodes"
          value={data.episodes_watched.toString()}
          icon={<Tv className="h-3.5 w-3.5 text-blue-400" />}
        />
        <StatCard
          label="Movies"
          value={data.movies_watched.toString()}
          icon={<Film className="h-3.5 w-3.5 text-cyan-400" />}
        />
        {topGenresList.length > 0 && (
          <StatCard
            label="Top Genre"
            value={topGenresList[0][0]}
            icon={<Trophy className="h-3.5 w-3.5 text-amber-400" />}
          />
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {data.top_movies && data.top_movies.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/40 mb-2.5 flex items-center gap-1.5">
              <Film className="h-3.5 w-3.5 text-purple-400" />
              Top Movies
            </p>
            <div className="space-y-1">
              {data.top_movies.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-sm py-2 px-3 rounded-xl bg-white/3 border border-white/6 hover:bg-white/5 transition-colors"
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
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/40 mb-2.5 flex items-center gap-1.5">
              <Tv className="h-3.5 w-3.5 text-purple-400" />
              Top Shows
            </p>
            <div className="space-y-1">
              {data.top_shows.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-sm py-2 px-3 rounded-xl bg-white/3 border border-white/6 hover:bg-white/5 transition-colors"
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
          <p className="text-[11px] uppercase tracking-[0.12em] text-white/40 mb-2.5">
            Month by Month
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/3">
                  <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-white/40 font-medium">
                    Month
                  </th>
                  <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider text-white/40 font-medium">
                    Watch Time
                  </th>
                  <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider text-white/40 font-medium">
                    Episodes
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.month_by_month.map((row) => (
                  <tr
                    key={row.month}
                    className="border-t border-white/5 hover:bg-white/3 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-white/70">
                      {format(new Date(row.month + "-01"), "MMMM yyyy")}
                    </td>
                    <td className="text-right py-2.5 px-3 text-white/55 tabular-nums">
                      {formatRuntime(row.total_watch_minutes) ?? "0m"}
                    </td>
                    <td className="text-right py-2.5 px-3 text-white/55 tabular-nums">
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
    <div className="group rounded-xl border border-white/8 bg-white/3 p-3 transition-colors duration-200 hover:border-white/12 hover:bg-white/5">
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon}
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/40">{label}</p>
      </div>
      <p className="text-lg font-bold text-white tabular-nums truncate">{value}</p>
    </div>
  );
}
