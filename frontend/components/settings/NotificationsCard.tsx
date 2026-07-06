"use client";

import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsCheckbox } from "./SettingsCheckbox";
import { SettingsCardHeader } from "./SettingsPrimitives";
import type { UserPrefs } from "./types";

interface Props {
  prefs: UserPrefs;
  setPrefs: (prefs: UserPrefs) => void;
}

export function NotificationsCard({ prefs, setPrefs }: Props) {
  return (
    <Card>
      <SettingsCardHeader
        icon={<Bell className="h-5 w-5" />}
        title="notifications"
        description="Choose which in-app notifications to receive"
      />
      <CardContent className="space-y-4">
        <SettingsCheckbox
          id="notify_sync_complete"
          checked={prefs.notify_sync_complete ?? true}
          onChange={(checked) => setPrefs({ ...prefs, notify_sync_complete: checked })}
          label="Sync Completion"
          description="Toast when a sync finishes successfully"
        />

        <SettingsCheckbox
          id="notify_sync_errors"
          checked={prefs.notify_sync_errors ?? true}
          onChange={(checked) => setPrefs({ ...prefs, notify_sync_errors: checked })}
          label="Sync Errors"
          description="Toast when a sync encounters failures"
        />

        <p className="pt-1 font-mono text-xs text-white/30">
          <span className="select-none text-violet-400/40">{"# "}</span>
          notifications appear as in-app toasts in the bottom corner.
        </p>
      </CardContent>
    </Card>
  );
}
