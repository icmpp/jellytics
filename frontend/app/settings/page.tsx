"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, APIError } from "@/lib/api";
import { toast } from "@/hooks/useToast";
import { Settings as SettingsIcon, Save, Loader2 } from "lucide-react";
import { AppLayout, PageHeader, PageContent } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { usePreferences, useUpdatePreferences } from "@/hooks/usePreferences";
import { useTags, useCreateTag, useDeleteTag } from "@/hooks/useTags";
import { useRatingsList } from "@/hooks/useRatings";
import { useReviewsList } from "@/hooks/useReviews";
import { JellyfinServerCard } from "@/components/settings/JellyfinServerCard";
import { SyncManagementCard } from "@/components/settings/SyncManagementCard";
import { SystemConfigCard } from "@/components/settings/SystemConfigCard";
import { SyncPreferencesCard } from "@/components/settings/SyncPreferencesCard";
import { DisplaySettingsCard } from "@/components/settings/DisplaySettingsCard";
import { TagsCard } from "@/components/settings/TagsCard";
import { NotificationsCard } from "@/components/settings/NotificationsCard";
import { DataManagementCard } from "@/components/settings/DataManagementCard";
import type { ServerStatus } from "@/components/settings/JellyfinServerCard";
import type { SyncConfig, SystemSettingsData } from "@/components/settings/SystemConfigCard";
import type { SyncStatus, UserPrefs } from "@/components/settings/types";

interface Settings {
  jellyfin_server_url: string;
}

const DEFAULT_PREFS: UserPrefs = {
  sync_interval_minutes: 60,
  auto_sync: true,
  display_items_per_page: 50,
  default_date_range_days: 30,
  show_completion_percentage: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  notify_sync_complete: true,
  notify_sync_errors: true,
  weekly_target_minutes: 0,
  monthly_target_minutes: 0,
};

