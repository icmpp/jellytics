"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, APIError } from "@/lib/api";
import { toast } from "@/hooks/useToast";
import { BackendErrorPage } from "@/components/layout";

type ServerStatus = "idle" | "checking" | "valid" | "invalid";

const PAGE_BG = {
  background:
    "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(139,92,246,0.1) 0%, transparent 65%), #050508",
} as const;

const PANEL_GLOW = {
  boxShadow:
    "0 0 0 1px rgba(139,92,246,0.08), 0 30px 80px rgba(0,0,0,0.95), 0 0 60px rgba(139,92,246,0.07)",
} as const;

const INPUT_CLASS =
  "w-full h-11 bg-[#0b0b15] border border-[#1e1e32] rounded-md text-slate-100 text-sm " +
  "placeholder-slate-700 outline-none px-4 font-mono transition-all duration-200 " +
  "focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:bg-[#0d0d1a]";

const LABEL_CLASS = "block text-violet-400 text-[10px] uppercase tracking-[0.2em] font-mono";

function ServerStatusBadge({
  status,
  serverName,
}: {
  status: ServerStatus;
  serverName: string | null;
}) {
  if (status === "idle") return null;
  return (
    <div className="mt-2.5 flex items-center gap-2 text-xs font-mono">
      {status === "checking" && (
        <>
          <span className="block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span className="text-amber-400">connecting to server...</span>
        </>
      )}
      {status === "valid" && (
        <>
          <span className="block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-emerald-400">
            reachable
            {serverName && <span className="text-emerald-300/70 ml-1">— {serverName}</span>}
          </span>
        </>
      )}
      {status === "invalid" && (
        <>
          <span className="block w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          <span className="text-red-400">unreachable — check the URL and try again</span>
        </>
      )}
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="relative my-1 py-1">
      <div className="border-t border-violet-500/10" />
      <span className="absolute left-0 -top-[9px] text-[9px] text-slate-700 uppercase tracking-[0.18em] bg-[#08080f] pr-2.5 select-none">
        {label}
      </span>
    </div>
  );
}

