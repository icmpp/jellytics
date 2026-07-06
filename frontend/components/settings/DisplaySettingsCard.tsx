"use client";

import { Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsCheckbox } from "./SettingsCheckbox";
import { SettingsCardHeader, FieldLabel, INPUT_CLASS } from "./SettingsPrimitives";
import type { UserPrefs } from "./types";

interface Props {
  prefs: UserPrefs;
  setPrefs: (prefs: UserPrefs) => void;
}

export function DisplaySettingsCard({ prefs, setPrefs }: Props) {
  return (
    <Card>
      <SettingsCardHeader
        icon={<Eye className="h-5 w-5" />}
        title="display_settings"
        description="Customize your experience and display options"
      />
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <FieldLabel>items_per_page</FieldLabel>
          <Select
            value={prefs.display_items_per_page.toString()}
            onValueChange={(value) =>
              setPrefs({ ...prefs, display_items_per_page: parseInt(value) })
            }
          >
            <SelectTrigger
              id="items_per_page"
              className="w-full rounded-sm border-[#16162a] bg-[#0a0a14] font-mono"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-sm border-[#16162a] bg-[#07070d] font-mono">
              <SelectItem value="25" className="rounded-sm text-xs">
                25
              </SelectItem>
              <SelectItem value="50" className="rounded-sm text-xs">
                50
              </SelectItem>
              <SelectItem value="100" className="rounded-sm text-xs">
                100
              </SelectItem>
              <SelectItem value="200" className="rounded-sm text-xs">
                200
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <FieldLabel>weekly_goal</FieldLabel>
            <Input
              id="weekly_goal"
              type="number"
              min="0"
              placeholder="0 = off"
              value={prefs.weekly_target_minutes || ""}
              onChange={(e) =>
                setPrefs({ ...prefs, weekly_target_minutes: parseInt(e.target.value) || 0 })
              }
              className={INPUT_CLASS}
            />
            <p className="font-mono text-xs text-white/30">
              <span className="select-none text-violet-400/40">{"# "}</span>minutes per week
            </p>
          </div>

          <div className="space-y-2">
            <FieldLabel>monthly_goal</FieldLabel>
            <Input
              id="monthly_goal"
              type="number"
              min="0"
              placeholder="0 = off"
              value={prefs.monthly_target_minutes || ""}
              onChange={(e) =>
                setPrefs({ ...prefs, monthly_target_minutes: parseInt(e.target.value) || 0 })
              }
              className={INPUT_CLASS}
            />
            <p className="font-mono text-xs text-white/30">
              <span className="select-none text-violet-400/40">{"# "}</span>minutes per month
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel>default_date_range</FieldLabel>
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
              className={`w-32 ${INPUT_CLASS}`}
            />
            <span className="font-mono text-sm text-white/40">days</span>
          </div>
          <p className="font-mono text-xs text-white/30">
            <span className="select-none text-violet-400/40">{"# "}</span>7–365 days for chart
            filters
          </p>
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
