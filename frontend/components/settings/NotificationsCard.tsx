"use client";

import { Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsCheckbox } from "./SettingsCheckbox";
import type { UserPrefs } from "./types";

interface Props {
  prefs: UserPrefs;
  setPrefs: (prefs: UserPrefs) => void;
}

export function NotificationsCard({ prefs, setPrefs }: Props) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-3xl opacity-15 bg-purple-500" />
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Bell className="h-5 w-5 text-purple-400" />
          Notifications
        </CardTitle>
        <CardDescription>Choose which in-app notifications to receive</CardDescription>
      </CardHeader>
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

        <p className="text-xs text-white/30 pt-1">
          Notifications appear as in-app toasts in the bottom corner.
        </p>
      </CardContent>
    </Card>
  );
}
