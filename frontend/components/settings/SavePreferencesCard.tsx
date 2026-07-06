"use client";

import { CheckCircle2, Loader2, Settings as SettingsIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsCardHeader, TerminalButton } from "./SettingsPrimitives";

interface Props {
  preferencesSuccess: string;
  isPending: boolean;
  isLoading: boolean;
  onSave: () => void;
}

export function SavePreferencesCard({ preferencesSuccess, isPending, isLoading, onSave }: Props) {
  return (
    <Card className="flex h-full flex-col">
      <SettingsCardHeader
        icon={<SettingsIcon className="h-5 w-5" />}
        title="save_preferences"
        description="Applies sync, display, notification, and tag changes"
      />
      <CardContent className="space-y-3">
        <TerminalButton onClick={onSave} disabled={isPending || isLoading} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              saving...
            </>
          ) : (
            "save_preferences"
          )}
        </TerminalButton>
        {preferencesSuccess && (
          <p
            className="flex items-center justify-center gap-1.5 font-mono text-xs font-medium text-emerald-400"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {preferencesSuccess}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
