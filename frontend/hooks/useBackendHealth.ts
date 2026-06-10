"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/**
 * Tracks whether the Jellytics backend is reachable.
 *
 * Polls the lightweight, unauthenticated `/version` endpoint on an interval and
 * re-checks immediately when the app reports a backend error (the same
 * `jellytics:backend-error` event the error banner listens to) or when the tab
 * regains focus / the browser comes back online. The probe is the source of
 * truth, so a one-off 5xx on some other endpoint won't flip the indicator
 * unless the backend is genuinely unreachable.
 */
export function useBackendHealth(pollMs = 15000): boolean {
  const [online, setOnline] = useState(true);
  const cancelledRef = useRef(false);

  const check = useCallback(async () => {
    try {
      await api.get("/version");
      if (!cancelledRef.current) setOnline(true);
    } catch {
      if (!cancelledRef.current) setOnline(false);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    // Defer the first probe so the effect body doesn't trigger a synchronous render.
    const initial = setTimeout(check, 0);
    const id = setInterval(check, pollMs);

    const recheck = () => {
      void check();
    };
    const goOffline = () => setOnline(false);

    window.addEventListener("jellytics:backend-error", recheck);
    window.addEventListener("focus", recheck);
    window.addEventListener("online", recheck);
    window.addEventListener("offline", goOffline);

    return () => {
      cancelledRef.current = true;
      clearTimeout(initial);
      clearInterval(id);
      window.removeEventListener("jellytics:backend-error", recheck);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("online", recheck);
      window.removeEventListener("offline", goOffline);
    };
  }, [check, pollMs]);

  return online;
}
