"use client";

import { OverviewCards } from "@/components/stats/OverviewCards";
import { GenreBreakdown } from "@/components/stats/GenreBreakdown";
import { WatchTimeChart } from "@/components/stats/WatchTimeChart";
import { CurrentlyWatching } from "@/components/sessions";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { TopGenres } from "@/components/dashboard/TopGenres";
import { ContinueWatching } from "@/components/dashboard/ContinueWatching";
import { RecentlyAdded } from "@/components/dashboard/RecentlyAdded";
import { Recommendations } from "@/components/dashboard/Recommendations";
import { GoalsWidget } from "@/components/dashboard/GoalsWidget";
import {
	AppLayout,
	PageHeader,
	PageContent,
} from "@/components/layout";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { RefreshCw } from "lucide-react";

function InitialSyncBanner() {
	const { hasSyncedData, syncHealth, refetch } = useSyncStatus();

	if (hasSyncedData) {
		return null;
	}

	const dataCount = syncHealth?.data_counts
		? syncHealth.data_counts.shows + syncHealth.data_counts.movies
		: 0;

	return (
		<div className="rounded-2xl backdrop-blur-xl bg-purple-500/10 border border-purple-500/20 p-6">
			<div className="flex items-center gap-4">
				<div className="p-3 rounded-xl bg-purple-500/20">
					<RefreshCw className="h-6 w-6 text-purple-400" />
				</div>
				<div className="flex-1">
					<h3 className="text-white font-semibold">No data yet</h3>
					<p className="text-white/50 text-sm">
						{dataCount > 0
							? `${dataCount} items synced so far. Sync runs automatically in the background.`
							: "Data is synced from Jellyfin to the database on a schedule. Trigger a manual sync in Settings, or wait for the next automatic sync."}
					</p>
				</div>
				<button
					onClick={() => refetch()}
					className="text-sm text-purple-400 hover:text-purple-300 transition-colors shrink-0"
				>
					Refresh
				</button>
			</div>
		</div>
	);
}

export default function DashboardPage() {
	return (
		<AppLayout>
			<PageContent>
				<PageHeader
					title="Dashboard"
					description="Your Jellytics overview - viewing statistics and activity"
				/>
				<InitialSyncBanner />

				{/* 1. Stats block */}
				<section className="space-y-4">
					<OverviewCards />
					<QuickStats />
					<GoalsWidget />
				</section>

				{/* 2. Active viewing — Continue Watching + Currently Watching */}
				<section className="grid gap-4 lg:grid-cols-2 lg:gap-6">
					<ContinueWatching />
					<CurrentlyWatching />
				</section>

				{/* 3. Discovery — Recommendations + Recently Added */}
				<section className="grid gap-4 lg:grid-cols-2 lg:gap-6">
					<Recommendations />
					<RecentlyAdded />
				</section>

				{/* 4. Analytics — Watch Time Chart + Top Genres, then Genre Breakdown */}
				<section className="space-y-6">
					<div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
						<div className="lg:col-span-2">
							<WatchTimeChart />
						</div>
						<div>
							<TopGenres />
						</div>
					</div>
					<GenreBreakdown />
				</section>
			</PageContent>
		</AppLayout>
	);
}
