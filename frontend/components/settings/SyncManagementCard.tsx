"use client";

import { RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SyncStatus } from "./types";

interface Props {
  syncStatus: SyncStatus | null;
  syncing: boolean;
  loadingSyncStatus: boolean;
  serverURL: string;
  onSync: () => void;
  onRefreshStatus: () => void;
}

export function SyncManagementCard({
  syncStatus,
  syncing,
  loadingSyncStatus,
  serverURL,
  onSync,
  onRefreshStatus,
}: Props) {
  return (
    <Card className="relative overflow-hidden flex flex-col">
      <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-3xl opacity-15 bg-purple-500" />
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-purple-400" />
          Sync Management
        </CardTitle>
        <CardDescription>Trigger syncs and monitor your last sync status</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 flex-1">
        {/* Manual sync */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
              Manual Sync
            </span>
            <p className="text-sm text-white/60">
              Trigger an immediate sync with your Jellyfin library
            </p>
          </div>
          <Button onClick={onSync} disabled={syncing || !serverURL} className="shrink-0">
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Sync Now
              </>
            )}
          </Button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/6" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-white/25 uppercase tracking-widest">
              Last Sync
            </span>
            <button
              onClick={onRefreshStatus}
              disabled={loadingSyncStatus}
              className="p-1 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors disabled:opacity-50"
              aria-label="Refresh sync status"
            >
              {loadingSyncStatus ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </button>
          </div>
          <div className="flex-1 h-px bg-white/6" />
        </div>

        {/* Status content */}
        <div className="flex-1 flex flex-col justify-center">
          {loadingSyncStatus ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
            </div>
          ) : syncStatus ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                  <div className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                    Status
                  </div>
                  <div
                    className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
                      syncStatus.status === "success"
                        ? "text-emerald-400 bg-emerald-500/10"
                        : syncStatus.status === "failed"
                          ? "text-red-400 bg-red-500/10"
                          : syncStatus.status === "in_progress"
                            ? "text-amber-400 bg-amber-500/10"
                            : "text-white/40 bg-white/5"
                    }`}
                  >
                    {syncStatus.status === "success"
                      ? "Success"
                      : syncStatus.status === "failed"
                        ? "Failed"
                        : syncStatus.status === "in_progress"
                          ? "In Progress"
                          : syncStatus.status === "never"
                            ? "Never"
                            : "Unknown"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                  <div className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                    Last Sync
                  </div>
                  <div className="text-sm font-medium text-white">
                    {syncStatus.last_sync_at
                      ? new Date(syncStatus.last_sync_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Never"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                  <div className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                    Items Synced
                  </div>
                  <div className="text-sm font-medium text-white tabular-nums">
                    {syncStatus.items_synced ?? 0}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                  <div className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                    Duration
                  </div>
                  <div className="text-sm font-medium text-white tabular-nums">
                    {syncStatus.duration_seconds !== null &&
                    syncStatus.duration_seconds !== undefined
                      ? `${syncStatus.duration_seconds.toFixed(1)}s`
                      : "—"}
                  </div>
                </div>
              </div>

              {syncStatus.items_failed > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs font-medium text-amber-400">
                    {syncStatus.items_failed} item{syncStatus.items_failed !== 1 ? "s" : ""} failed
                    to sync
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <RefreshCw className="h-5 w-5 text-white/15" />
              <p className="text-xs text-white/25">No sync data yet — run a sync to see results</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