function BlinkCursor() {
  return (
    <>
      <span
        className="inline-block w-[7px] h-3.5 bg-violet-400 align-middle ml-1.5 relative -top-px"
        style={{ animation: "cursor-blink 1.1s step-end infinite" }}
      />
      <style jsx>{`
        @keyframes cursor-blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { login, isAuthenticated } = useAuth();
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [serverURL, setServerURL] = useState("");
  const [serverName, setServerName] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("idle");
  const [backendError, setBackendError] = useState<{ message: string; statusCode?: number } | null>(
    null,
  );

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  const checkOnboardingStatus = useCallback(async () => {
    setCheckingStatus(true);
    setBackendError(null);
    const maxRetries = 3;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await api.get<{ is_first_time: boolean; saved_server_url: string }>(
          "/auth/onboarding-status",
        );
        setIsFirstTime(response.is_first_time);
        if (!response.is_first_time && response.saved_server_url) {
          setServerURL(response.saved_server_url);
        }
        setCheckingStatus(false);
        return;
      } catch (err) {
        console.warn(`Onboarding status attempt ${attempt + 1}/${maxRetries} failed:`, err);
        lastError = err;
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
    }

    if (lastError instanceof APIError) {
      const isServerError =
        lastError.code === "NETWORK_ERROR" || lastError.code.startsWith("HTTP_5");
      if (isServerError) {
        const statusCode = lastError.code.startsWith("HTTP_5")
          ? parseInt(lastError.code.replace("HTTP_", ""), 10)
          : undefined;
        setBackendError({ message: lastError.message, statusCode });
        setCheckingStatus(false);
        return;
      }
    }

    setIsFirstTime(true);
    setCheckingStatus(false);
  }, []);

  useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  const checkServerURL = useCallback(async (url: string, signal?: AbortSignal) => {
    if (!url || url.length < 10) {
      setServerStatus("idle");
      setServerName(null);
      return;
    }
    try {
      new URL(url);
    } catch (err) {
      console.warn("Invalid server URL:", err);
      setServerStatus("invalid");
      setServerName(null);
      return;
    }
    setServerStatus("checking");
    setServerName(null);
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
          setServerName(data.ServerName ?? null);
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

  if (isAuthenticated) return null;

  if (checkingStatus || isFirstTime === null) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono" style={PAGE_BG}>
        <div>
          <div className="mb-4">
            <span className="text-violet-400 text-sm tracking-wide">jellytics</span>
          </div>
          <p className="text-slate-600 text-sm">
            <span className="text-violet-600 mr-2">$</span>
            initializing
            <span className="text-violet-600 animate-pulse">...</span>
          </p>
        </div>
      </div>
    );
  }

  if (backendError) {
    return (
      <BackendErrorPage
        message={backendError.message}
        statusCode={backendError.statusCode}
        onRetry={checkOnboardingStatus}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!username.trim() || !password) {
        setError("username and password are required");
        setLoading(false);
        return;
      }

      const loginPayload: { server_url?: string; username: string; password: string } = {
        username: username.trim(),
        password,
      };

      if (isFirstTime) {
        if (!serverURL.trim()) {
          setError("server_url is required");
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
        toast.success({ title: "Welcome!", description: "Syncing your Jellyfin library…" });
      } else {
        toast.success({
          title: "Welcome back",
          description: `Signed in as ${response.user.username}`,
        });
      }
    } catch (err) {
      let errorMessage = "an unexpected error occurred";
      if (err instanceof APIError) {
        if (err.message.includes("401") || err.message.toLowerCase().includes("unauthorized")) {
          errorMessage = "invalid username or password";
        } else if (err.message.includes("network") || err.message.includes("connect")) {
          errorMessage = "could not connect to server";
        } else {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message || errorMessage;
      }
      setError(errorMessage);
      toast.error({ title: "Sign in failed", description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    if (error) setError("");
  };

  const waitingForServer = isFirstTime === true && serverStatus === "checking";
  const submitDisabled = loading || waitingForServer;

  const buttonLabel = loading
    ? isFirstTime
      ? "connecting"
      : "authenticating"
    : waitingForServer
      ? "verifying server"
      : isFirstTime
        ? "connect"
        : "sign in";

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={PAGE_BG}>
      <div className="w-full max-w-md font-mono">
        {/* Terminal window */}
        <div className="border border-violet-500/20 rounded-xl overflow-hidden" style={PANEL_GLOW}>
          {/* Title bar */}
          <div className="bg-[#0c0c18] border-b border-violet-500/15 h-9 px-4 flex items-center">
            <div className="flex gap-1.5 shrink-0">
              <span className="block w-3 h-3 rounded-full bg-[#ff5f56]" />
              <span className="block w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <span className="block w-3 h-3 rounded-full bg-[#27c93f]" />
            </div>
            <span className="flex-1 text-center text-slate-600 text-xs select-none">
              jellytics — {isFirstTime ? "setup" : "login"}
            </span>
            <span className="w-[52px] shrink-0" />
          </div>

          {/* Body */}
          <div className="bg-[#08080f] px-7 py-8 sm:px-9">
            {/* Brand */}
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-violet-300 text-base tracking-wide">jellytics</span>
              <span className="text-slate-700 text-xs">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
            </div>

            {/* Command prompt */}
            <div className="flex items-center gap-1.5 mb-5 text-xs select-none">
              <span className="text-violet-600">~</span>
              <span className="text-slate-600">$</span>
              <span className="text-slate-500">
                {isFirstTime ? "jellytics setup --first-run" : "jellytics auth login"}
              </span>
            </div>

            {/* Returning user: show which server is configured */}
            {!isFirstTime && serverURL && (
              <div className="mb-6 space-y-2">
                <span className={LABEL_CLASS}>server_url</span>
                <div className="px-3 py-2.5 bg-violet-500/5 border border-violet-500/12 rounded-md">
                  <span className="text-slate-500 text-xs truncate">{serverURL}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* ── First run: server connection ── */}
              {isFirstTime && (
                <div className="space-y-2">
                  <label htmlFor="server_url" className={LABEL_CLASS}>
                    server_url
                  </label>
                  <input
                    id="server_url"
                    type="url"
                    value={serverURL}
                    onChange={(e) => {
                      setServerURL(e.target.value);
                      clearError();
                    }}
                    placeholder="https://jellyfin.example.com"
                    className={INPUT_CLASS}
                    required
                    autoFocus
                  />
                  <ServerStatusBadge status={serverStatus} serverName={serverName} />
                </div>
              )}

              {/* ── Credentials section divider (first run only) ── */}
              {isFirstTime && <SectionDivider label="credentials" />}

              {/* Username */}
              <div className="space-y-2">
                <label htmlFor="username" className={LABEL_CLASS}>
                  username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    clearError();
                  }}
                  placeholder="your_username"
                  className={INPUT_CLASS}
                  required
                  autoComplete="username"
                  autoFocus={!isFirstTime}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className={LABEL_CLASS}>
                    password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-600 hover:text-violet-400 text-[10px] font-mono transition-colors"
                  >
                    [{showPassword ? "hide" : "show"}]
                  </button>
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError();
                  }}
                  placeholder="••••••••"
                  className={INPUT_CLASS}
                  required
                  autoComplete="current-password"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-500/10 border border-red-500/30 rounded-md">
                  <span className="text-red-400 text-xs shrink-0 mt-px">✗</span>
                  <p className="text-red-400 text-xs leading-relaxed">{error}</p>
                </div>
              )}

              {/* Submit */}
              <div className="border-t border-violet-500/10 pt-5">
                <button
                  type="submit"
                  disabled={submitDisabled}
                  className="
                    w-full h-11 flex items-center px-4 rounded-md text-sm font-mono
                    bg-violet-500/8 border border-violet-500/30
                    hover:bg-violet-500/15 hover:border-violet-500/60
                    hover:shadow-[0_0_24px_rgba(139,92,246,0.2)]
                    disabled:opacity-40 disabled:cursor-not-allowed
                    active:scale-[0.99] transition-all duration-200 group
                  "
                >
                  <span className="text-violet-500 group-hover:text-violet-300 transition-colors mr-2 select-none">
                    {">"}
                  </span>
                  <span className="text-slate-400 group-hover:text-slate-200 transition-colors">
                    {buttonLabel}
                  </span>
                  {(loading || waitingForServer) && (
                    <span className="text-violet-500 animate-pulse ml-0.5">...</span>
                  )}
                  {!loading && !waitingForServer && <BlinkCursor />}
                </button>
              </div>
            </form>

            {/* Footer */}
            <p className="mt-7 text-slate-700 text-[11px] leading-relaxed">
              {isFirstTime
                ? "# credentials authenticate directly with your jellyfin server"
                : "# to change server, visit settings"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
