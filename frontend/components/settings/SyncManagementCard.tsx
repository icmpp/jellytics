"use client";

import { RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsCardHeader, FieldLabel, TerminalButton } from "./SettingsPrimitives";
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
    <Card className="flex flex-col">
      <SettingsCardHeader
        icon={<RefreshCw className="h-5 w-5" />}
        title="sync_management"
        description="Trigger syncs and monitor your last sync status"
      />
      <CardContent className="flex flex-col gap-6 flex-1">
        {/* Manual sync */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <FieldLabel>manual_sync</FieldLabel>
            <p className="font-mono text-sm text-white/60">
              Trigger an immediate sync with your Jellyfin library
            </p>
          </div>
          <TerminalButton onClick={onSync} disabled={syncing || !serverURL} className="shrink-0">
            {syncing ? (
              <>
                <Loader2 className="animate-spin" />
                syncing...
              </>
            ) : (
              <>
                <RefreshCw />
                sync_now
              </>
            )}
          </TerminalButton>
        </div>

        {/* Divider with refresh control */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#16162a]" />
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-violet-400/40">
              last_sync
            </span>
            <button
              onClick={onRefreshStatus}
              disabled={loadingSyncStatus}
              className="rounded-sm p-1 text-white/30 transition-colors hover:bg-[#0d0d1a] hover:text-white/60 disabled:opacity-50"
              aria-label="Refresh sync status"
            >
              {loadingSyncStatus ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </button>
          </div>
          <div className="h-px flex-1 bg-[#16162a]" />
        </div>

        {/* Status content */}
        <div className="flex-1 flex flex-col justify-center">
          {loadingSyncStatus ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            </div>
          ) : syncStatus ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5 rounded-sm border border-[#16162a] bg-[#0a0a14] p-3">
                  <FieldLabel>status</FieldLabel>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-xs font-semibold ${
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
                        ? "success"
                        : syncStatus.status === "failed"
                          ? "failed"
                          : syncStatus.status === "in_progress"
                            ? "in_progress"
                            : syncStatus.status === "never"
                              ? "never"
                              : "unknown"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-sm border border-[#16162a] bg-[#0a0a14] p-3">
                  <FieldLabel>last_sync</FieldLabel>
                  <div className="font-mono text-sm font-medium text-white">
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

                <div className="space-y-1.5 rounded-sm border border-[#16162a] bg-[#0a0a14] p-3">
                  <FieldLabel>items_synced</FieldLabel>
                  <div className="font-mono text-sm font-medium text-white tabular-nums">
                    {syncStatus.items_synced ?? 0}
                  </div>
                </div>

                <div className="space-y-1.5 rounded-sm border border-[#16162a] bg-[#0a0a14] p-3">
                  <FieldLabel>duration</FieldLabel>
                  <div className="font-mono text-sm font-medium text-white tabular-nums">
                    {syncStatus.duration_seconds !== null &&
                    syncStatus.duration_seconds !== undefined
                      ? `${syncStatus.duration_seconds.toFixed(1)}s`
                      : "—"}
                  </div>
                </div>
              </div>

              {syncStatus.items_failed > 0 && (
                <div className="flex items-center gap-2 rounded-sm border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="font-mono text-xs font-medium text-amber-400">
                    {syncStatus.items_failed} item{syncStatus.items_failed !== 1 ? "s" : ""} failed
                    to sync
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <RefreshCw className="h-5 w-5 text-white/15" />
              <p className="font-mono text-xs text-white/25">
                no sync data yet — run a sync to see results
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
