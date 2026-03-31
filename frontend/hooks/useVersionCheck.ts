"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface VersionInfo {
  current: string | null;
  latest: string | null;
  isOutdated: boolean;
  isLoading: boolean;
  latestUrl: string | null;
}

const GITHUB_REPO = "icmpp/jellytics";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CACHE_KEY = "jellytics_version_check";

interface CachedVersion {
  latest: string;
  latestUrl: string;
  checkedAt: number;
}

function getCachedVersion(): CachedVersion | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedVersion;
    if (Date.now() - cached.checkedAt < CHECK_INTERVAL_MS) return cached;
  } catch {
    // ignore
  }
  return null;
}

function setCachedVersion(latest: string, latestUrl: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ latest, latestUrl, checkedAt: Date.now() }));
  } catch {
    // ignore
  }
}

function normalizeVersion(v: string): string {
  return v.replace(/^v/, "");
}

function isNewer(latest: string, current: string): boolean {
  const l = normalizeVersion(latest).split(".").map(Number);
  const c = normalizeVersion(current).split(".").map(Number);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lp = l[i] ?? 0;
    const cp = c[i] ?? 0;
    if (lp > cp) return true;
    if (lp < cp) return false;
  }
  return false;
}

export function useVersionCheck(): VersionInfo {
  const [current, setCurrent] = useState<string | null>(null);
  const [latest, setLatest] = useState<string | null>(null);
  const [latestUrl, setLatestUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const { version } = await api.get<{ version: string }>("/version");
        if (cancelled) return;
        setCurrent(version);

        if (version === "dev") {
          setIsLoading(false);
          return;
        }

        const cached = getCachedVersion();
        if (cached) {
          setLatest(cached.latest);
          setLatestUrl(cached.latestUrl);
          setIsLoading(false);
          return;
        }

        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
          headers: { Accept: "application/vnd.github.v3+json" },
        });
        if (!res.ok) {
          setIsLoading(false);
          return;
        }
        const data = (await res.json()) as {
          tag_name: string;
          html_url: string;
        };
        if (cancelled) return;

        setLatest(data.tag_name);
        setLatestUrl(data.html_url);
        setCachedVersion(data.tag_name, data.html_url);
      } catch {
        // Silently fail — version check is non-critical
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const isOutdated = !!current && current !== "dev" && !!latest && isNewer(latest, current);

  return { current, latest, isOutdated, isLoading, latestUrl };
}
