"use client";

interface PageContentProps {
	children: React.ReactNode;
	/** Optional max width constraint (e.g. for settings) */
	className?: string;
}

/**
 * Wrapper for page content with consistent vertical spacing between sections.
 * Use space-y-6 md:space-y-8 for even spacing between all child sections.
 */
export function PageContent({ children, className = "" }: PageContentProps) {
	return (
		<div
			className={
				className
					? `space-y-6 md:space-y-8 ${className}`
					: "space-y-6 md:space-y-8"
			}
		>
			{children}
		</div>
	);
}
