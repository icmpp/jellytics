"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  useStatsOverview,
  useTrends,
  useGenreBreakdown,
} from "@/hooks/useStats";
import { toast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLayout, PageHeader, PageContent } from "@/components/layout";
import {
  Download,
  Calendar,
  FileText,
  FileSpreadsheet,
  BarChart3,
  Clock,
  Film,
  PlayCircle,
  TrendingUp,
  FileJson,
  ChevronDown,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { exportStatsToExcel, exportStatsToPDF } from "@/lib/export";
import { useRatingsList } from "@/hooks/useRatings";
import { useReviewsList } from "@/hooks/useReviews";
import { WatchTimeChart } from "@/components/stats/WatchTimeChart";
import { GenreBreakdown } from "@/components/stats/GenreBreakdown";
import { MostWatched } from "@/components/stats/MostWatched";
import { Milestones } from "@/components/stats/Milestones";
import { PeriodSummary } from "@/components/stats/PeriodSummary";
import { YearInReview } from "@/components/stats/YearInReview";
import { WatchPatternHeatmap } from "@/components/stats/WatchPatternHeatmap";
import { Breadcrumb } from "@/components/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subDays, differenceInDays } from "date-fns";
import { RECHARTS_TOOLTIP_STYLE, formatRuntime } from "@/lib/utils";

interface TrendItem {
  snapshot_date: string;
  total_watch_time_minutes: number;
  delta_watch_time_minutes?: number;
  shows_watched: number;
  shows_watching: number;
  episodes_watched: number;
  delta_episodes_watched?: number;
}

const ComparisonView = memo(function ComparisonView({
  chartData,
  comparisonTrends,
}: {
  chartData: any[];
  comparisonTrends: TrendItem[];
}) {
  const currentAvg =
    chartData.reduce((sum, d) => sum + (d.watchTime || 0), 0) /
    chartData.length;
  const lastYearData = comparisonTrends.map((item) => ({
    date: format(new Date(item.snapshot_date), "MMM dd"),
    watchTime: parseFloat(
      (
        (item.delta_watch_time_minutes ?? item.total_watch_time_minutes) / 60
      ).toFixed(1),
    ),
    showsWatched: item.shows_watched,
  }));
  const lastYearAvg =
    lastYearData.length > 0
      ? lastYearData.reduce((sum, d) => sum + (d.watchTime || 0), 0) /
        lastYearData.length
      : 0;
  const watchTimeChange =
    lastYearAvg > 0 ? ((currentAvg - lastYearAvg) / lastYearAvg) * 100 : 0;

  const currentShowsAvg =
    chartData.reduce((sum, d) => sum + (d.showsWatched || 0), 0) /
    chartData.length;
  const lastYearShowsAvg =
    lastYearData.length > 0
      ? lastYearData.reduce((sum, d) => sum + (d.showsWatched || 0), 0) /
        lastYearData.length
      : 0;
  const showsChange =
    lastYearShowsAvg > 0
      ? ((currentShowsAvg - lastYearShowsAvg) / lastYearShowsAvg) * 100
      : 0;

  return (
    <div className="mt-6 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
      <h3 className="text-sm font-semibold text-white mb-4">
        Year-over-Year Comparison
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-white/40 mb-1">Watch Time Change</div>
          <div
            className={`text-xl font-bold ${watchTimeChange >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {watchTimeChange >= 0 ? "+" : ""}
            {watchTimeChange.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-white/40 mb-1">Shows Watched Change</div>
          <div
            className={`text-xl font-bold ${showsChange >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {showsChange >= 0 ? "+" : ""}
            {showsChange.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-white/40 mb-1">Current Avg (hours/day)</div>
          <div className="text-xl font-bold text-white">
            {currentAvg.toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-white/40 mb-1">Last Year Avg (hours/day)</div>
          <div className="text-xl font-bold text-white">
            {lastYearAvg.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
});

export default function StatsPage() {
  const [daysRange, setDaysRange] = useState<number | "custom">(30);
  const [customStartDate, setCustomStartDate] = useState<string>(
    format(subDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(typeof window !== "undefined" && window.innerWidth < 768);
      }, 150);
    };
    setIsMobile(typeof window !== "undefined" && window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", check);
    };
  }, []);

  const { data: overview } = useStatsOverview();
  const { data: ratings = [] } = useRatingsList();
  const { data: reviews = [] } = useReviewsList();

  const customDays =
    daysRange === "custom"
      ? differenceInDays(new Date(customEndDate), new Date(customStartDate)) + 1
      : daysRange;

  const { data: trends } = useTrends(
    typeof customDays === "number" ? customDays : 30,
    "daily",
  );
  const { data: genres } = useGenreBreakdown();

  const comparisonDays = typeof customDays === "number" ? customDays : 30;
  const { data: comparisonTrends } = useTrends(comparisonDays, "daily");

  const chartData = useMemo(() => {
    if (!trends || !Array.isArray(trends)) return [];
    return (trends as TrendItem[]).map((item, index) => {
      const watchMinutes =
        item.delta_watch_time_minutes ?? item.total_watch_time_minutes;
      const dataPoint: Record<string, unknown> = {
        date: format(new Date(item.snapshot_date), "MMM dd"),
        watchTime: parseFloat((watchMinutes / 60).toFixed(1)),
        showsWatched: item.shows_watched,
        showsWatching: item.shows_watching,
        episodesWatched:
          item.delta_episodes_watched ?? item.episodes_watched,
      };
      if (
        showComparison &&
        comparisonTrends &&
        Array.isArray(comparisonTrends)
      ) {
        const comparisonItem = (comparisonTrends as TrendItem[])[index];
        if (comparisonItem) {
          const compMinutes =
            comparisonItem.delta_watch_time_minutes ??
            comparisonItem.total_watch_time_minutes;
          dataPoint.watchTimeLastYear = parseFloat(
            (compMinutes / 60).toFixed(1),
          );
          dataPoint.showsWatchedLastYear = comparisonItem.shows_watched;
        }
      }
      return dataPoint;
    });
  }, [trends, showComparison, comparisonTrends]);

  const breadcrumbItems = useMemo(
    () => [
      { icon: "home" as const, href: "/dashboard" },
      { label: "Statistics" },
    ],
    [],
  );

  const exportJSON = async () => {
    setExporting("json");
    try {
      const data = {
        overview,
        trends,
        genres,
        ratings,
        reviews,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jellyfin-stats-${format(new Date(), "yyyy-MM-dd")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success({
        title: "Export successful",
        description: "Statistics exported as JSON successfully.",
      });
      setExportOpen(false);
    } catch (error) {
      toast.error({
        title: "Export failed",
        description: "Failed to export statistics. Please try again.",
      });
    } finally {
      setExporting(null);
    }
  };

  const exportCSV = async () => {
    setExporting("csv");
    try {
      if (!trends || !Array.isArray(trends)) {
        toast.error({
          title: "Export failed",
          description: "No trend data available to export.",
        });
        return;
      }

      const headers = [
        "Date",
        "Watch Time (hours)",
        "Shows Watched",
        "Shows Watching",
        "Episodes Watched",
      ];
      const rows = (trends as TrendItem[]).map((item) => [
        format(new Date(item.snapshot_date), "yyyy-MM-dd"),
        Math.round(item.total_watch_time_minutes / 60),
        item.shows_watched,
        item.shows_watching,
        item.episodes_watched,
      ]);

      const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jellyfin-stats-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success({
        title: "Export successful",
        description: "Statistics exported as CSV successfully.",
      });
      setExportOpen(false);
    } catch (error) {
      toast.error({
        title: "Export failed",
        description: "Failed to export statistics as CSV. Please try again.",
      });
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = async () => {
    setExporting("excel");
    try {
      if (overview || trends || genres || ratings.length > 0 || reviews.length > 0) {
        exportStatsToExcel(
          overview,
          trends as any[],
          genres,
          undefined,
          ratings,
          reviews,
        );
        toast.success({
          title: "Export successful",
          description: "Statistics exported as Excel successfully.",
        });
        setExportOpen(false);
      } else {
        toast.error({
          title: "Export failed",
          description: "No data available to export.",
        });
      }
    } catch (error) {
      toast.error({
        title: "Export failed",
        description: "Failed to export statistics as Excel. Please try again.",
      });
    } finally {
      setExporting(null);
    }
  };

  const exportPDF = async () => {
    setExporting("pdf");
    try {
      if (overview || trends || genres) {
        exportStatsToPDF(
          overview,
          trends as any[],
          genres,
          `jellyfin-stats-${format(new Date(), "yyyy-MM-dd")}`,
        );
        toast.success({
          title: "Export successful",
          description: "Statistics exported as PDF successfully.",
        });
        setExportOpen(false);
      } else {
        toast.error({
          title: "Export failed",
          description: "No data available for PDF export.",
        });
      }
    } catch (error) {
      toast.error({
        title: "Export failed",
        description: "Failed to export statistics as PDF. Please try again.",
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <AppLayout>
      <PageContent>
        <PageHeader
          breadcrumb={breadcrumbItems}
          title="Statistics"
          description="Detailed analytics and insights"
          icon={<BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 text-purple-400 shrink-0" />}
          actions={
        <Popover open={exportOpen} onOpenChange={setExportOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            className="w-[min(18rem,calc(100vw-2rem))] p-2"
          >
            <div className="space-y-1">
              <p className="px-3 py-2 text-xs font-medium text-white/40 uppercase tracking-wider">
                Export Format
              </p>

              <button
                onClick={exportJSON}
                disabled={exporting === "json"}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors text-left group"
              >
                <div className="p-2 rounded-lg bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors">
                  <FileJson className="h-4 w-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">JSON</p>
                  <p className="text-xs text-white/40">Full data export</p>
                </div>
                {exporting === "json" && (
                  <div className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                )}
              </button>

              <button
                onClick={exportCSV}
                disabled={exporting === "csv" || !trends}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="p-2 rounded-lg bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors">
                  <FileText className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">CSV</p>
                  <p className="text-xs text-white/40">
                    Spreadsheet compatible
                  </p>
                </div>
                {exporting === "csv" && (
                  <div className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                )}
              </button>

              <button
                onClick={exportExcel}
                disabled={
                  exporting === "excel" || !overview || !trends || !genres
                }
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="p-2 rounded-lg bg-green-500/20 group-hover:bg-green-500/30 transition-colors">
                  <FileSpreadsheet className="h-4 w-4 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">Excel</p>
                  <p className="text-xs text-white/40">Multi-sheet workbook</p>
                </div>
                {exporting === "excel" && (
                  <div className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                )}
              </button>

              <button
                onClick={exportPDF}
                disabled={exporting === "pdf"}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors text-left group"
              >
                <div className="p-2 rounded-lg bg-red-500/20 group-hover:bg-red-500/30 transition-colors">
                  <FileText className="h-4 w-4 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">PDF</p>
                  <p className="text-xs text-white/40">Print-ready report</p>
                </div>
                {exporting === "pdf" && (
                  <div className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            </div>
          </PopoverContent>
        </Popover>
          }
        />

        <div id="stats-content" className="space-y-6">
        <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-2 lg:grid-cols-4 items-stretch">
          <Card className="hover:bg-white/[0.05] transition-colors h-full flex flex-col">
            <CardContent className="p-3 sm:p-5 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 rounded-xl bg-purple-500/20 border border-purple-500/30 shrink-0">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-white/50 mb-0.5">Total Watch Time</p>
                  <p className="text-lg sm:text-2xl font-bold text-white tabular-nums leading-tight truncate">
                    {overview ? formatRuntime(overview.total_watch_time_minutes) ?? "0m" : "0m"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:bg-white/[0.05] transition-colors h-full flex flex-col">
            <CardContent className="p-3 sm:p-5 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 shrink-0">
                  <Film className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-white/50 mb-0.5">Total Items</p>
                  <p className="text-lg sm:text-2xl font-bold text-white tabular-nums leading-tight">
                    {overview?.total_shows || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:bg-white/[0.05] transition-colors h-full flex flex-col">
            <CardContent className="p-3 sm:p-5 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 shrink-0">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-white/50 mb-0.5">Watched</p>
                  <p className="text-lg sm:text-2xl font-bold text-white tabular-nums leading-tight">
                    {overview?.shows_watched || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:bg-white/[0.05] transition-colors h-full flex flex-col">
            <CardContent className="p-3 sm:p-5 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 rounded-xl bg-amber-500/20 border border-amber-500/30 shrink-0">
                  <PlayCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-white/50 mb-0.5">Currently Watching</p>
                  <p className="text-lg sm:text-2xl font-bold text-white tabular-nums leading-tight">
                    {overview?.shows_watching || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-white text-base sm:text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400 shrink-0" />
                Trends Over Time
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowComparison(!showComparison)}
                className={
                  "w-full sm:w-auto " +
                  (showComparison ? "bg-purple-500/20 border-purple-500/30" : "")
                }
              >
                {showComparison ? "Hide" : "Show"} Comparison
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mb-6">
              {[7, 30, 90, 365].map((days) => (
                <Button
                  key={days}
                  variant={daysRange === days ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setDaysRange(days);
                    setShowCustomPicker(false);
                  }}
                >
                  {days} days
                </Button>
              ))}
              <Button
                variant={daysRange === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCustomPicker(!showCustomPicker)}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Custom
              </Button>
            </div>

            {showCustomPicker && (
              <div className="mb-6 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="start-date"
                      className="text-sm font-medium text-white/60"
                    >
                      Start Date
                    </Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => {
                        setCustomStartDate(e.target.value);
                        setDaysRange("custom");
                      }}
                      max={customEndDate}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="end-date"
                      className="text-sm font-medium text-white/60"
                    >
                      End Date
                    </Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => {
                        setCustomEndDate(e.target.value);
                        setDaysRange("custom");
                      }}
                      min={customStartDate}
                      max={format(new Date(), "yyyy-MM-dd")}
                      className="h-11"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/40">
                    {customDays > 0
                      ? `${customDays} days selected`
                      : "Invalid date range"}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (customDays > 0 && customDays <= 365) {
                        setShowCustomPicker(false);
                      }
                    }}
                    disabled={customDays <= 0 || customDays > 365}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}

            {daysRange === "custom" && !showCustomPicker && (
              <div className="mb-6 text-sm text-white/40">
                Showing data from{" "}
                {format(new Date(customStartDate), "MMM dd, yyyy")} to{" "}
                {format(new Date(customEndDate), "MMM dd, yyyy")} ({customDays}{" "}
                days)
              </div>
            )}
            {chartData.length > 0 && (
              <div className="h-[260px] sm:h-[340px] md:h-[420px] w-full [&>div]:!h-full">
                <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={
                    isMobile
                      ? { top: 8, right: 4, left: 0, bottom: 0 }
                      : { top: 10, right: 20, left: 10, bottom: 10 }
                  }
                >
                  <defs>
                    <linearGradient
                      id="purpleGradient"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <linearGradient
                      id="blueGradient"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#60a5fa" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={isMobile ? 10 : 12}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={isMobile ? 4 : 8}
                    interval={isMobile ? "preserveStartEnd" : 0}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={isMobile ? 10 : 12}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={isMobile ? 4 : 8}
                    width={isMobile ? 28 : 40}
                  />
                  <Tooltip
                    contentStyle={RECHARTS_TOOLTIP_STYLE.contentStyle}
                    labelStyle={RECHARTS_TOOLTIP_STYLE.labelStyle}
                    itemStyle={RECHARTS_TOOLTIP_STYLE.itemStyle}
                  />
                  <Legend
                    wrapperStyle={{
                      paddingTop: isMobile ? "12px" : "20px",
                      fontSize: isMobile ? "11px" : "13px",
                    }}
                    iconType="line"
                    iconSize={isMobile ? 8 : 14}
                  />
                  <Line
                    type="monotone"
                    dataKey="watchTime"
                    stroke="url(#purpleGradient)"
                    name="Watch Time (h)"
                    strokeWidth={isMobile ? 2 : 3}
                    dot={{
                      fill: "#a855f7",
                      r: isMobile ? 2 : 4,
                      strokeWidth: 0,
                    }}
                    activeDot={{
                      r: isMobile ? 4 : 6,
                      fill: "#a855f7",
                      stroke: "rgba(168, 85, 247, 0.3)",
                      strokeWidth: isMobile ? 6 : 8,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="showsWatched"
                    stroke="url(#blueGradient)"
                    name="Shows Watched"
                    strokeWidth={isMobile ? 2 : 3}
                    dot={{
                      fill: "#3b82f6",
                      r: isMobile ? 2 : 4,
                      strokeWidth: 0,
                    }}
                    activeDot={{
                      r: isMobile ? 4 : 6,
                      fill: "#3b82f6",
                      stroke: "rgba(59, 130, 246, 0.3)",
                      strokeWidth: isMobile ? 6 : 8,
                    }}
                  />
                  {showComparison &&
                  comparisonTrends &&
                  Array.isArray(comparisonTrends) ? (
                    <>
                      <Line
                        type="monotone"
                        dataKey="watchTimeLastYear"
                        stroke="rgba(255,255,255,0.3)"
                        name="Watch Time Last Year (hours)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{
                          fill: "rgba(255,255,255,0.3)",
                          r: 3,
                          strokeWidth: 0,
                        }}
                        activeDot={{
                          r: 5,
                          fill: "rgba(255,255,255,0.5)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="showsWatchedLastYear"
                        stroke="rgba(255,255,255,0.2)"
                        name="Shows Watched Last Year"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{
                          fill: "rgba(255,255,255,0.2)",
                          r: 3,
                          strokeWidth: 0,
                        }}
                        activeDot={{
                          r: 5,
                          fill: "rgba(255,255,255,0.4)",
                        }}
                      />
                    </>
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
              </div>
            )}

            {showComparison &&
            chartData.length > 0 &&
            comparisonTrends &&
            Array.isArray(comparisonTrends) ? (
              <ComparisonView
                chartData={chartData}
                comparisonTrends={comparisonTrends as TrendItem[]}
              />
            ) : null}
          </CardContent>
        </Card>

        <Milestones />
        <PeriodSummary />
        <YearInReview />
        <WatchPatternHeatmap />
        <MostWatched />

        <div className="grid gap-6 md:grid-cols-2">
          <WatchTimeChart />
          <GenreBreakdown />
        </div>
        </div>
      </PageContent>
    </AppLayout>
  );
}
