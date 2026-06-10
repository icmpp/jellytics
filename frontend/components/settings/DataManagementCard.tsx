"use client";

import { useState } from "react";
import { Database, Download, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmPopover } from "@/components/ui/confirm-popover";
import { toast } from "@/hooks/useToast";
import { SettingsCardHeader, TerminalButton } from "./SettingsPrimitives";
import type { SyncStatus, UserPrefs } from "./types";

interface Props {
  prefs: UserPrefs;
  serverURL: string;
  syncStatus: SyncStatus | null;
  ratings: unknown[];
  reviews: unknown[];
}

export function DataManagementCard({ prefs, serverURL, syncStatus, ratings, reviews }: Props) {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const handleExport = async () => {
    try {
      const data = {
        preferences: prefs,
        settings: { jellyfin_server_url: serverURL },
        syncStatus,
        ratings,
        reviews,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jellytics-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success({
        title: "Export successful",
        description: "Your data has been exported successfully.",
      });
    } catch (err) {
      console.warn("Export failed:", err);
      toast.error({
        title: "Export failed",
        description: "Failed to export data. Please try again.",
      });
    }
  };

  const handleClearCache = () => {
    setConfirmClearOpen(false);
    toast.success({
      title: "Cache cleared",
      description: "Sync cache has been cleared. Next sync will be a full resync.",
    });
  };

  return (
    <Card>
      <SettingsCardHeader
        icon={<Database className="h-5 w-5" />}
        title="data_management"
        description="Export and manage your data"
      />
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-sm border border-[#16162a] bg-[#0a0a14] p-4">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-violet-400/70" />
              <span className="font-mono text-sm font-medium text-white">export_your_data</span>
            </div>
            <p className="font-mono text-xs text-white/50">
              Download viewing stats, ratings, and preferences as JSON
            </p>
            <TerminalButton variant="idle" onClick={handleExport} className="h-9">
              export_json
            </TerminalButton>
          </div>

          <div className="space-y-3 rounded-sm border border-red-500/20 bg-red-500/4 p-4">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-400" />
              <span className="font-mono text-sm font-medium text-red-400">clear_sync_cache</span>
            </div>
            <p className="font-mono text-xs text-white/50">
              Triggers a full resync on the next sync cycle
            </p>
            <ConfirmPopover
              open={confirmClearOpen}
              onOpenChange={setConfirmClearOpen}
              theme="terminal"
              variant="destructive"
              align="start"
              side="top"
              title="clear sync cache?"
              description={
                <>
                  this forces a <span className="text-red-300">full resync</span> on the next sync
                  cycle.
                </>
              }
              confirmLabel="clear cache"
              confirmIcon={Trash2}
              onConfirm={handleClearCache}
            >
              <TerminalButton variant="danger" className="h-9">
                clear_cache
              </TerminalButton>
            </ConfirmPopover>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
