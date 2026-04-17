"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, APIError } from "@/lib/api";
import { toast } from "@/hooks/useToast";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Lock,
  User,
} from "lucide-react";
import { JellyticsLogo } from "@/components/layout";

type ServerStatus = "idle" | "checking" | "valid" | "invalid";

const LOGIN_BACKGROUND_STYLE = {
  background: `
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120, 80, 200, 0.15), transparent),
    radial-gradient(ellipse 60% 40% at 80% 50%, rgba(80, 100, 200, 0.1), transparent),
    radial-gradient(ellipse 50% 30% at 20% 80%, rgba(100, 80, 180, 0.08), transparent),
    linear-gradient(to bottom, #0a0a0f, #0d0d14)
  `,
} as const;

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { login, isAuthenticated } = useAuth();
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [serverURL, setServerURL] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("idle");

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      const maxRetries = 3;
      let resolved = false;
      for (let attempt = 0; attempt < maxRetries && !resolved; attempt++) {
        try {
          const response = await api.get<{
            is_first_time: boolean;
            saved_server_url: string;
          }>("/auth/onboarding-status");

          setIsFirstTime(response.is_first_time);
          if (!response.is_first_time && response.saved_server_url) {
            setServerURL(response.saved_server_url);
          }
          resolved = true;
        } catch (err) {
          console.warn(`Onboarding status attempt ${attempt + 1}/${maxRetries} failed:`, err);
          if (attempt === maxRetries - 1) {
            setIsFirstTime(true);
            resolved = true;
          } else {
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          }
        }
      }
      setCheckingStatus(false);
    };

    checkOnboardingStatus();
  }, []);

  const checkServerURL = useCallback(async (url: string, signal?: AbortSignal) => {
    if (!url || url.length < 10) {
      setServerStatus("idle");
      return;
    }

    try {
      new URL(url);
    } catch (err) {
      console.warn("Invalid server URL:", err);
      setServerStatus("invalid");
      return;
    }

    setServerStatus("checking");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const combinedSignal =
        signal && signal.aborted
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
    const timer = setTimeout(() => {
      checkServerURL(serverURL, controller.signal);
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [serverURL, checkServerURL]);

  if (isAuthenticated) {
    return null;
  }

  if (checkingStatus || isFirstTime === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!username.trim() || !password) {
        setError("Please enter both username and password");
        setLoading(false);
        return;
      }

      const loginPayload: {
        server_url?: string;
        username: string;
        password: string;
      } = {
        username: username.trim(),
        password: password,
      };

      if (isFirstTime) {
        if (!serverURL.trim()) {
          setError("Please enter your Jellyfin server URL");
          setLoading(false);
          return;
        }
        loginPayload.server_url = serverURL.replace(/\/$/, "");
      }

      const response = await api.post<{
        user: { id: number; username: string; created_at: string };
        access_token: string;
        refresh_token: string;
        is_new_user: boolean;
        initial_sync_started: boolean;
      }>("/auth/login", loginPayload);

      login(
        response.user,
        response.access_token,
        response.refresh_token,
        response.is_new_user,
        response.initial_sync_started,
      );

      queryClient.removeQueries({ queryKey: ["shows"] });
      queryClient.removeQueries({ queryKey: ["movies"] });
      queryClient.removeQueries({ queryKey: ["stats"] });
      queryClient.removeQueries({ queryKey: ["history"] });
      queryClient.removeQueries({ queryKey: ["watchlist"] });
      queryClient.removeQueries({ queryKey: ["sessions"] });

      if (response.initial_sync_started) {
        toast.success({
          title: "Welcome!",
          description: "Syncing your Jellyfin library. This may take a moment...",
        });
      } else {
        toast.success({
          title: "Welcome back",
          description: `Signed in as ${response.user.username}`,
        });
      }
    } catch (err) {
      let errorMessage = "An unexpected error occurred";

      if (err instanceof APIError) {
        if (err.message.includes("401") || err.message.toLowerCase().includes("unauthorized")) {
          errorMessage = "Invalid username or password";
        } else if (err.message.includes("network") || err.message.includes("connect")) {
          errorMessage = "Could not connect to server";
        } else {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message || errorMessage;
      }

      setError(errorMessage);
      toast.error({
        title: "Sign in failed",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={LOGIN_BACKGROUND_STYLE}
    >
      <div className="relative w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-3xl p-6 sm:p-10 shadow-2xl shadow-black/40">
          <div className="flex justify-center mb-8">
            <JellyticsLogo size={80} />
          </div>

          <div className="text-center mb-8">
            <h2 className="text-lg font-medium text-white mb-1">
              {isFirstTime ? "Get Started" : "Welcome Back"}
            </h2>
            <p className="text-sm text-white/50">
              {isFirstTime ? "Connect your Jellyfin server to begin" : "Sign in to your account"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isFirstTime && (
              <div className="space-y-2">
                <label htmlFor="server_url" className="block text-sm font-medium text-white/70">
                  Server URL
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                    {serverStatus === "checking" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                    ) : serverStatus === "valid" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : serverStatus === "invalid" ? (
                      <XCircle className="h-5 w-5 text-red-400" />
                    ) : (
                      <Server className="h-5 w-5" />
                    )}
                  </div>
                  <input
                    id="server_url"
                    type="url"
                    value={serverURL}
                    onChange={(e) => setServerURL(e.target.value)}
                    placeholder="https://jellyfin.example.com"
                    className="w-full h-14 pl-12 pr-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder-white/30 focus:outline-none focus:bg-white/[0.05] focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    required
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-white/70">
                Username
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                  <User className="h-5 w-5" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full h-14 pl-12 pr-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder-white/30 focus:outline-none focus:bg-white/[0.05] focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  required
                  autoComplete="username"
                  autoFocus={!isFirstTime}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-white/70">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-14 pl-12 pr-14 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder-white/30 focus:outline-none focus:bg-white/[0.05] focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl backdrop-blur-sm">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isFirstTime && serverStatus === "checking")}
              className="relative w-full h-14 bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 bg-[length:200%_100%] hover:bg-[position:100%_0] disabled:from-purple-600/50 disabled:via-purple-500/50 disabled:to-purple-600/50 disabled:cursor-not-allowed text-white font-medium rounded-2xl transition-all duration-700 ease-out flex items-center justify-center gap-2 group shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] mt-8 overflow-hidden"
            >
              {/* Shimmer effect */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                  animation: "shimmer 2s infinite",
                }}
              />

              {/* Glow pulse ring */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-out">
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background:
                      "radial-gradient(circle at center, rgba(168, 85, 247, 0.4) 0%, transparent 70%)",
                    animation: "pulse-glow 2s ease-in-out infinite",
                  }}
                />
              </div>

              <div className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span className="transition-transform duration-500 ease-out group-hover:-translate-x-0.5">
                      Sign in
                    </span>
                    <ArrowRight className="h-5 w-5 transition-all duration-500 ease-out group-hover:translate-x-1 group-hover:scale-110" />
                  </>
                )}
              </div>

              {/* Bottom border glow */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-gradient-to-r from-transparent via-white/60 to-transparent group-hover:w-3/4 transition-all duration-700 ease-out" />
            </button>

            <style jsx>{`
              @keyframes shimmer {
                0% {
                  transform: translateX(-100%);
                }
                100% {
                  transform: translateX(100%);
                }
              }
              @keyframes pulse-glow {
                0%,
                100% {
                  opacity: 0.5;
                  transform: scale(1);
                }
                50% {
                  opacity: 1;
                  transform: scale(1.05);
                }
              }
            `}</style>
          </form>

          <p className="mt-8 text-center text-sm text-white/30">
            {isFirstTime
              ? "Credentials authenticate with your Jellyfin server"
              : "Need to change server? Visit Settings"}
          </p>
        </div>
      </div>
    </div>
  );
}
