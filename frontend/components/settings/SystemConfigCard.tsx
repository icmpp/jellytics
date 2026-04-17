"use client";

import { Zap, Shield, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SettingsCheckbox } from "./SettingsCheckbox";

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
  rate_limit_requests_per_minute: "Rate Limit",
  rate_limit_burst_size: "Burst Size",
  jwt_access_expiry_minutes: "Access Token",
  jwt_refresh_expiry_hours: "Refresh Token",
};

const SYSTEM_LABELS: Record<string, string> = {
  log_level: "Log Level",
  maintenance_mode: "Maintenance",
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
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-3xl opacity-15 bg-purple-500" />
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-400" />
          System Configuration
        </CardTitle>
        <CardDescription>
          Backend sync and system settings that affect the entire application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadingSystemSettings ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                Sync Configuration
              </span>

              <SettingsCheckbox
                checked={syncConfig.sync_enabled}
                onChange={(checked) => setSyncConfig({ ...syncConfig, sync_enabled: checked })}
                label="Enable Background Sync"
                description="Automatically sync data from Jellyfin in the background"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                    Sync Interval
                  </span>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="10"
                      max="3600"
                      step="10"
                      value={syncConfig.sync_interval_seconds}
                      onChange={(e) =>
                        setSyncConfig({
                          ...syncConfig,
                          sync_interval_seconds: parseInt(e.target.value) || 60,
                        })
                      }
                      className="w-32"
                      disabled={!syncConfig.sync_enabled}
                    />
                    <span className="text-sm text-white/40">seconds</span>
                  </div>
                  <p className="text-xs text-white/30">
                    10–3600s. Lower = more frequent but higher load.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                    Worker Pool Size
                  </span>
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
                      className="w-32"
                      disabled={!syncConfig.sync_enabled}
                    />
                    <span className="text-sm text-white/40">workers</span>
                  </div>
                  <p className="text-xs text-white/30">
                    1–20 concurrent workers for large libraries.
                  </p>
                </div>
              </div>
            </div>

            {systemSettings?.settings && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/6" />
                  <span className="text-[10px] font-medium text-white/25 uppercase tracking-widest">
                    System Information
                  </span>
                  <div className="flex-1 h-px bg-white/6" />
                </div>

                <div className="space-y-4">
                  {systemSettings.settings.security &&
                    systemSettings.settings.security.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-emerald-400/70" />
                          <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                            Security
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {systemSettings.settings.security.map((s) => (
                            <div
                              key={s.key}
                              className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5"
                            >
                              <div className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                                {toLabel(s.key, SECURITY_LABELS)}
                              </div>
                              <div className="text-sm font-semibold text-white/90">
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
                        <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                          System
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {systemSettings.settings.system.map((s) => (
                          <div
                            key={s.key}
                            className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5"
                          >
                            <div className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                              {toLabel(s.key, SYSTEM_LABELS)}
                            </div>
                            <div className={`text-sm font-semibold ${systemValueColor(s)}`}>
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

            <Button onClick={onSave} disabled={savingSystemSettings} className="w-full">
              {savingSystemSettings ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save System Settings"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
