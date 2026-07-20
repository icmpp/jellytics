"use client";

import { Zap, Shield, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SettingsCheckbox } from "./SettingsCheckbox";
import {
  SettingsCardHeader,
  FieldLabel,
  SettingsDivider,
  INPUT_CLASS,
  TerminalButton,
} from "./SettingsPrimitives";

export interface SyncConfig {
  sync_interval_seconds: number;
  worker_pool_size: number;
  sync_enabled: boolean;
}

interface SystemSetting {
  key: string;
  value: string | number | boolean;
  description: string;
  category: string;
  data_type: string;
}

export interface SystemSettingsData {
  settings: {
    [category: string]: SystemSetting[];
  };
}

interface Props {
  syncConfig: SyncConfig;
  setSyncConfig: (config: SyncConfig) => void;
  systemSettings: SystemSettingsData | null;
  loadingSystemSettings: boolean;
  savingSystemSettings: boolean;
  onSave: () => void;
}

const SECURITY_LABELS: Record<string, string> = {
  rate_limit_requests_per_minute: "rate_limit",
  rate_limit_burst_size: "burst_size",
  jwt_access_expiry_minutes: "access_token",
  jwt_refresh_expiry_hours: "refresh_token",
};

const SYSTEM_LABELS: Record<string, string> = {
  log_level: "log_level",
  maintenance_mode: "maintenance",
};

function toLabel(key: string, labels: Record<string, string>): string {
  return labels[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSecurityValue(s: SystemSetting): string {
  if (typeof s.value === "boolean") return s.value ? "Enabled" : "Disabled";
  if (s.key.includes("expiry_minutes")) return `${s.value} min`;
  if (s.key.includes("expiry_hours")) {
    const h = Number(s.value);
    return h >= 24 ? `${Math.floor(h / 24)}d` : `${h}h`;
  }
  if (s.key.includes("per_minute")) return `${s.value}/min`;
  return String(s.value);
}

function systemValueColor(s: SystemSetting): string {
  if (s.key === "maintenance_mode") return s.value === true ? "text-amber-400" : "text-emerald-400";
  if (s.key === "log_level") {
    const map: Record<string, string> = {
      debug: "text-blue-400",
      info: "text-emerald-400",
      warn: "text-amber-400",
      error: "text-red-400",
    };
    return map[String(s.value)] ?? "text-white/90";
  }
  return "text-white/90";
}

export function SystemConfigCard({
  syncConfig,
  setSyncConfig,
  systemSettings,
  loadingSystemSettings,
  savingSystemSettings,
  onSave,
}: Props) {
  return (
    <Card>
      <SettingsCardHeader
        icon={<Zap className="h-5 w-5" />}
        title="system_configuration"
        description="Backend sync and system settings that affect the entire application"
      />
      <CardContent className="space-y-6">
        {loadingSystemSettings ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <FieldLabel>sync_configuration</FieldLabel>

              <SettingsCheckbox
                checked={syncConfig.sync_enabled}
                onChange={(checked) => setSyncConfig({ ...syncConfig, sync_enabled: checked })}
                label="Enable Background Sync"
                description="Automatically sync data from Jellyfin in the background"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>sync_interval</FieldLabel>
                  <div className="flex items-center gap-3">
                    {/* Displayed in minutes for readability; stored as seconds. */}
                    <Input
                      type="number"
                      min="1"
                      max="1440"
                      step="1"
                      value={Math.round(syncConfig.sync_interval_seconds / 60)}
                      onChange={(e) =>
                        setSyncConfig({
                          ...syncConfig,
                          sync_interval_seconds: (parseInt(e.target.value) || 5) * 60,
                        })
                      }
                      className={`w-32 ${INPUT_CLASS}`}
                      disabled={!syncConfig.sync_enabled}
                    />
                    <span className="font-mono text-sm text-white/40">minutes</span>
                  </div>
                  <p className="font-mono text-xs text-white/30">
                    <span className="select-none text-violet-400/40">{"# "}</span>1–1440 min. lower
                    = more frequent but higher load.
                  </p>
                </div>

                <div className="space-y-2">
                  <FieldLabel>worker_pool_size</FieldLabel>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={syncConfig.worker_pool_size}
                      onChange={(e) =>
                        setSyncConfig({
                          ...syncConfig,
                          worker_pool_size: parseInt(e.target.value) || 5,
                        })
                      }
                      className={`w-32 ${INPUT_CLASS}`}
                      disabled={!syncConfig.sync_enabled}
                    />
                    <span className="font-mono text-sm text-white/40">workers</span>
                  </div>
                  <p className="font-mono text-xs text-white/30">
                    <span className="select-none text-violet-400/40">{"# "}</span>1–20 concurrent
                    workers for large libraries.
                  </p>
                </div>
              </div>
            </div>

            {systemSettings?.settings && (
              <>
                <SettingsDivider label="system_information" />

                <div className="space-y-4">
                  {systemSettings.settings.security &&
                    systemSettings.settings.security.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-emerald-400/70" />
                          <FieldLabel>security</FieldLabel>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {systemSettings.settings.security.map((s) => (
                            <div
                              key={s.key}
                              className="space-y-1.5 rounded-sm border border-[#16162a] bg-[#0a0a14] p-3"
                            >
                              <FieldLabel>{toLabel(s.key, SECURITY_LABELS)}</FieldLabel>
                              <div className="font-mono text-sm font-semibold text-white/90">
                                {formatSecurityValue(s)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {systemSettings.settings.system && systemSettings.settings.system.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-amber-400/70" />
                        <FieldLabel>system</FieldLabel>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {systemSettings.settings.system.map((s) => (
                          <div
                            key={s.key}
                            className="space-y-1.5 rounded-sm border border-[#16162a] bg-[#0a0a14] p-3"
                          >
                            <FieldLabel>{toLabel(s.key, SYSTEM_LABELS)}</FieldLabel>
                            <div
                              className={`font-mono text-sm font-semibold ${systemValueColor(s)}`}
                            >
                              {typeof s.value === "boolean"
                                ? s.value
                                  ? "Enabled"
                                  : "Disabled"
                                : String(s.value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <TerminalButton onClick={onSave} disabled={savingSystemSettings} className="w-full">
              {savingSystemSettings ? (
                <>
                  <Loader2 className="animate-spin" />
                  saving...
                </>
              ) : (
                "save_system_settings"
              )}
            </TerminalButton>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
