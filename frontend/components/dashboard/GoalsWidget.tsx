"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGoals } from "@/hooks/useStats";
import { formatRuntime } from "@/lib/utils";
import { Target, Flame, Trophy } from "lucide-react";

export function GoalsWidget() {
  const { data, isLoading } = useGoals();

  if (isLoading || !data) return null;

  const hasGoals =
    (data.weekly_target > 0 || data.monthly_target > 0) || data.longest_streak > 0;

  if (!hasGoals && data.current_streak === 0) return null;

  const weeklyPct =
    data.weekly_target > 0
      ? Math.min(100, (data.weekly_progress / data.weekly_target) * 100)
      : 0;
  const monthlyPct =
    data.monthly_target > 0
      ? Math.min(100, (data.monthly_progress / data.monthly_target) * 100)
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-purple-400" />
          Goals & Streaks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(data.weekly_target > 0 || data.monthly_target > 0) && (
          <div className="space-y-3">
            {data.weekly_target > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/60">This week</span>
                  <span className="text-white/80">
                    {formatRuntime(data.weekly_progress) ?? "0m"} /{" "}
                    {formatRuntime(data.weekly_target) ?? "0m"}
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${weeklyPct}%` }}
                  />
                </div>
              </div>
            )}
            {data.monthly_target > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/60">This month</span>
                  <span className="text-white/80">
                    {formatRuntime(data.monthly_progress) ?? "0m"} /{" "}
                    {formatRuntime(data.monthly_target) ?? "0m"}
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${monthlyPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" />
            <span className="text-sm text-white/70">
              Current streak: <strong className="text-white">{data.current_streak}</strong>{" "}
              days
            </span>
          </div>
          {data.longest_streak > 0 && (
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-white/50">
                Best: {data.longest_streak} days
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
