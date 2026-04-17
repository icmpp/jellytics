"use client";

import { useState, useMemo } from "react";
import { useStatsOverview } from "@/hooks/useStats";
import { toast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { AppLayout, PageHeader, PageContent } from "@/components/layout";
import {
  Download,
  FileText,
  FileSpreadsheet,
  BarChart3,
  FileJson,
  ChevronDown,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { exportStatsToExcel, exportStatsToPDF } from "@/lib/export";
import { useRatingsList } from "@/hooks/useRatings";
import { useReviewsList } from "@/hooks/useReviews";
import { useTrends, useGenreBreakdown } from "@/hooks/useStats";
import { OverviewCards } from "@/components/stats/OverviewCards";
import { TrendsChart } from "@/components/stats/TrendsChart";
import { WatchTimeChart } from "@/components/stats/WatchTimeChart";
import { GenreBreakdown } from "@/components/stats/GenreBreakdown";
import { MostWatched } from "@/components/stats/MostWatched";
import { Milestones } from "@/components/stats/Milestones";
import { PeriodSummary } from "@/components/stats/PeriodSummary";
import { YearInReview } from "@/components/stats/YearInReview";
import { WatchPatternHeatmap } from "@/components/stats/WatchPatternHeatmap";
import { format } from "date-fns";

interface TrendItem {
  snapshot_date: string;
  total_watch_time_minutes: number;
  delta_watch_time_minutes?: number;
  shows_watched: number;
  shows_watching: number;
  episodes_watched: number;
  delta_episodes_watched?: number;
}

export default function StatsPage() {
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const { data: overview } = useStatsOverview();
  const { data: ratings = [] } = useRatingsList();
  const { data: reviews = [] } = useReviewsList();
  const { data: trends } = useTrends(30, "daily");
  const { data: genres } = useGenreBreakdown();

  const breadcrumbItems = useMemo(
    () => [{ icon: "home" as const, href: "/dashboard" }, { label: "Statistics" }],
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
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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
    } catch {
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
        toast.error({ title: "Export failed", description: "No trend data available to export." });
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
    } catch {
      toast.error({
        title: "Export failed",
        description: "Failed to export statistics as CSV.",
      });
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = async () => {
    setExporting("excel");
    try {
      if (overview || trends || genres || ratings.length > 0 || reviews.length > 0) {
        exportStatsToExcel(overview, trends as TrendItem[], genres, undefined, ratings, reviews);
        toast.success({
          title: "Export successful",
          description: "Statistics exported as Excel successfully.",
        });
        setExportOpen(false);
      } else {
        toast.error({ title: "Export failed", description: "No data available to export." });
      }
    } catch {
      toast.error({ title: "Export failed", description: "Failed to export as Excel." });
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
          trends as TrendItem[],
          genres,
          `jellyfin-stats-${format(new Date(), "yyyy-MM-dd")}`,
        );
        toast.success({
          title: "Export successful",
          description: "Statistics exported as PDF successfully.",
        });
        setExportOpen(false);
      } else {
        toast.error({ title: "Export failed", description: "No data available for PDF export." });
      }
    } catch {
      toast.error({ title: "Export failed", description: "Failed to export as PDF." });
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
                  <ExportButton
                    label="JSON"
                    description="Full data export"
                    icon={<FileJson className="h-4 w-4 text-amber-400" />}
                    iconBg="bg-amber-500/20 group-hover:bg-amber-500/30"
                    onClick={exportJSON}
                    loading={exporting === "json"}
                  />
                  <ExportButton
                    label="CSV"
                    description="Spreadsheet compatible"
                    icon={<FileText className="h-4 w-4 text-emerald-400" />}
                    iconBg="bg-emerald-500/20 group-hover:bg-emerald-500/30"
                    onClick={exportCSV}
                    loading={exporting === "csv"}
                    disabled={!trends}
                  />
                  <ExportButton
                    label="Excel"
                    description="Multi-sheet workbook"
                    icon={<FileSpreadsheet className="h-4 w-4 text-green-400" />}
                    iconBg="bg-green-500/20 group-hover:bg-green-500/30"
                    onClick={exportExcel}
                    loading={exporting === "excel"}
                    disabled={!overview || !trends || !genres}
                  />
                  <ExportButton
                    label="PDF"
                    description="Print-ready report"
                    icon={<FileText className="h-4 w-4 text-red-400" />}
                    iconBg="bg-red-500/20 group-hover:bg-red-500/30"
                    onClick={exportPDF}
                    loading={exporting === "pdf"}
                  />
                </div>
              </PopoverContent>
            </Popover>
          }
        />

        <div id="stats-content" className="space-y-6">
          <OverviewCards />
          <TrendsChart />

          <div className="grid gap-6 lg:grid-cols-2">
            <PeriodSummary />
            <WatchPatternHeatmap />
          </div>

          <Milestones />
          <MostWatched />

          <div className="grid gap-6 md:grid-cols-2">
            <WatchTimeChart />
            <GenreBreakdown />
          </div>

          <YearInReview />
        </div>
      </PageContent>
    </AppLayout>
  );
}

function ExportButton({
  label,
  description,
  icon,
  iconBg,
  onClick,
  loading,
  disabled,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/6 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className={`p-2 rounded-lg transition-colors ${iconBg}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-white/40">{description}</p>
      </div>
      {loading && (
        <div className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      )}
    </button>
  );
}
