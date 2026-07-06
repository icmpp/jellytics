"use client";

import { useGoals } from "@/hooks/useStats";
import { Flame, Trophy } from "lucide-react";

export function GoalsWidget() {
  const { data, isLoading } = useGoals();

  if (isLoading || !data) return null;

  return (
    <div className="relative overflow-hidden border border-[#16162a] bg-[#07070d] flex flex-col hover:border-amber-500/25 transition-colors duration-200">
      <div className="h-0.5 w-full bg-amber-500/50 shrink-0" />
      <div className="relative p-4 sm:p-5 flex flex-col flex-1">
        <div className="flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-amber-400/70 shrink-0" />
          <p className="text-[9px] sm:text-[10px] font-mono text-violet-300/65 uppercase tracking-[0.15em] select-none">
            <span className="text-violet-400/45 mr-0.5">{"// "}</span>streak
          </p>
        </div>
        <p className="mt-3 text-2xl sm:text-3xl font-mono font-bold text-white tabular-nums tracking-tight leading-none">
          {data.current_streak}d
        </p>
        <div className="mt-2 h-[18px] flex items-center">
          {data.longest_streak > 0 ? (
            <div className="flex items-center gap-1 text-white/45">
              <Trophy className="h-3 w-3 text-amber-400/55 shrink-0" />
              <span className="text-[10px] font-mono tabular-nums">
                best {data.longest_streak}d
              </span>
            </div>
          ) : (
            <span className="text-[10px] font-mono text-white/35">watch today to start</span>
          )}
        </div>
      </div>
    </div>
  );
}
