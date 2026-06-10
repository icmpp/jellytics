"use client";

import { useState, useMemo } from "react";
import { useStatsOverview } from "@/hooks/useStats";
import { toast } from "@/hooks/useToast";
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
      <PageHeader
        breadcrumb={breadcrumbItems}
        title="Statistics"
        description="Detailed analytics and insights"
        icon={<BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" />}
        actions={
          <Popover open={exportOpen} onOpenChange={setExportOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`inline-flex h-11 items-center gap-2 rounded-sm border px-3 font-mono text-xs transition-colors ${
                  exportOpen
                    ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                    : "border-[#16162a] bg-[#0a0a14] text-white/70 hover:bg-[#0d0d1a]"
                }`}
              >
                <Download className="h-4 w-4 shrink-0" />
                export
                <ChevronDown
                  className={`h-4 w-4 opacity-50 transition-transform ${exportOpen ? "rotate-180" : ""}`}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              className="w-[min(18rem,calc(100vw-2rem))] rounded-sm border-[#16162a] bg-[#07070d] p-2 font-mono"
            >
              <div className="space-y-1">
                <p className="px-2 py-1.5 text-[10px] text-violet-300/55 uppercase tracking-[0.15em]">
                  <span className="text-violet-400/45 select-none">{"# "}</span>
                  export_format
                </p>
                <ExportButton
                  label="json"
                  description="full data export"
                  icon={<FileJson className="h-4 w-4 text-amber-400/80" />}
                  onClick={exportJSON}
                  loading={exporting === "json"}
                />
                <ExportButton
                  label="csv"
                  description="spreadsheet compatible"
                  icon={<FileText className="h-4 w-4 text-emerald-400/80" />}
                  onClick={exportCSV}
                  loading={exporting === "csv"}
                  disabled={!trends}
                />
                <ExportButton
                  label="excel"
                  description="multi-sheet workbook"
                  icon={<FileSpreadsheet className="h-4 w-4 text-green-400/80" />}
                  onClick={exportExcel}
                  loading={exporting === "excel"}
                  disabled={!overview || !trends || !genres}
                />
                <ExportButton
                  label="pdf"
                  description="print-ready report"
                  icon={<FileText className="h-4 w-4 text-red-400/80" />}
                  onClick={exportPDF}
                  loading={exporting === "pdf"}
                />
              </div>
            </PopoverContent>
          </Popover>
        }
      />
      <PageContent>
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
  onClick,
  loading,
  disabled,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="group w-full flex items-center gap-3 rounded-sm border border-transparent px-2 py-2 text-left transition-colors hover:border-[#16162a] hover:bg-[#0d0d1a] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-[#16162a] bg-[#0a0a14]">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/80 group-hover:text-violet-300">
          <span className="text-violet-400/45 select-none">{"> "}</span>
          {label}
        </p>
        <p className="text-[10px] text-white/35">
          <span className="text-violet-400/30 select-none">{"# "}</span>
          {description}
        </p>
      </div>
      {loading && (
        <div className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
      )}
    </button>
  );
}
