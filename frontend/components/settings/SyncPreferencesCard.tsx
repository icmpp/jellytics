"use client";

import { RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SettingsCheckbox } from "./SettingsCheckbox";
import { SettingsCardHeader, FieldLabel, INPUT_CLASS } from "./SettingsPrimitives";
import type { UserPrefs } from "./types";

interface Props {
  prefs: UserPrefs;
  setPrefs: (prefs: UserPrefs) => void;
}

export function SyncPreferencesCard({ prefs, setPrefs }: Props) {
  return (
    <Card>
      <SettingsCardHeader
        icon={<RefreshCw className="h-5 w-5" />}
        title="sync_preferences"
        description="Configure automatic sync behavior"
      />
      <CardContent className="space-y-4">
        <SettingsCheckbox
          id="auto_sync"
          checked={prefs.auto_sync}
          onChange={(checked) => setPrefs({ ...prefs, auto_sync: checked })}
          label="Auto Sync"
          description="Automatically sync with Jellyfin server"
        />

        <div className="space-y-2">
          <FieldLabel>sync_interval</FieldLabel>
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
              className={`w-32 ${INPUT_CLASS}`}
            />
            <span className="font-mono text-sm text-white/40">minutes</span>
          </div>
          <p className="font-mono text-xs text-white/30">
            <span className="select-none text-violet-400/40">{"# "}</span>5–1440 min. higher = less
            server load.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
