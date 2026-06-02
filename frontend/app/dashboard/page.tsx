"use client";

import { OverviewCards } from "@/components/stats/OverviewCards";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { MediaWindow } from "@/components/dashboard/MediaWindow";
import { AnalyticsWindow } from "@/components/dashboard/AnalyticsWindow";
import { GoalsWidget } from "@/components/dashboard/GoalsWidget";
import { AppLayout, PageHeader, PageContent } from "@/components/layout";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { RefreshCw, ArrowUpCircle, ExternalLink } from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function DockerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.186m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.185-.186H5.136a.186.186 0 0 0-.186.185v1.888c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" />
    </svg>
  );
}

function UpdateBanner() {
  const { current, latest, isOutdated, latestUrl } = useVersionCheck();

  if (!isOutdated) return null;

  return (
    <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20 shrink-0">
          <ArrowUpCircle className="h-4 w-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-amber-400 text-xs font-mono font-medium">update_available</p>
          <p className="text-white/40 text-[11px] font-mono mt-0.5">
            running <span className="text-white/60">{current}</span>
            {" — "}
            <span className="text-amber-400">{latest}</span> available
          </p>
        </div>
        {latestUrl && (
          <a
            href={latestUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-mono text-amber-400 hover:text-amber-300 transition-colors shrink-0"
          >
            view release
            <ExternalLink className="h-3 w-3 ml-0.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function DashboardHeaderActions() {
  const { current, isOutdated, latestUrl } = useVersionCheck();

  return (
    <div className="flex items-center gap-1.5">
      {current &&
        current !== "dev" &&
        (isOutdated && latestUrl ? (
          <a
            href={latestUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono bg-amber-500/8 border border-amber-500/20 text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/35 transition-all"
            title="Update available"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />v
            {current.replace(/^v/, "")}
          </a>
        ) : (
          <span className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono bg-violet-500/5 border border-[#1e1e32] text-violet-500/50">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400/40 shrink-0" />v
            {current.replace(/^v/, "")}
          </span>
        ))}
      <a
        href="https://github.com/icmpp/jellytics"
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 rounded-md border border-transparent text-white/30 hover:text-violet-400 hover:border-[#1e1e32] hover:bg-violet-500/5 transition-all"
        title="GitHub"
      >
        <GithubIcon className="h-4 w-4" />
      </a>
      <a
        href="https://hub.docker.com/r/icmppp/jellytics"
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 rounded-md border border-transparent text-white/30 hover:text-violet-400 hover:border-[#1e1e32] hover:bg-violet-500/5 transition-all"
        title="Docker Hub"
      >
        <DockerIcon className="h-4 w-4" />
      </a>
    </div>
  );
}

function InitialSyncBanner() {
  const { hasSyncedData, syncHealth, refetch } = useSyncStatus();

  if (hasSyncedData) {
    return null;
  }

  const dataCount = syncHealth?.data_counts
    ? syncHealth.data_counts.shows + syncHealth.data_counts.movies
    : 0;

  return (
    <div className="rounded-xl bg-violet-500/5 border border-violet-500/15 p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-md bg-violet-500/10 border border-violet-500/20 shrink-0">
          <RefreshCw className="h-4 w-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-violet-400 text-xs font-mono font-medium">no_data_yet</p>
          <p className="text-white/40 text-[11px] font-mono mt-0.5">
            {dataCount > 0
              ? `${dataCount} items synced. sync running in background...`
              : "data synced from jellyfin on schedule. trigger manual sync in settings, or wait."}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-[11px] font-mono text-violet-400/70 hover:text-violet-300 transition-colors shrink-0"
        >
          refresh
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Dashboard"
        description="Your Jellytics overview - viewing statistics and activity"
        actions={<DashboardHeaderActions />}
      />
      <PageContent>
        <UpdateBanner />
        <InitialSyncBanner />

        {/* 1. Stats block */}
        <section className="space-y-3 sm:space-y-4">
          <OverviewCards />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <QuickStats />
            <GoalsWidget />
          </div>
        </section>

        {/* 2. Media feeds */}
        <MediaWindow />

        {/* 3. Analytics */}
        <AnalyticsWindow />
      </PageContent>
    </AppLayout>
  );
}
