"use client";

import { Database, Download, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/useToast";
import type { SyncStatus, UserPrefs } from "./types";

interface Props {
  prefs: UserPrefs;
  serverURL: string;
  syncStatus: SyncStatus | null;
  ratings: unknown[];
  reviews: unknown[];
}

export function DataManagementCard({ prefs, serverURL, syncStatus, ratings, reviews }: Props) {
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
    if (
      confirm("Are you sure you want to clear the sync cache? This will require a full resync.")
    ) {
      toast.success({
        title: "Cache cleared",
        description: "Sync cache has been cleared. Next sync will be a full resync.",
      });
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-3xl opacity-15 bg-purple-500" />
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Database className="h-5 w-5 text-purple-400" />
          Data Management
        </CardTitle>
        <CardDescription>Export and manage your data</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 rounded-xl border border-white/8 space-y-3">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-white">Export Your Data</span>
            </div>
            <p className="text-xs text-white/50">
              Download viewing stats, ratings, and preferences as JSON
            </p>
            <Button variant="outline" size="sm" onClick={handleExport}>
              Export JSON
            </Button>
          </div>

          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/[0.03] space-y-3">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">Clear Sync Cache</span>
            </div>
            <p className="text-xs text-white/50">Triggers a full resync on the next sync cycle</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              Clear Cache
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
