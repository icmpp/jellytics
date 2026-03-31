"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Notification {
  id: number;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
}

export function useNotifications(unreadOnly = false) {
  return useQuery<Notification[]>({
    queryKey: ["notifications", unreadOnly],
    queryFn: async () => {
      const url = unreadOnly ? "/notifications?unread=true" : "/notifications";
      const data = await api.get<Notification[]>(url);
      return data ?? [];
    },
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

export function useUnreadNotificationCount() {
  return useQuery<{ count: number }>({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const data = await api.get<{ count: number }>("/notifications/unread-count");
      return data ?? { count: 0 };
    },
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.put(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post("/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
