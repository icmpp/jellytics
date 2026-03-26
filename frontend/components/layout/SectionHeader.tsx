"use client";

interface SectionHeaderProps {
	icon: React.ReactNode;
	title: string;
	/** Optional extra content (e.g. count) on the right */
	extra?: React.ReactNode;
}

/**
 * Shared section header for dashboard sections (Continue Watching, Recommendations, etc).
 * Provides consistent icon + title styling.
 */
export function SectionHeader({ icon, title, extra }: SectionHeaderProps) {
	return (
		<div className="flex items-center justify-between gap-2 mb-4">
			<div className="flex items-center gap-2">
				{icon}
				<h2 className="text-lg font-semibold text-white">{title}</h2>
			</div>
			{extra}
		</div>
	);
}
