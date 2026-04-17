"use client";

import { Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsCheckbox } from "./SettingsCheckbox";
import type { UserPrefs } from "./types";

interface Props {
  prefs: UserPrefs;
  setPrefs: (prefs: UserPrefs) => void;
}

export function DisplaySettingsCard({ prefs, setPrefs }: Props) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-3xl opacity-15 bg-purple-500" />
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Eye className="h-5 w-5 text-purple-400" />
          Display Settings
        </CardTitle>
        <CardDescription>Customize your experience and display options</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
            Items Per Page
          </span>
          <Select
            value={prefs.display_items_per_page.toString()}
            onValueChange={(value) =>
              setPrefs({ ...prefs, display_items_per_page: parseInt(value) })
            }
          >
            <SelectTrigger id="items_per_page" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
              Weekly Goal
            </span>
            <Input
              id="weekly_goal"
              type="number"
              min="0"
              placeholder="0 = off"
              value={prefs.weekly_target_minutes || ""}
              onChange={(e) =>
                setPrefs({ ...prefs, weekly_target_minutes: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-white/30">Minutes per week</p>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
              Monthly Goal
            </span>
            <Input
              id="monthly_goal"
              type="number"
              min="0"
              placeholder="0 = off"
              value={prefs.monthly_target_minutes || ""}
              onChange={(e) =>
                setPrefs({ ...prefs, monthly_target_minutes: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-white/30">Minutes per month</p>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
            Default Date Range
          </span>
          <div className="flex items-center gap-3">
            <Input
              id="default_date_range"
              type="number"
              min="7"
              max="365"
              value={prefs.default_date_range_days}
              onChange={(e) =>
                setPrefs({ ...prefs, default_date_range_days: parseInt(e.target.value) || 30 })
              }
              className="w-32"
            />
            <span className="text-sm text-white/40">days</span>
          </div>
          <p className="text-xs text-white/30">7–365 days for chart filters</p>
        </div>

        <SettingsCheckbox
          id="show_completion"
          checked={prefs.show_completion_percentage}
          onChange={(checked) => setPrefs({ ...prefs, show_completion_percentage: checked })}
          label="Show Completion Percentage"
          description="Display completion percentage on items"
        />
      </CardContent>
    </Card>
  );
}
