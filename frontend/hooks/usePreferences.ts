"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/useToast";

export interface UserPreferences {
  sync_interval_minutes?: number;
  auto_sync?: boolean;
  display_items_per_page?: number;
  default_date_range_days?: number;
  show_completion_percentage?: boolean;
  theme?: "light" | "dark" | "system";
  timezone?: string;
  notify_sync_complete?: boolean;
  notify_sync_errors?: boolean;
  weekly_target_minutes?: number;
  monthly_target_minutes?: number;
}

interface PreferencesResponse {
  preferences: UserPreferences;
}

export function usePreferences() {
  return useQuery<UserPreferences>({
    queryKey: ["preferences"],
    queryFn: async () => {
      try {
        const response = await api.get<PreferencesResponse>("/settings/preferences");
        return response.preferences || {};
      } catch (err) {
        console.warn("Failed to fetch preferences:", err);
        return {};
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: Partial<UserPreferences>) => {
      return api.put<PreferencesResponse>("/settings/preferences", {
        preferences,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
      queryClient.invalidateQueries({ queryKey: ["stats", "goals"] });
      toast.success({
        title: "Preferences saved",
        description: "Your preferences have been saved successfully.",
      });
    },
    onError: (error) => {
      console.error("Failed to save preferences:", error);
      toast.error({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
      });
    },
  });
}
