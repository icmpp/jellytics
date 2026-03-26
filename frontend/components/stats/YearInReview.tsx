"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useYearInReview,
  type YearInReview as YearInReviewType,
} from "@/hooks/useStats";
import { formatRuntime } from "@/lib/utils";
import { format } from "date-fns";
import {
  Calendar,
  Film,
  Tv,
  Trophy,
  Clock,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportYearInReviewToPDF } from "@/lib/export";

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => currentYear - i);

export function YearInReview() {
  const [year, setYear] = useState(currentYear);
  const { data, isLoading } = useYearInReview(year);

  if (isLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-400" />
            Year in Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 rounded-xl bg-white/[0.03] animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-400" />
            Year in Review
          </CardTitle>
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v, 10))}>
            <SelectTrigger className="w-[110px] h-9">
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
        </div>
        {data && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => exportYearInReviewToPDF(data, `year-in-review-${year}`)}
          >
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!data ? (
          <p className="text-sm text-white/40">No data for {year}</p>
        ) : (
          <YearInReviewContent data={data} />
        )}
      </CardContent>
    </Card>
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
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Watch Time"
          value={formatRuntime(data.total_watch_minutes) ?? "0m"}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Episodes"
          value={data.episodes_watched.toString()}
          icon={<Tv className="h-4 w-4" />}
        />
        <StatCard
          label="Movies"
          value={data.movies_watched.toString()}
          icon={<Film className="h-4 w-4" />}
        />
        {topGenresList.length > 0 && (
          <StatCard
            label="Top Genre"
            value={topGenresList[0][0]}
            icon={<Trophy className="h-4 w-4" />}
          />
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {data.top_movies && data.top_movies.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
              <Film className="h-4 w-4 text-purple-400" />
              Top Movies
            </h3>
            <ul className="space-y-2">
              {data.top_movies.map((m, i) => (
                <li
                  key={m.id}
                  className="flex justify-between text-sm py-1.5 px-3 rounded-lg bg-white/[0.03]"
                >
                  <span className="text-white/80 truncate mr-2">
                    {i + 1}. {m.title}
                  </span>
                  <span className="text-white/40 shrink-0">
                    {formatRuntime(m.total_watch_time_minutes) ?? "0m"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.top_shows && data.top_shows.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
              <Tv className="h-4 w-4 text-purple-400" />
              Top Shows
            </h3>
            <ul className="space-y-2">
              {data.top_shows.map((s, i) => (
                <li
                  key={s.id}
                  className="flex justify-between text-sm py-1.5 px-3 rounded-lg bg-white/[0.03]"
                >
                  <span className="text-white/80 truncate mr-2">
                    {i + 1}. {s.title}
                  </span>
                  <span className="text-white/40 shrink-0">
                    {formatRuntime(s.total_watch_time_minutes)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {data.month_by_month && data.month_by_month.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-white/70 mb-3">Month by Month</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 border-b border-white/[0.08]">
                  <th className="text-left py-2 pr-4">Month</th>
                  <th className="text-right py-2 pr-4">Watch Time</th>
                  <th className="text-right py-2">Episodes</th>
                </tr>
              </thead>
              <tbody>
                {data.month_by_month.map((row) => (
                  <tr
                    key={row.month}
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="py-2 pr-4 text-white/70">
                      {format(new Date(row.month + "-01"), "MMMM yyyy")}
                    </td>
                    <td className="text-right py-2 pr-4 text-white/60">
                      {formatRuntime(row.total_watch_minutes) ?? "0m"}
                    </td>
                    <td className="text-right py-2 text-white/60">
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

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
      <div className="flex items-center gap-2 text-white/40 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
