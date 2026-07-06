"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface BackendErrorDetail {
  status?: number;
  message?: string;
}

export function BackendErrorBanner() {
  const [error, setError] = useState<BackendErrorDetail | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<BackendErrorDetail>).detail;
      setError(detail);
      setDismissed(false);
      requestAnimationFrame(() => setVisible(true));
    };
    window.addEventListener("jellytics:backend-error", handler);
    return () => window.removeEventListener("jellytics:backend-error", handler);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => setDismissed(true), 200);
  };

  if (!error || dismissed) return null;

  const isUnreachable = !error.status;
  const Icon = isUnreachable ? WifiOff : AlertTriangle;

  return (
    <div
      className={`
        fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)]
        rounded-sm border border-[#16162a] overflow-hidden
        shadow-2xl shadow-black/70
        transition-all duration-200
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between border-b border-[#16162a] px-3 py-2"
        style={{ background: "#06060d" }}
      >
        <div className="flex items-center gap-3">
          {/* Chrome dots — red lit to signal error */}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#ef4444]/90" />
            <div className="w-2 h-2 rounded-full bg-[#f59e0b]/30" />
            <div className="w-2 h-2 rounded-full bg-[#22c55e]/30" />
          </div>
          <div className="flex items-center gap-1.5">
            <Icon className="h-3 w-3 text-red-400/70" />
            <span className="font-mono text-[11px] text-white/30 select-none">error.log</span>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="font-mono text-[10px] text-white/25 hover:text-white/60 transition-colors select-none"
          aria-label="Dismiss"
        >
          [x]
        </button>
      </div>

      {/* Terminal body */}
      <div className="bg-[#07070d] px-4 py-3 space-y-1.5 font-mono text-[11px]">
        <div className="flex gap-2">
          <span className="text-white/20 shrink-0 select-none">$</span>
          <span className="text-red-400/80">
            {isUnreachable ? "backend_unreachable" : `backend_error — HTTP ${error.status}`}
          </span>
        </div>

        {error.message && (
          <div className="flex gap-2">
            <span className="text-white/20 shrink-0 select-none">›</span>
            <span className="text-white/40 leading-snug">{error.message}</span>
          </div>
        )}

        <div className="flex gap-2">
          <span className="text-white/20 shrink-0 select-none">›</span>
          <span className="text-white/20 truncate">{API_BASE_URL}</span>
        </div>

        <div className="flex gap-2 pt-0.5">
          <span className="text-white/20 shrink-0 select-none">$</span>
          <span className="inline-flex items-center gap-1.5 text-white/20">
            awaiting_connection
            <span className="inline-block w-1.5 h-[13px] bg-red-500/50 animate-pulse" />
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div
        className="flex items-center justify-between border-t border-[#16162a] px-4 py-2.5"
        style={{ background: "#06060d" }}
      >
        <span className="font-mono text-[10px] text-white/15 select-none">
          {isUnreachable ? "ECONNREFUSED" : `exit_code: ${error.status}`}
        </span>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-sm border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/40 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          aria-label="Reload page"
        >
          <RefreshCw className="h-2.5 w-2.5" />
          retry
        </button>
      </div>
    </div>
  );
}
