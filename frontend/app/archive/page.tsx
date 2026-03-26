"use client";

import { memo, useMemo, useState } from "react";
import { useArchive, type ArchiveItem } from "@/hooks/useArchive";
import { SimpleMediaGridPage } from "@/components/media";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Archive, Film, Tv } from "lucide-react";
import Link from "next/link";
import {
	getMoviePosterUrl,
	getShowPosterUrl,
	formatRuntime,
	cn,
	MEDIA_CARD_BASE,
	MEDIA_CARD_TITLE_CLASS,
} from "@/lib/utils";
import { PosterImage } from "@/components/ui/poster-image";
import { RestoreFromArchiveButton } from "@/components/library/RestoreFromArchiveButton";

type TypeFilter = "all" | "show" | "movie";
type SortOrder = "date_removed" | "title_asc" | "title_desc" | "type";

const ArchiveCard = memo(function ArchiveCard({ item }: { item: ArchiveItem }) {
	const isShow = item.type === "show";
	const href = isShow ? `/shows/${item.id}` : `/movies/${item.id}`;
	const posterUrl = isShow
		? getShowPosterUrl(item.jellyfin_id)
		: getMoviePosterUrl(item.jellyfin_id);

	return (
		<div className={cn(MEDIA_CARD_BASE, "group min-w-0 h-full flex flex-col")}>
			<Link
				href={href}
				className="min-w-0 flex-1 min-h-0 flex flex-col cursor-pointer"
			>
				<div className="relative aspect-[2/3] w-full overflow-hidden shrink-0">
					<PosterImage
						src={posterUrl}
						alt={item.title}
						type={isShow ? "show" : "movie"}
						sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
						hoverScale
						iconSize="h-12 w-12"
						showLabel={false}
					/>
					<div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30">
						<Archive className="h-3 w-3 text-amber-400" aria-hidden />
						<span className="text-xs font-medium text-amber-300">Removed</span>
					</div>
				</div>
				<div className="p-4 flex-1 min-h-0 flex flex-col">
					<h3 className={cn(MEDIA_CARD_TITLE_CLASS, "group-hover:text-purple-400 transition-colors")}>
						{item.title}
					</h3>
					<div className="flex items-center gap-2 text-xs text-white/50">
						{item.year && <span>{item.year}</span>}
						{(item.totalWatchTimeMinutes ?? 0) > 0 && (
							<>
								{item.year && <span>·</span>}
								<span>{formatRuntime(item.totalWatchTimeMinutes ?? 0)}</span>
							</>
						)}
					</div>
				</div>
			</Link>
			<div className="p-4 pt-0 shrink-0" onClick={(e) => e.stopPropagation()}>
				<RestoreFromArchiveButton
					itemType={item.type}
					itemId={item.id}
					itemTitle={item.title}
					variant="outline"
					size="sm"
					className="w-full bg-muted border border-border text-foreground hover:bg-accent"
				/>
			</div>
		</div>
	);
});

function EmptyArchive({ typeFilter }: { typeFilter: TypeFilter }) {
	return (
		<div className="flex flex-col items-center py-24 px-4 text-center">
			<Archive className="h-12 w-12 text-white/15 mb-5" />
			<p className="text-base font-medium text-white/60 mb-1.5">
				{typeFilter === "all" ? "No removed items" : `No removed ${typeFilter}s`}
			</p>
			<p className="text-sm text-white/40 mb-6 max-w-xs mx-auto">
				{typeFilter === "all"
					? "When you remove a movie or show from your library, it will appear here."
					: `No ${typeFilter}s have been removed from your library yet.`}
			</p>
			<div className="flex gap-3 justify-center">
				{typeFilter !== "movie" && (
					<Link href="/shows">
						<Button variant="outline" className="gap-2">
							<Tv className="h-4 w-4" />
							Browse Shows
						</Button>
					</Link>
				)}
				{typeFilter !== "show" && (
					<Link href="/movies">
						<Button variant="outline" className="gap-2">
							<Film className="h-4 w-4" />
							Browse Movies
						</Button>
					</Link>
				)}
			</div>
		</div>
	);
}

export default function ArchivePage() {
	const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
	const [sortOrder, setSortOrder] = useState<SortOrder>("date_removed");
	const { data, isLoading, isFetching, isError } = useArchive();

	const allItems = useMemo(() => {
		if (!data) return [];
		return [
			...(data.movies ?? []).map((m) => ({ ...m, type: "movie" as const })),
			...(data.shows ?? []).map((s) => ({ ...s, type: "show" as const })),
		];
	}, [data]);

	const filteredItems = useMemo(() => {
		return [...allItems]
			.filter((item) => (typeFilter === "all" ? true : item.type === typeFilter))
			.sort((a, b) => {
				if (sortOrder === "title_asc") return a.title.localeCompare(b.title);
				if (sortOrder === "title_desc") return b.title.localeCompare(a.title);
				if (sortOrder === "type") return a.type.localeCompare(b.type);
				// date_removed (default): most recent first
				const aDate = a.removedAt ? new Date(a.removedAt).getTime() : 0;
				const bDate = b.removedAt ? new Date(b.removedAt).getTime() : 0;
				return bDate - aDate;
			});
	}, [allItems, typeFilter, sortOrder]);

	const breadcrumbItems = useMemo(
		() => [
			{ icon: "home" as const, href: "/dashboard" },
			{ label: "Archive" },
		],
		[]
	);

	const icon = (
		<Archive className="h-6 w-6 sm:h-7 sm:w-7 text-purple-400 shrink-0" />
	);

	const actions = (
		<div className="flex flex-wrap gap-2">
			<Select
				value={typeFilter}
				onValueChange={(value: TypeFilter) => setTypeFilter(value)}
			>
				<SelectTrigger className="w-[130px] h-11">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Items</SelectItem>
					<SelectItem value="show">Shows</SelectItem>
					<SelectItem value="movie">Movies</SelectItem>
				</SelectContent>
			</Select>
			<Select
				value={sortOrder}
				onValueChange={(value: SortOrder) => setSortOrder(value)}
			>
				<SelectTrigger className="w-[150px] h-11">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="date_removed">Date Removed</SelectItem>
					<SelectItem value="title_asc">Title A–Z</SelectItem>
					<SelectItem value="title_desc">Title Z–A</SelectItem>
					<SelectItem value="type">Media Type</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);

	return (
		<SimpleMediaGridPage<ArchiveItem>
			breadcrumb={breadcrumbItems}
			title="Archive"
			description="Movies and shows you've removed from your library"
			icon={icon}
			actions={actions}
			isLoading={isLoading}
			isError={isError || !data}
			isFetching={isFetching}
			errorContent={
				<div className="flex flex-col items-center py-24 text-center">
					<Archive className="h-16 w-16 text-white/20 mx-auto mb-4" />
					<p className="text-base font-medium text-white/60 mb-1.5">
						Failed to load archive
					</p>
					<p className="text-sm text-white/40">
						Something went wrong. Please try again.
					</p>
				</div>
			}
			isEmpty={filteredItems.length === 0}
			emptyContent={<EmptyArchive typeFilter={typeFilter} />}
			countLabel={`${filteredItems.length} ${filteredItems.length === 1 ? "item" : "items"} in archive`}
			items={filteredItems}
			renderCard={(item) => <ArchiveCard item={item} />}
			getItemKey={(item) => `${item.type}-${item.id}`}
		/>
	);
}
