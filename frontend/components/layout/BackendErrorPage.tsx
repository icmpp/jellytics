"use client";

import { Server, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface BackendErrorPageProps {
  message?: string;
  statusCode?: number;
  onRetry?: () => void;
}

export function BackendErrorPage({ message, statusCode, onRetry }: BackendErrorPageProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120, 80, 200, 0.1), transparent),
          linear-gradient(to bottom, #0a0a0f, #0d0d14)
        `,
      }}
    >
      <div className="w-full max-w-md text-center">
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 shadow-2xl shadow-black/40">
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
              <Server className="h-10 w-10 text-red-400" />
            </div>
          </div>

          <h1 className="text-xl font-semibold text-white mb-2">Backend Unavailable</h1>
          <p className="text-sm text-white/50 mb-6">
            {statusCode
              ? `The server responded with a ${statusCode} error.`
              : "Could not connect to the backend server."}{" "}
            Make sure your backend is running and reachable.
          </p>

          {message && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-left">
              <p className="text-xs text-red-400 font-mono break-all">{message}</p>
            </div>
          )}

          <div className="mb-6 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-left">
            <p className="text-xs text-white/40 mb-1">Configured API endpoint</p>
            <p className="text-xs text-white/60 font-mono break-all">{API_BASE_URL}</p>
          </div>

          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 mx-auto px-6 py-3 bg-purple-600/80 hover:bg-purple-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
