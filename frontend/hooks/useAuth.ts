"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

interface User {
  id: number;
  username: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isNewUser: boolean;
  initialSyncInProgress: boolean;
  login: (
    user: User,
    accessToken: string,
    refreshToken: string,
    isNewUser?: boolean,
    initialSyncStarted?: boolean,
  ) => void;
  logout: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken?: string) => void;
  setSyncComplete: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isNewUser: false,
      initialSyncInProgress: false,
      login: (user, accessToken, refreshToken, isNewUser = false, initialSyncStarted = false) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", accessToken);
          if (refreshToken) {
            localStorage.setItem("refresh_token", refreshToken);
          }
        }
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isNewUser,
          initialSyncInProgress: initialSyncStarted,
        });
      },
      logout: async () => {
        try {
          await api.post("/auth/logout");
        } catch (err) {
          console.warn("Logout API call failed:", err);
        }
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          try {
            localStorage.removeItem("auth-storage");
          } catch (err) {
            console.warn("Failed to clear auth-storage:", err);
          }
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isNewUser: false,
          initialSyncInProgress: false,
        });
      },
      setTokens: (accessToken, refreshToken) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", accessToken);
          if (refreshToken) {
            localStorage.setItem("refresh_token", refreshToken);
          }
        }
        set({ accessToken, refreshToken });
      },
      setSyncComplete: () => {
        set({ initialSyncInProgress: false });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        isNewUser: state.isNewUser,
        initialSyncInProgress: state.initialSyncInProgress,
      }),
    },
  ),
);
