"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "./useAuth";

interface SyncStatus {
  status: string;
  last_sync_at: string;
  items_synced: number;
  items_failed: number;
  duration_seconds: number;
}

interface SyncHealth {
  last_sync: SyncStatus;
  health_score: {
    score: number;
    status: string;
    message: string;
  };
  data_counts: {
    shows: number;
    movies: number;
    episodes: number;
    watch_history: number;
  };
}

export function useSyncStatus() {
  const queryClient = useQueryClient();
  const { initialSyncInProgress, setSyncComplete } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncHealth, setSyncHealth] = useState<SyncHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSyncedData, setHasSyncedData] = useState(false);

  const invalidateAllQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["shows"] });
    queryClient.invalidateQueries({ queryKey: ["movies"] });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    queryClient.invalidateQueries({ queryKey: ["history"] });
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
  }, [queryClient]);

  const fetchSyncHealth = useCallback(async () => {
    try {
      const health = await api.get<SyncHealth>("/sync/health");
      setSyncHealth(health);

      const currentDataCount = health.data_counts
        ? health.data_counts.shows + health.data_counts.movies
        : 0;
      const hasData = currentDataCount > 0;
      setHasSyncedData(hasData);

      if (health.last_sync) {
        setSyncStatus(health.last_sync);
      }

      if (hasData && !hasSyncedData) {
        invalidateAllQueries();
      }

      if (initialSyncInProgress && hasData) {
        setSyncComplete();
      }

      setError(null);
      return health;
    } catch (err) {
      console.error("Failed to fetch sync health:", err);
      setError("Failed to fetch sync status");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [hasSyncedData, initialSyncInProgress, setSyncComplete, invalidateAllQueries]);

  const triggerSync = useCallback(async () => {
    try {
      await api.post("/sync", {});
      return true;
    } catch (err) {
      console.error("Failed to trigger sync:", err);
      return false;
    }
  }, []);

  useEffect(() => {
    fetchSyncHealth();
  }, [fetchSyncHealth]);

  useEffect(() => {
    if (!initialSyncInProgress || hasSyncedData) return;
    const interval = setInterval(fetchSyncHealth, 4000);
    return () => clearInterval(interval);
  }, [initialSyncInProgress, hasSyncedData, fetchSyncHealth]);

  return {
    syncStatus,
    syncHealth,
    isLoading,
    error,
    hasSyncedData,
    isSyncing: initialSyncInProgress,
    triggerSync,
    refetch: fetchSyncHealth,
  };
}
