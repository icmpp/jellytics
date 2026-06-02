"use client";

import { useState } from "react";
import { TrendingUp, Film, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { WatchTimeChartContent } from "@/components/stats/WatchTimeChart";
import { TopGenresContent } from "@/components/dashboard/TopGenres";
import { GenreBreakdownContent } from "@/components/stats/GenreBreakdown";

const TABS = [
  { id: "watchtime",  label: "watch_time_trend",  icon: TrendingUp },
  { id: "topgenres",  label: "top_genres",         icon: Film       },
  { id: "breakdown",  label: "genre_breakdown",    icon: PieChart   },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AnalyticsWindow() {
  const [active, setActive] = useState<TabId>("watchtime");

  return (
    <div className="rounded-sm border border-[#16162a] overflow-hidden">
      {/* Terminal title bar with tabs */}
      <div
        className="flex items-stretch border-b border-[#16162a]"
        style={{ background: "#06060d" }}
      >
        {/* Window chrome dots */}
        <div className="flex items-center gap-1.5 px-3 border-r border-[#16162a] shrink-0">
          <div className="w-2 h-2 rounded-full bg-[#ef4444]/70" />
          <div className="w-2 h-2 rounded-full bg-[#f59e0b]/70" />
          <div className="w-2 h-2 rounded-full bg-[#22c55e]/70" />
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={cn(
                  "group relative flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-mono whitespace-nowrap border-r border-[#16162a] transition-colors",
                  isActive
                    ? "bg-[#07070d] text-violet-300/90"
                    : "text-white/30 hover:text-white/60 hover:bg-[#0a0a14]",
                )}
              >
                {isActive && (
                  <span className="absolute inset-x-0 top-0 h-px bg-violet-500" />
                )}
                <Icon
                  className={cn(
                    "h-3 w-3 shrink-0 transition-colors",
                    isActive
                      ? "text-violet-400/60"
                      : "text-white/20 group-hover:text-white/40",
                  )}
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content — all tabs mounted so data stays fresh; only active is visible */}
      <div className="bg-[#07070d] p-4 sm:p-5 min-h-[400px]">
        <div className={active === "watchtime" ? "" : "hidden"}><WatchTimeChartContent /></div>
        <div className={active === "topgenres" ? "" : "hidden"}><TopGenresContent /></div>
        <div className={active === "breakdown" ? "" : "hidden"}><GenreBreakdownContent /></div>
      </div>
    </div>
  );
}
