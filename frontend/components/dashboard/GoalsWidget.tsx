"use client";

import { useGoals } from "@/hooks/useStats";
import { Flame, Trophy } from "lucide-react";

export function GoalsWidget() {
  const { data, isLoading } = useGoals();

  if (isLoading || !data) return null;

  const hasStreak = data.current_streak > 0 || data.longest_streak > 0;

  if (!hasStreak) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-4 sm:p-5 flex flex-col gap-2 hover:border-white/12 hover:bg-white/5 transition-all duration-300 h-full">
      <p className="text-[10px] sm:text-xs font-medium text-white/40 uppercase tracking-widest">
        Goals &amp; Streaks
      </p>
      <div className="flex items-center gap-2 leading-none">
        <Flame className="h-6 w-6 text-amber-400 shrink-0" />
        <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums tracking-tight leading-none">
          {data.current_streak}
        </span>
        <span className="text-sm text-white/40 font-medium">days</span>
      </div>
      {data.longest_streak > 0 && (
        <div className="pt-0.5 flex items-center gap-1 text-white/30">
          <Trophy className="h-3 w-3 text-amber-400/50 shrink-0" />
          <span className="text-[10px] sm:text-xs font-medium tabular-nums">
            best {data.longest_streak}d
          </span>
        </div>
      )}
    </div>
  );
}
