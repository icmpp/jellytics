"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, APIError } from "@/lib/api";
import { toast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  HelpCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  Database,
  Download,
  Trash2,
  Bell,
  Clock,
  Settings as SettingsIcon,
  Tag,
  Trash2 as TagTrash,
  Zap,
  Shield,
  Activity,
} from "lucide-react";
import { AppLayout, PageHeader, PageContent } from "@/components/layout";
import { usePreferences, useUpdatePreferences } from "@/hooks/usePreferences";
import {
  useTags,
  useCreateTag,
  useDeleteTag,
} from "@/hooks/useTags";
import { useRatingsList } from "@/hooks/useRatings";
import { useReviewsList } from "@/hooks/useReviews";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SyncConfig {
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

interface SystemSettingsData {
  settings: {
    [category: string]: SystemSetting[];
  };
}

interface Settings {
  jellyfin_server_url: string;
}

type ServerStatus = "idle" | "checking" | "valid" | "invalid";

export default function SettingsPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [serverURL, setServerURL] = useState("");
  const [testUsername, setTestUsername] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [serverSettingsSuccess, setServerSettingsSuccess] = useState("");
  const [preferencesSuccess, setPreferencesSuccess] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("idle");
  const [showHelp, setShowHelp] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [loadingSyncStatus, setLoadingSyncStatus] = useState(false);

  const { data: preferences = {}, isLoading: loadingPreferences } =
    usePreferences();
  const { data: ratings = [] } = useRatingsList();
  const { data: reviews = [] } = useReviewsList();
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const [newTagName, setNewTagName] = useState("");
  const updatePreferences = useUpdatePreferences();
  const [prefs, setPrefs] = useState({
    sync_interval_minutes: preferences.sync_interval_minutes || 60,
    auto_sync: preferences.auto_sync ?? true,
    display_items_per_page: preferences.display_items_per_page || 50,
    default_date_range_days: preferences.default_date_range_days || 30,
    show_completion_percentage: preferences.show_completion_percentage ?? true,
    timezone:
      preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    notify_sync_complete: preferences.notify_sync_complete ?? true,
    notify_sync_errors: preferences.notify_sync_errors ?? true,
    weekly_target_minutes: preferences.weekly_target_minutes ?? 0,
    monthly_target_minutes: preferences.monthly_target_minutes ?? 0,
  });

  const [systemSettings, setSystemSettings] =
    useState<SystemSettingsData | null>(null);
  const [loadingSystemSettings, setLoadingSystemSettings] = useState(false);
  const [savingSystemSettings, setSavingSystemSettings] = useState(false);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    sync_interval_seconds: 60,
    worker_pool_size: 5,
    sync_enabled: true,
  });

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (preferences && Object.keys(preferences).length > 0) {
      setPrefs({
        sync_interval_minutes: preferences.sync_interval_minutes || 60,
        auto_sync: preferences.auto_sync ?? true,
        display_items_per_page: preferences.display_items_per_page || 50,
        default_date_range_days: preferences.default_date_range_days || 30,
        show_completion_percentage:
          preferences.show_completion_percentage ?? true,
        timezone:
          preferences.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        notify_sync_complete: preferences.notify_sync_complete ?? true,
        notify_sync_errors: preferences.notify_sync_errors ?? true,
        weekly_target_minutes: preferences.weekly_target_minutes ?? 0,
        monthly_target_minutes: preferences.monthly_target_minutes ?? 0,
      });
    }
  }, [preferences]);

  const loadSyncStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingSyncStatus(true);
    try {
      const status = await api.get("/sync/status");
      setSyncStatus(status);
    } catch (err) {
      console.error("Failed to load sync status:", err);
    } finally {
      setLoadingSyncStatus(false);
    }
  }, [isAuthenticated]);

  const loadSystemSettings = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingSystemSettings(true);
    try {
      const [allSettings, syncCfg] = await Promise.all([
        api.get<SystemSettingsData>("/system-settings"),
        api.get<SyncConfig>("/system-settings/sync"),
      ]);
      setSystemSettings(allSettings);
      setSyncConfig(syncCfg);
    } catch (err) {
      console.error("Failed to load system settings:", err);
    } finally {
      setLoadingSystemSettings(false);
    }
  }, [isAuthenticated]);

  const saveSystemSyncSettings = async () => {
    setSavingSystemSettings(true);
    setError("");
    try {
      await api.put("/system-settings/sync", syncConfig);
      toast.success({
        title: "Sync settings saved",
        description: "Backend sync configuration has been updated.",
      });
    } catch (err) {
      let errorMsg = "Failed to save sync settings";
      if (err instanceof APIError) {
        errorMsg = err.message;
      }
      setError(errorMsg);
      toast.error({
        title: "Save failed",
        description: errorMsg,
      });
    } finally {
      setSavingSystemSettings(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadSyncStatus();
      loadSystemSettings();
    }
  }, [isAuthenticated, loadSyncStatus, loadSystemSettings]);

  const handleManualSync = async () => {
    setSyncing(true);
    setError("");
    setServerSettingsSuccess("");
    setPreferencesSuccess("");
    try {
      await api.post("/sync");
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      toast.success({
        title: "Sync started",
        description:
          "Data is being synced from Jellyfin to the database. Use Refresh below or navigate away and back to see updated data.",
      });
    } catch (err) {
      let errorMsg = "Failed to start sync";
      if (err instanceof APIError) {
        errorMsg = err.message;
      }
      setError(errorMsg);
      toast.error({
        title: "Sync failed",
        description: errorMsg,
      });
    } finally {
      setSyncing(false);
    }
  };

  const checkServerURL = useCallback(
    async (url: string, signal?: AbortSignal) => {
      if (!url || url.length < 10) {
        setServerStatus("idle");
        return;
      }

      try {
        new URL(url)
      } catch (err) {
        console.warn("Invalid server URL:", err)
        setServerStatus("invalid")
        return
      }

      setServerStatus("checking");

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const combinedSignal =
          signal?.aborted
            ? signal
            : signal
              ? AbortSignal.any?.([controller.signal, signal]) ?? controller.signal
              : controller.signal;

        const response = await fetch(
          `${url.replace(/\/$/, "")}/System/Info/Public`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: combinedSignal,
          },
        );

        clearTimeout(timeoutId);
        if (signal?.aborted) return;

        if (response.ok) {
          const data = await response.json();
          if (data.ServerName || data.Version) {
            setServerStatus("valid");
            return;
          }
        }
        setServerStatus("invalid");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setServerStatus("invalid");
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      checkServerURL(serverURL, controller.signal);
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [serverURL, checkServerURL]);

  const loadSettings = async () => {
    try {
      const settings = await api.get<Settings>("/settings");
      setServerURL(settings.jellyfin_server_url || "");
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to load settings");
      }
      console.error("Failed to load settings:", err);
    }
  };

  const getServerStatusIcon = () => {
    switch (serverStatus) {
      case "checking":
        return <Loader2 className="h-4 w-4 animate-spin text-white/40" />;
      case "valid":
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case "invalid":
        return <XCircle className="h-4 w-4 text-amber-400" />;
      default:
        return <Server className="h-4 w-4 text-white/40" />;
    }
  };

  const serverStatusText = useMemo(() => {
    switch (serverStatus) {
      case "checking":
        return "Checking server...";
      case "valid":
        return "Server found!";
      case "invalid":
        return "Could not reach server";
      default:
        return "";
    }
  }, [serverStatus]);

  const breadcrumbItems = useMemo(
    () => [
      { icon: "home" as const, href: "/dashboard" },
      { label: "Settings" },
    ],
    [],
  );

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);
    setError("");

    try {
      const result = await api.post<{ success: boolean; message: string }>(
        "/settings/test-connection",
        {
          jellyfin_server_url: serverURL,
          username: testUsername,
          password: testPassword,
        },
      );

      setTestResult(result);
      if (result.success) {
        toast.success({
          title: "Connection successful",
          description: "Successfully connected to your Jellyfin server.",
        });
      } else {
        setError(result.message);
        toast.error({
          title: "Connection failed",
          description: result.message,
        });
      }
    } catch (err) {
      let errorMsg = "Failed to test connection";
      if (err instanceof APIError) {
        errorMsg = err.message;
        setTestResult({ success: false, message: err.message });
        setError(err.message);
      } else {
        setTestResult({ success: false, message: errorMsg });
        setError(errorMsg);
      }
      toast.error({
        title: "Connection test failed",
        description: errorMsg,
      });
      console.error("Connection test error:", err);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setServerSettingsSuccess("");
    setPreferencesSuccess("");
    setTestResult(null);

    try {
      await api.put<Settings>("/settings", {
        jellyfin_server_url: serverURL,
      });

      setServerSettingsSuccess("Settings saved successfully!");
      toast.success({
        title: "Settings saved",
        description:
          "Your Jellyfin server settings have been saved successfully.",
      });

      if (typeof window !== "undefined") {
        localStorage.setItem("jellyfin_server_url", serverURL);
      }
    } catch (err) {
      let errorMsg = "Failed to save settings";
      if (err instanceof APIError) {
        errorMsg = err.message;
        setError(err.message);
      } else {
        setError(errorMsg);
      }
      toast.error({
        title: "Save failed",
        description: errorMsg,
      });
      console.error("Save settings error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <PageContent className="max-w-4xl mx-auto">
        <PageHeader
          breadcrumb={breadcrumbItems}
          title="Settings"
          description="Manage your Jellyfin server connection and preferences"
          icon={<SettingsIcon className="h-6 w-6 sm:h-7 sm:w-7 text-purple-400 shrink-0" />}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Server className="h-5 w-5 text-purple-400" />
              Jellyfin Server Configuration
            </CardTitle>
            <CardDescription className="text-white/40">
              Configure your Jellyfin server URL. The URL will be validated for
              format and reachability before saving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="server_url"
                    className="text-sm font-medium text-white/60"
                  >
                    Jellyfin Server URL
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowHelp(!showHelp)}
                    className="flex items-center gap-1.5 text-xs font-medium text-white/40 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.05]"
                    aria-label="Show help"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Help
                  </button>
                </div>

                {showHelp && (
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-white/60 space-y-2">
                    <p className="font-medium text-white">
                      How to find your server URL:
                    </p>
                    <p>Enter the full URL including http:// or https://</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <code className="text-xs bg-white/[0.05] border border-white/[0.08] px-2 py-1 rounded-lg text-purple-300">
                        https://jellyfin.example.com
                      </code>
                      <code className="text-xs bg-white/[0.05] border border-white/[0.08] px-2 py-1 rounded-lg text-purple-300">
                        http://192.168.1.100:8096
                      </code>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    {getServerStatusIcon()}
                  </div>
                  <Input
                    id="server_url"
                    type="url"
                    placeholder="https://jellyfin.example.com"
                    value={serverURL}
                    onChange={(e) => {
                      setServerURL(e.target.value);
                      setError("");
                      setServerSettingsSuccess("");
                      setTestResult(null);
                    }}
                    required
                    className="h-12 pl-11"
                    aria-describedby="server_url_status"
                  />
                </div>

                <p
                  id="server_url_status"
                  className={`text-sm font-medium transition-colors ${
                    serverStatus === "valid"
                      ? "text-emerald-400"
                      : serverStatus === "invalid"
                        ? "text-amber-400"
                        : "text-white/40"
                  }`}
                >
                  {serverStatusText || "Enter your server address"}
                </p>
              </div>

              {error && (
                <div
                  className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"
                  role="alert"
                  aria-live="polite"
                >
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              {serverSettingsSuccess && (
                <div
                  className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  role="alert"
                  aria-live="polite"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="font-medium">{serverSettingsSuccess}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12"
                disabled={loading || serverStatus === "checking"}
              >
                {loading ? (
                  <span className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-purple-400" />
              Test Connection
            </CardTitle>
            <CardDescription className="text-white/40">
              Test the connection to your Jellyfin server with your credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTestConnection} className="space-y-4">
              <div className="space-y-3">
                <Label
                  htmlFor="test_username"
                  className="text-sm font-medium text-white/60"
                >
                  Username
                </Label>
                <Input
                  id="test_username"
                  type="text"
                  placeholder="Your Jellyfin username"
                  value={testUsername}
                  onChange={(e) => setTestUsername(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-3">
                <Label
                  htmlFor="test_password"
                  className="text-sm font-medium text-white/60"
                >
                  Password
                </Label>
                <Input
                  id="test_password"
                  type="password"
                  placeholder="Your Jellyfin password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              {testResult && (
                <div
                  className={`flex items-start gap-3 p-4 rounded-xl border ${
                    testResult.success
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}
                  role="alert"
                  aria-live="polite"
                >
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  )}
                  <p className="font-medium">{testResult.message}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12"
                disabled={testing || !serverURL}
              >
                {testing ? (
                  <span className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Testing...
                  </span>
                ) : (
                  "Test Connection"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-purple-400" />
              Sync Management
            </CardTitle>
            <CardDescription className="text-white/40">
              Manually trigger syncs and monitor sync status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white mb-1">
                  Manual Sync
                </h3>
                <p className="text-xs text-white/40">
                  Trigger an immediate sync with your Jellyfin server
                </p>
              </div>
              <Button
                onClick={handleManualSync}
                disabled={syncing || !serverURL}
              >
                {syncing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Syncing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Sync Now
                  </span>
                )}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-400" />
                  Last Sync Status
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadSyncStatus}
                  disabled={loadingSyncStatus}
                  className="text-white/50 hover:text-white shrink-0"
                >
                  {loadingSyncStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="sr-only">Refresh status</span>
                </Button>
              </div>
              {loadingSyncStatus ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                </div>
              ) : syncStatus ? (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                    <div>
                      <div className="text-xs text-white/40 mb-1">Status</div>
                      <div
                        className={`text-sm font-semibold ${
                          syncStatus.status === "success"
                            ? "text-emerald-400"
                            : syncStatus.status === "failed"
                              ? "text-red-400"
                              : syncStatus.status === "in_progress"
                                ? "text-amber-400"
                                : "text-white/40"
                        }`}
                      >
                        {syncStatus.status === "success"
                          ? "Success"
                          : syncStatus.status === "failed"
                            ? "Failed"
                            : syncStatus.status === "in_progress"
                              ? "In Progress"
                              : syncStatus.status === "never"
                                ? "Never Synced"
                                : "Unknown"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-white/40 mb-1">
                        Last Sync
                      </div>
                      <div className="text-sm font-medium text-white">
                        {syncStatus.last_sync_at
                          ? new Date(syncStatus.last_sync_at).toLocaleString()
                          : "Never"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-white/40 mb-1">
                        Items Synced
                      </div>
                      <div className="text-sm font-medium text-white">
                        {syncStatus.items_synced || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-white/40 mb-1">Duration</div>
                      <div className="text-sm font-medium text-white">
                        {syncStatus.duration_seconds
                          ? `${syncStatus.duration_seconds.toFixed(1)}s`
                          : "N/A"}
                      </div>
                    </div>
                  </div>
                  {syncStatus.items_failed > 0 && (
                    <div className="pt-3 border-t border-white/[0.08]">
                      <div className="text-xs text-amber-400 font-medium">
                        {syncStatus.items_failed} items failed to sync
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-white/40 text-center">
                  No sync status available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-400" />
              System Configuration
            </CardTitle>
            <CardDescription className="text-white/40">
              Configure backend sync and system settings. These settings affect
              the entire application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingSystemSettings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-purple-400" />
                    <h3 className="text-sm font-semibold text-white">
                      Sync Configuration
                    </h3>
                  </div>

                  <div className="grid gap-4 pl-6">
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncConfig.sync_enabled}
                        onChange={(e) =>
                          setSyncConfig({
                            ...syncConfig,
                            sync_enabled: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded bg-white/[0.03] border-white/[0.15] text-purple-500 focus:ring-2 focus:ring-purple-500/30"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white">
                          Enable Background Sync
                        </span>
                        <p className="text-xs text-white/40 mt-0.5">
                          Automatically sync data from Jellyfin in the
                          background
                        </p>
                      </div>
                    </label>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-white/60">
                        Sync Interval
                      </Label>
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
                              sync_interval_seconds:
                                parseInt(e.target.value) || 60,
                            })
                          }
                          className="w-32 h-11"
                          disabled={!syncConfig.sync_enabled}
                        />
                        <span className="text-sm text-white/40">seconds</span>
                      </div>
                      <p className="text-xs text-white/40">
                        How often to sync with Jellyfin (10-3600 seconds). Lower
                        values = more frequent updates but higher load.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-white/60">
                        Worker Pool Size
                      </Label>
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
                          className="w-32 h-11"
                          disabled={!syncConfig.sync_enabled}
                        />
                        <span className="text-sm text-white/40">workers</span>
                      </div>
                      <p className="text-xs text-white/40">
                        Number of concurrent sync workers (1-20). More workers =
                        faster sync for large libraries.
                      </p>
                    </div>
                  </div>
                </div>

                {systemSettings?.settings && (
                  <div className="space-y-5 pt-5 border-t border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-400" />
                      <h3 className="text-sm font-semibold text-white">
                        System Information
                      </h3>
                    </div>

                    <div className="space-y-4 pl-6">
                      {systemSettings.settings.security &&
                        systemSettings.settings.security.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Shield className="h-3.5 w-3.5 text-emerald-400/70" />
                              <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
                                Security
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {systemSettings.settings.security.map(
                                (setting) => {
                                  const formatValue = (s: SystemSetting) => {
                                    if (typeof s.value === "boolean") {
                                      return s.value ? "Enabled" : "Disabled";
                                    }
                                    if (s.key.includes("expiry_minutes")) {
                                      return `${s.value} min`;
                                    }
                                    if (s.key.includes("expiry_hours")) {
                                      const hours = Number(s.value);
                                      return hours >= 24
                                        ? `${Math.floor(hours / 24)}d`
                                        : `${hours}h`;
                                    }
                                    if (s.key.includes("per_minute")) {
                                      return `${s.value}/min`;
                                    }
                                    return String(s.value);
                                  };

                                  const getLabel = (key: string) => {
                                    const labels: Record<string, string> = {
                                      rate_limit_requests_per_minute:
                                        "Rate Limit",
                                      rate_limit_burst_size: "Burst Size",
                                      jwt_access_expiry_minutes: "Access Token",
                                      jwt_refresh_expiry_hours: "Refresh Token",
                                    };
                                    return (
                                      labels[key] ||
                                      key
                                        .replace(/_/g, " ")
                                        .replace(/\b\w/g, (c) =>
                                          c.toUpperCase(),
                                        )
                                    );
                                  };

                                  return (
                                    <div
                                      key={setting.key}
                                      className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                                    >
                                      <div className="text-[10px] text-white/35 uppercase tracking-wide mb-0.5">
                                        {getLabel(setting.key)}
                                      </div>
                                      <div className="text-sm font-semibold text-white/90">
                                        {formatValue(setting)}
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        )}

                      {systemSettings.settings.system &&
                        systemSettings.settings.system.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Zap className="h-3.5 w-3.5 text-amber-400/70" />
                              <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
                                System
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {systemSettings.settings.system.map((setting) => {
                                const formatValue = (s: SystemSetting) => {
                                  if (typeof s.value === "boolean") {
                                    return s.value ? "Enabled" : "Disabled";
                                  }
                                  return String(s.value);
                                };

                                const getLabel = (key: string) => {
                                  const labels: Record<string, string> = {
                                    log_level: "Log Level",
                                    maintenance_mode: "Maintenance",
                                  };
                                  return (
                                    labels[key] ||
                                    key
                                      .replace(/_/g, " ")
                                      .replace(/\b\w/g, (c) => c.toUpperCase())
                                  );
                                };

                                const getStatusColor = (s: SystemSetting) => {
                                  if (s.key === "maintenance_mode") {
                                    return s.value === true
                                      ? "text-amber-400"
                                      : "text-emerald-400";
                                  }
                                  if (s.key === "log_level") {
                                    const colors: Record<string, string> = {
                                      debug: "text-blue-400",
                                      info: "text-emerald-400",
                                      warn: "text-amber-400",
                                      error: "text-red-400",
                                    };
                                    return (
                                      colors[String(s.value)] || "text-white/90"
                                    );
                                  }
                                  return "text-white/90";
                                };

                                return (
                                  <div
                                    key={setting.key}
                                    className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                                  >
                                    <div className="text-[10px] text-white/35 uppercase tracking-wide mb-0.5">
                                      {getLabel(setting.key)}
                                    </div>
                                    <div
                                      className={`text-sm font-semibold ${getStatusColor(setting)}`}
                                    >
                                      {formatValue(setting)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                )}

                <Button
                  onClick={saveSystemSyncSettings}
                  disabled={savingSystemSettings}
                  className="w-full h-12"
                >
                  {savingSystemSettings ? (
                    <span className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Save System Settings"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-400" />
              User Preferences
            </CardTitle>
            <CardDescription className="text-white/40">
              Customize your experience and display options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {loadingPreferences ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              </div>
            ) : (
              <div className="space-y-8">
                <div className="space-y-5 pb-6 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-purple-400" />
                    <h3 className="text-base font-semibold text-white">
                      Sync Settings
                    </h3>
                  </div>

                  <div className="space-y-4 pl-7">
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        id="auto_sync"
                        checked={prefs.auto_sync}
                        onChange={(e) =>
                          setPrefs({ ...prefs, auto_sync: e.target.checked })
                        }
                        className="w-4 h-4 rounded bg-white/[0.03] border-white/[0.15] text-purple-500 focus:ring-2 focus:ring-purple-500/30"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white">
                          Auto Sync
                        </span>
                        <p className="text-xs text-white/40 mt-0.5">
                          Automatically sync with Jellyfin server
                        </p>
                      </div>
                    </label>

                    <div className="space-y-2">
                      <Label
                        htmlFor="sync_interval"
                        className="text-sm font-medium text-white/60"
                      >
                        Sync Interval
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="sync_interval"
                          type="number"
                          min="5"
                          max="1440"
                          step="5"
                          value={prefs.sync_interval_minutes}
                          onChange={(e) =>
                            setPrefs({
                              ...prefs,
                              sync_interval_minutes:
                                parseInt(e.target.value) || 60,
                            })
                          }
                          className="w-32 h-11"
                        />
                        <span className="text-sm text-white/40">minutes</span>
                      </div>
                      <p className="text-xs text-white/40">
                        How often to automatically sync data (5-1440 minutes)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 pb-6 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-purple-400" />
                    <h3 className="text-base font-semibold text-white">
                      Display Settings
                    </h3>
                  </div>

                  <div className="space-y-4 pl-7">
                    <div className="space-y-2">
                      <Label
                        htmlFor="items_per_page"
                        className="text-sm font-medium text-white/60"
                      >
                        Items Per Page
                      </Label>
                      <Select
                        value={prefs.display_items_per_page.toString()}
                        onValueChange={(value) =>
                          setPrefs({
                            ...prefs,
                            display_items_per_page: parseInt(value),
                          })
                        }
                      >
                        <SelectTrigger
                          id="items_per_page"
                          className="w-40 h-11"
                        >
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

                    <div className="space-y-2">
                      <Label
                        htmlFor="weekly_goal"
                        className="text-sm font-medium text-white/60"
                      >
                        Weekly Watch Goal (minutes)
                      </Label>
                      <Input
                        id="weekly_goal"
                        type="number"
                        min="0"
                        placeholder="0 = off"
                        value={prefs.weekly_target_minutes || ""}
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            weekly_target_minutes: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-32 h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="monthly_goal"
                        className="text-sm font-medium text-white/60"
                      >
                        Monthly Watch Goal (minutes)
                      </Label>
                      <Input
                        id="monthly_goal"
                        type="number"
                        min="0"
                        placeholder="0 = off"
                        value={prefs.monthly_target_minutes || ""}
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            monthly_target_minutes: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-32 h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="default_date_range"
                        className="text-sm font-medium text-white/60"
                      >
                        Default Date Range
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="default_date_range"
                          type="number"
                          min="7"
                          max="365"
                          value={prefs.default_date_range_days}
                          onChange={(e) =>
                            setPrefs({
                              ...prefs,
                              default_date_range_days:
                                parseInt(e.target.value) || 30,
                            })
                          }
                          className="w-32 h-11"
                        />
                        <span className="text-sm text-white/40">days</span>
                      </div>
                    </div>

                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        id="show_completion"
                        checked={prefs.show_completion_percentage}
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            show_completion_percentage: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded bg-white/[0.03] border-white/[0.15] text-purple-500 focus:ring-2 focus:ring-purple-500/30"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white">
                          Show Completion Percentage
                        </span>
                        <p className="text-xs text-white/40 mt-0.5">
                          Display completion percentage on items
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-5 pb-6 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <Tag className="h-5 w-5 text-purple-400" />
                    <h3 className="text-base font-semibold text-white">
                      Tags
                    </h3>
                  </div>
                  <div className="space-y-4 pl-7">
                    <p className="text-sm text-white/50">
                      Create tags to organize movies and shows. Add tags from
                      item detail pages and filter by them on Movies/Shows pages.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="New tag name"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (newTagName.trim()) {
                              createTag.mutate(
                                { name: newTagName.trim() },
                                {
                                  onSuccess: () => setNewTagName(""),
                                },
                              );
                            }
                          }
                        }}
                        className="max-w-[200px] h-11"
                      />
                      <Button
                        onClick={() => {
                          if (newTagName.trim()) {
                            createTag.mutate(
                              { name: newTagName.trim() },
                              { onSuccess: () => setNewTagName("") },
                            );
                          }
                        }}
                        disabled={!newTagName.trim() || createTag.isPending}
                      >
                        Add Tag
                      </Button>
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                            style={{
                              backgroundColor: `${t.color}20`,
                              borderColor: `${t.color}50`,
                              color: t.color,
                            }}
                          >
                            {t.name}
                            <button
                              type="button"
                              onClick={() => deleteTag.mutate(t.id)}
                              disabled={deleteTag.isPending}
                              className="hover:opacity-70 rounded p-0.5"
                              aria-label={`Delete ${t.name}`}
                            >
                              <TagTrash className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-5 pb-6 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-purple-400" />
                    <h3 className="text-base font-semibold text-white">
                      Data Management
                    </h3>
                  </div>

                  <div className="space-y-4 pl-7">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-white block mb-1">
                            Export Your Data
                          </span>
                          <p className="text-xs text-white/40">
                            Download all your viewing statistics and preferences
                            as JSON
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const data = {
                                preferences: prefs,
                                settings: { jellyfin_server_url: serverURL },
                                syncStatus,
                                ratings,
                                reviews,
                                exportedAt: new Date().toISOString(),
                              };
                              const blob = new Blob(
                                [JSON.stringify(data, null, 2)],
                                { type: "application/json" },
                              );
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `jellytics-export-${new Date().toISOString().split("T")[0]}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                              toast.success({
                                title: "Export successful",
                                description:
                                  "Your data has been exported successfully.",
                              });
                            } catch (err) {
                              console.warn("Export failed:", err)
                              toast.error({
                                title: "Export failed",
                                description:
                                  "Failed to export data. Please try again.",
                              })
                            }
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                      <div className="mb-3">
                        <span className="text-sm font-medium text-red-400 block mb-1">
                          Clear Sync Cache
                        </span>
                        <p className="text-xs text-white/40">
                          Clear cached sync data. This will trigger a full
                          resync on next sync.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to clear the sync cache? This will require a full resync.",
                            )
                          ) {
                            toast.success({
                              title: "Cache cleared",
                              description:
                                "Sync cache has been cleared. Next sync will be a full resync.",
                            });
                          }
                        }}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear Cache
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-purple-400" />
                    <h3 className="text-base font-semibold text-white">
                      Notifications
                    </h3>
                  </div>

                  <div className="space-y-4 pl-7">
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        id="notify_sync_complete"
                        checked={prefs.notify_sync_complete ?? true}
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            notify_sync_complete: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded bg-white/[0.03] border-white/[0.15] text-purple-500 focus:ring-2 focus:ring-purple-500/30"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white">
                          Notify on Sync Completion
                        </span>
                        <p className="text-xs text-white/40 mt-0.5">
                          Show notifications when sync operations complete
                        </p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        id="notify_sync_errors"
                        checked={prefs.notify_sync_errors ?? true}
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            notify_sync_errors: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded bg-white/[0.03] border-white/[0.15] text-purple-500 focus:ring-2 focus:ring-purple-500/30"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white">
                          Notify on Sync Errors
                        </span>
                        <p className="text-xs text-white/40 mt-0.5">
                          Show notifications when sync operations fail
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/[0.08] space-y-4">
                  {preferencesSuccess && (
                    <div
                      className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      role="alert"
                      aria-live="polite"
                    >
                      <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                      <p className="font-medium">{preferencesSuccess}</p>
                    </div>
                  )}
                  <Button
                    onClick={async () => {
                      try {
                        await updatePreferences.mutateAsync(prefs);
                        setPreferencesSuccess(
                          "Preferences saved successfully!",
                        );
                        setError("");
                        setServerSettingsSuccess("");
                      } catch (err) {
                        console.warn("Failed to save preferences:", err)
                        setError("Failed to save preferences")
                        setPreferencesSuccess("")
                      }
                    }}
                    disabled={updatePreferences.isPending}
                    className="w-full h-12"
                  >
                    {updatePreferences.isPending ? (
                      <span className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      "Save Preferences"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContent>
    </AppLayout>
  );
}
