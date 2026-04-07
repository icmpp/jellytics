"use client";

import { useState } from "react";
import { useGoals } from "@/hooks/useStats";
import { formatRuntime } from "@/lib/utils";
import { Target, Flame, Trophy, RotateCcw } from "lucide-react";

// ─── Ring ────────────────────────────────────────────────────────────────────

interface RingProps {
  pct: number;
  label: string;
  progress: number;
  target: number;
  strokeClass: string;
  showRemaining: boolean;
  onClick: () => void;
}

function Ring({ pct, label, progress, target, strokeClass, showRemaining, onClick }: RingProps) {
  const size = 88;
  const sw = 6;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = circ * (1 - clamped / 100);
  const complete = pct >= 100;
  const remaining = Math.max(0, target - progress);

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-2 focus:outline-none"
    >
      <div
        className="relative transition-transform duration-200 group-hover:scale-[1.04]"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          className="absolute inset-0"
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" strokeWidth={sw}
            className="stroke-white/8"
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" strokeWidth={sw}
            className={complete ? "stroke-emerald-400" : strokeClass}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
          />
        </svg>

        {/* Centre — flips between % and remaining */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 select-none">
          {complete ? (
            <span className="text-xs font-semibold text-emerald-400">Done</span>
          ) : showRemaining ? (
            <>
              <span className="text-sm font-bold tabular-nums text-white leading-none">
                {formatRuntime(remaining) ?? "0m"}
              </span>
              <span className="text-[9px] text-white/30 uppercase tracking-wide">left</span>
            </>
          ) : (
            <span className="text-lg font-bold tabular-nums text-white leading-none">
              {Math.round(clamped)}%
            </span>
          )}
        </div>

        {/* Swap hint — visible on hover only */}
        {!complete && (
          <div className="absolute inset-0 flex items-end justify-end pb-1 pr-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
            <RotateCcw className="h-2.5 w-2.5 text-white/25" />
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest">{label}</p>
        <p className="mt-0.5 text-[11px] text-white/50 tabular-nums">
          {formatRuntime(progress) ?? "0m"}
          <span className="text-white/20"> / {formatRuntime(target) ?? "0m"}</span>
        </p>
      </div>
    </button>
  );
}

// ─── Streak dots ─────────────────────────────────────────────────────────────

function StreakDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 7 }, (_, i) => {
        const isLit = current >= 7 - i;
        const isToday = i === 6;
        return (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              isLit
                ? isToday
                  ? "h-2.5 w-2.5 bg-amber-400"
                  : "h-2 w-2 bg-amber-400/50"
                : "h-2 w-2 bg-white/10"
            }`}
          />
        );
      })}
    </div>
  );
}

// ─── GoalsWidget ─────────────────────────────────────────────────────────────

export function GoalsWidget() {
  const { data, isLoading } = useGoals();
  const [weeklyFlipped, setWeeklyFlipped] = useState(false);
  const [monthlyFlipped, setMonthlyFlipped] = useState(false);

  if (isLoading || !data) return null;

  const hasGoals = data.weekly_target > 0 || data.monthly_target > 0;
  const hasStreak = data.current_streak > 0 || data.longest_streak > 0;

  if (!hasGoals && !hasStreak) return null;

  const weeklyPct =
    data.weekly_target > 0 ? (data.weekly_progress / data.weekly_target) * 100 : 0;
  const monthlyPct =
    data.monthly_target > 0 ? (data.monthly_progress / data.monthly_target) * 100 : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-4 sm:p-5 flex flex-col gap-5 hover:border-white/12 hover:bg-white/5 transition-all duration-300">
      <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-3xl opacity-12 bg-purple-500" />

      {/* Header */}
      <div className="relative flex items-center gap-2">
        <div className="flex items-center justify-center p-2 rounded-xl bg-purple-500/15 border border-purple-500/25">
          <Target className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
        </div>
        <h2 className="text-sm sm:text-base font-semibold text-white">Goals & Streaks</h2>
      </div>

      {/* Rings */}
      {hasGoals && (
        <div className="relative flex items-start justify-center gap-8 sm:gap-12">
          {data.weekly_target > 0 && (
            <Ring
              pct={weeklyPct}
              label="Weekly"
              progress={data.weekly_progress}
              target={data.weekly_target}
              strokeClass="stroke-purple-400"
              showRemaining={weeklyFlipped}
              onClick={() => setWeeklyFlipped((v) => !v)}
            />
          )}
          {data.monthly_target > 0 && (
            <Ring
              pct={monthlyPct}
              label="Monthly"
              progress={data.monthly_progress}
              target={data.monthly_target}
              strokeClass="stroke-blue-400"
              showRemaining={monthlyFlipped}
              onClick={() => setMonthlyFlipped((v) => !v)}
            />
          )}
        </div>
      )}

      {/* Streak */}
      {hasStreak && (
        <div className={`relative flex items-center justify-between gap-3 ${hasGoals ? "pt-4 border-t border-white/6" : ""}`}>
          <div className="flex items-center gap-2 shrink-0">
            <Flame className="h-4 w-4 text-amber-400" />
            <span className="text-2xl font-bold text-white tabular-nums leading-none">
              {data.current_streak}
            </span>
            <span className="text-xs text-white/40">days</span>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <StreakDots current={data.current_streak} />
            {data.longest_streak > 0 && (
              <div className="flex items-center gap-1 text-white/25">
                <Trophy className="h-3 w-3 text-amber-400/40" />
                <span className="text-[10px] tabular-nums">
                  best {data.longest_streak}d
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
