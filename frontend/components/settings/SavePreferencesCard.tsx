"use client";

import { CheckCircle2, Loader2, Settings as SettingsIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  preferencesSuccess: string;
  isPending: boolean;
  isLoading: boolean;
  onSave: () => void;
}

export function SavePreferencesCard({ preferencesSuccess, isPending, isLoading, onSave }: Props) {
  return (
    <Card className="relative overflow-hidden h-full flex flex-col">
      <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-3xl opacity-15 bg-purple-500" />
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-purple-400" />
          Save Preferences
        </CardTitle>
        <CardDescription>Applies sync, display, notification, and tag changes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={onSave} disabled={isPending || isLoading} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Preferences"
          )}
        </Button>
        {preferencesSuccess && (
          <p
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-400"
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