export default function SettingsPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Server connection state
  const [serverURL, setServerURL] = useState("");
  const [serverStatus, setServerStatus] = useState<ServerStatus>("idle");
  const [testUsername, setTestUsername] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState("");
  const [serverSettingsSuccess, setServerSettingsSuccess] = useState("");

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loadingSyncStatus, setLoadingSyncStatus] = useState(false);

  // System config state
  const [systemSettings, setSystemSettings] = useState<SystemSettingsData | null>(null);
  const [loadingSystemSettings, setLoadingSystemSettings] = useState(false);
  const [savingSystemSettings, setSavingSystemSettings] = useState(false);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    sync_interval_seconds: 60,
    worker_pool_size: 5,
    sync_enabled: true,
  });

  // User preferences state
  const { data: preferences = {}, isLoading: loadingPreferences } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);

  // Tags
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const [newTagName, setNewTagName] = useState("");

  // Data export
  const { data: ratings = [] } = useRatingsList();
  const { data: reviews = [] } = useReviewsList();

  // Sync preferences from server into local state
  useEffect(() => {
    if (preferences && Object.keys(preferences).length > 0) {
      setPrefs({
        sync_interval_minutes: preferences.sync_interval_minutes ?? 60,
        auto_sync: preferences.auto_sync ?? true,
        display_items_per_page: preferences.display_items_per_page ?? 50,
        default_date_range_days: preferences.default_date_range_days ?? 30,
        show_completion_percentage: preferences.show_completion_percentage ?? true,
        timezone: preferences.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
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
      const status = await api.get<SyncStatus>("/sync/status");
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

  const loadSettings = useCallback(async () => {
    try {
      const settings = await api.get<Settings>("/settings");
      setServerURL(settings.jellyfin_server_url || "");
    } catch (err) {
      if (err instanceof APIError) setError(err.message);
      else setError("Failed to load settings");
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
      loadSyncStatus();
      loadSystemSettings();
    }
  }, [isAuthenticated, loadSettings, loadSyncStatus, loadSystemSettings]);

  // Debounced server URL reachability check
  const checkServerURL = useCallback(async (url: string, signal?: AbortSignal) => {
    if (!url || url.length < 10) {
      setServerStatus("idle");
      return;
    }
    try {
      new URL(url);
    } catch {
      setServerStatus("invalid");
      return;
    }
    setServerStatus("checking");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const combinedSignal = signal?.aborted
        ? signal
        : signal
          ? (AbortSignal.any?.([controller.signal, signal]) ?? controller.signal)
          : controller.signal;
      const response = await fetch(`${url.replace(/\/$/, "")}/System/Info/Public`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: combinedSignal,
      });
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
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => checkServerURL(serverURL, controller.signal), 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [serverURL, checkServerURL]);

  // Handlers
  const handleURLChange = (url: string) => {
    setServerURL(url);
    setError("");
    setServerSettingsSuccess("");
    setTestResult(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setServerSettingsSuccess("");
    setTestResult(null);
    try {
      await api.put<Settings>("/settings", { jellyfin_server_url: serverURL });
      setServerSettingsSuccess("Settings saved successfully!");
      toast.success({
        title: "Settings saved",
        description: "Your Jellyfin server settings have been saved successfully.",
      });
      if (typeof window !== "undefined") {
        localStorage.setItem("jellyfin_server_url", serverURL);
      }
    } catch (err) {
      const msg = err instanceof APIError ? err.message : "Failed to save settings";
      setError(msg);
      toast.error({ title: "Save failed", description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const result = await api.post<{ success: boolean; message: string }>(
        "/settings/test-connection",
        { jellyfin_server_url: serverURL, username: testUsername, password: testPassword },
      );
      setTestResult(result);
      if (result.success) {
        toast.success({
          title: "Connection successful",
          description: "Successfully connected to your Jellyfin server.",
        });
      } else {
        setError(result.message);
        toast.error({ title: "Connection failed", description: result.message });
      }
    } catch (err) {
      const msg = err instanceof APIError ? err.message : "Failed to test connection";
      setTestResult({ success: false, message: msg });
      setError(msg);
      toast.error({ title: "Connection test failed", description: msg });
    } finally {
      setTesting(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setError("");
    setServerSettingsSuccess("");
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
      const msg = err instanceof APIError ? err.message : "Failed to start sync";
      setError(msg);
      toast.error({ title: "Sync failed", description: msg });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveSystemSettings = async () => {
    setSavingSystemSettings(true);
    try {
      await api.put("/system-settings/sync", syncConfig);
      toast.success({
        title: "Sync settings saved",
        description: "Backend sync configuration has been updated.",
      });
    } catch (err) {
      const msg = err instanceof APIError ? err.message : "Failed to save sync settings";
      setError(msg);
      toast.error({ title: "Save failed", description: msg });
    } finally {
      setSavingSystemSettings(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      await updatePreferences.mutateAsync(prefs);
      setError("");
      setServerSettingsSuccess("");
      toast.success({
        title: "Preferences saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch (err) {
      const msg = err instanceof APIError ? err.message : "Failed to save preferences";
      setError(msg);
      toast.error({ title: "Save failed", description: msg });
    }
  };

  const breadcrumbItems = useMemo(
    () => [{ icon: "home" as const, href: "/dashboard" }, { label: "Settings" }],
    [],
  );

  return (
    <AppLayout>
      <PageContent>
        <PageHeader
          breadcrumb={breadcrumbItems}
          title="Settings"
          description="Manage your Jellyfin server connection and preferences"
          icon={<SettingsIcon className="h-6 w-6 sm:h-7 sm:w-7 text-purple-400 shrink-0" />}
          actions={
            <Button
              onClick={handleSavePreferences}
              disabled={updatePreferences.isPending || loadingPreferences}
            >
              {updatePreferences.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          }
        />

        <section className="grid gap-6 lg:grid-cols-2">
          <JellyfinServerCard
            serverURL={serverURL}
            onURLChange={handleURLChange}
            serverStatus={serverStatus}
            testUsername={testUsername}
            setTestUsername={setTestUsername}
            testPassword={testPassword}
            setTestPassword={setTestPassword}
            loading={loading}
            testing={testing}
            error={error}
            serverSettingsSuccess={serverSettingsSuccess}
            testResult={testResult}
            showHelp={showHelp}
            setShowHelp={setShowHelp}
            onSave={handleSave}
            onTest={handleTestConnection}
          />
          <SyncManagementCard
            syncStatus={syncStatus}
            syncing={syncing}
            loadingSyncStatus={loadingSyncStatus}
            serverURL={serverURL}
            onSync={handleManualSync}
            onRefreshStatus={loadSyncStatus}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <TagsCard
            tags={tags}
            createTag={createTag}
            deleteTag={deleteTag}
            newTagName={newTagName}
            setNewTagName={setNewTagName}
          />
          <div className="space-y-6">
            <SyncPreferencesCard prefs={prefs} setPrefs={setPrefs} />
            <DisplaySettingsCard prefs={prefs} setPrefs={setPrefs} />
            <NotificationsCard prefs={prefs} setPrefs={setPrefs} />
          </div>
        </section>

        <SystemConfigCard
          syncConfig={syncConfig}
          setSyncConfig={setSyncConfig}
          systemSettings={systemSettings}
          loadingSystemSettings={loadingSystemSettings}
          savingSystemSettings={savingSystemSettings}
          onSave={handleSaveSystemSettings}
        />

        <DataManagementCard
          prefs={prefs}
          serverURL={serverURL}
          syncStatus={syncStatus}
          ratings={ratings}
          reviews={reviews}
        />
      </PageContent>
    </AppLayout>
  );
}
