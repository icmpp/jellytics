"use client";

import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/layout";
import { useCurrentlyWatching } from "@/hooks/useStats";
import {
  Play,
  Pause,
  Film,
  Tv,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { PROGRESS_BAR_CLASS } from "@/lib/utils";

function formatTime(ticks: number): string {
  const seconds = Math.floor(ticks / 10000000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function getDeviceIcon(deviceType: string, clientName: string) {
  const lowerDevice = deviceType.toLowerCase();
  const lowerClient = clientName.toLowerCase();

  if (lowerDevice.includes("mobile") || lowerClient.includes("mobile")) {
    return <Smartphone className="h-4 w-4" />;
  }
  if (lowerDevice.includes("tablet") || lowerClient.includes("tablet")) {
    return <Tablet className="h-4 w-4" />;
  }
  if (
    lowerDevice.includes("tv") ||
    lowerClient.includes("android tv") ||
    lowerClient.includes("roku")
  ) {
    return <Tv className="h-4 w-4" />;
  }
  return <Monitor className="h-4 w-4" />;
}

function getItemIcon(itemType: string) {
  return itemType === "Movie" ? (
    <Film className="h-5 w-5" />
  ) : (
    <Tv className="h-5 w-5" />
  );
}

export function CurrentlyWatching() {
  const { data, isLoading, isFetching } = useCurrentlyWatching();

  const isEmpty = !data || data.count === 0;

  return (
    <Card>
      <CardContent>
        <SectionHeader
          icon={<Play className="h-5 w-5 text-purple-400" />}
          title="Currently Watching"
          extra={
            !isEmpty ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-normal text-white/40">
                  ({data.count})
                </span>
                {isFetching && !isLoading && (
                  <div className="h-1 w-16 bg-purple-500/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 animate-pulse"
                      style={{ width: "60%" }}
                    />
                  </div>
                )}
              </div>
            ) : undefined
          }
        />

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2"
              >
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="min-h-[220px] flex flex-col items-center justify-center text-center">
            <Play className="h-10 w-10 text-white/15 mb-3" />
            <p className="text-sm font-medium text-white/60">Nothing playing right now</p>
            <p className="text-xs text-white/40 mt-1">
              Active Jellyfin sessions will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.sessions.map((session) => {
              const timePosition = formatTime(session.position_ticks);
              const timeRemaining = formatTime(
                Math.max(0, session.runtime_ticks - session.position_ticks),
              );
              const progressPercent =
                session.runtime_ticks > 0
                  ? (session.position_ticks / session.runtime_ticks) * 100
                  : 0;

              return (
                <div
                  key={session.id}
                  className="p-4 rounded-2xl bg-white/3 border border-white/8 hover:bg-white/6 hover:border-white/12 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 shrink-0">
                      {getItemIcon(session.item_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-white truncate">
                          {session.item_name}
                        </h3>
                        <div className="flex items-center gap-1 shrink-0">
                          {session.is_paused ? (
                            <Pause className="h-3 w-3 text-white/40" />
                          ) : (
                            <Play className="h-3 w-3 text-purple-400" />
                          )}
                        </div>
                      </div>

                      {session.item_type === "Episode" && session.series_name && (
                        <p className="text-xs text-white/40 mb-2 truncate">
                          {session.series_name}
                          {session.season_number &&
                            session.episode_number &&
                            ` • S${session.season_number}E${session.episode_number}`}
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-xs text-white/40 mb-3">
                        <div className="flex items-center gap-1">
                          {getDeviceIcon(session.device_type, session.client_name)}
                          <span className="truncate">
                            {session.device_name || session.client_name}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className={PROGRESS_BAR_CLASS}>
                          <div
                            className="h-full bg-linear-to-r from-purple-500 to-purple-400 transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-white/40">
                          <span>{timePosition}</span>
                          <span>
                            {Math.round(session.playback_percentage)}% •{" "}
                            {timeRemaining} left
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
