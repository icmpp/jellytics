"use client";

import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SettingsCheckbox } from "./SettingsCheckbox";
import type { UserPrefs } from "./types";

interface Props {
  prefs: UserPrefs;
  setPrefs: (prefs: UserPrefs) => void;
}

export function SyncPreferencesCard({ prefs, setPrefs }: Props) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-3xl opacity-15 bg-purple-500" />
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-purple-400" />
          Sync Preferences
        </CardTitle>
        <CardDescription>Configure automatic sync behavior</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingsCheckbox
          id="auto_sync"
          checked={prefs.auto_sync}
          onChange={(checked) => setPrefs({ ...prefs, auto_sync: checked })}
          label="Auto Sync"
          description="Automatically sync with Jellyfin server"
        />

        <div className="space-y-2">
          <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
            Sync Interval
          </span>
          <div className="flex items-center gap-3">
            <Input
              id="sync_interval"
              type="number"
              min="5"
              max="1440"
              step="5"
              value={prefs.sync_interval_minutes}
              onChange={(e) =>
                setPrefs({ ...prefs, sync_interval_minutes: parseInt(e.target.value) || 60 })
              }
              className="w-32"
            />
            <span className="text-sm text-white/40">minutes</span>
          </div>
          <p className="text-xs text-white/30">5–1440 min. Higher = less server load.</p>
        </div>
      </CardContent>
    </Card>
  );
}
