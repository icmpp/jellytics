"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface BackendErrorDetail {
  status?: number;
  message?: string;
}

export function BackendErrorBanner() {
  const [error, setError] = useState<BackendErrorDetail | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<BackendErrorDetail>).detail;
      setError(detail);
      setDismissed(false);
    };
    window.addEventListener("jellytics:backend-error", handler);
    return () => window.removeEventListener("jellytics:backend-error", handler);
  }, []);

  if (!error || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-start gap-3 px-4 py-3 bg-red-950/90 border-b border-red-500/30 backdrop-blur-sm text-sm text-red-200">
      <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-red-300">
          {error.status ? `Backend error (${error.status})` : "Backend unreachable"}
        </span>
        {error.message && (
          <span className="text-red-400/80 ml-2">&mdash; {error.message}</span>
        )}
        <span className="text-red-400/60 ml-2 font-mono text-xs">{API_BASE_URL}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1 text-xs text-red-300 hover:text-white transition-colors"
          aria-label="Reload page"
        >
          <RefreshCw className="h-3 w-3" />
          Reload
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-red-400/70 hover:text-red-200 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
