"use client";

import { useMemo } from "react";
import { useMilestones, type Milestone } from "@/hooks/useStats";
import { Trophy } from "lucide-react";

export function Milestones() {
  const { data: milestones, isLoading } = useMilestones();

  const { ordered, achievedCount } = useMemo((): {
    ordered: Milestone[];
    achievedCount: number;
  } => {
    if (!milestones?.length) return { ordered: [], achievedCount: 0 };
    const achieved = milestones.filter((m) => m.achieved);
    const locked = milestones.filter((m) => !m.achieved);
    return {
      ordered: [...achieved, ...locked],
      achievedCount: achieved.length,
    };
  }, [milestones]);

  if (isLoading) return null;
  if (!milestones?.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-white">Milestones</h2>
        <span className="text-sm text-white/40">
          {achievedCount}/{milestones!.length} unlocked
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none scroll-snap-x">
        {ordered.map((m) => (
          <div
            key={m.id}
            className={`shrink-0 w-36 sm:w-44 rounded-2xl border p-3 sm:p-4 transition-all scroll-snap-start ${
              m.achieved
                ? "bg-amber-500/10 border-amber-500/20"
                : "bg-white/[0.02] border-white/[0.06] opacity-40"
            }`}
          >
            <div className="text-2xl mb-2">{m.icon}</div>
            <p className="text-sm font-semibold text-white mb-1">{m.title}</p>
            <p className="text-xs text-white/50 leading-snug">{m.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
