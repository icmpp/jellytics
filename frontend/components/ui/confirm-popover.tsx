"use client";

import * as React from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ConfirmPopoverProps {
	/** Whether the popover is open */
	open: boolean;
	/** Called when open state changes (e.g. user clicks outside) */
	onOpenChange: (open: boolean) => void;
	/** Title shown in the confirmation */
	title: string;
	/** Description or details (can include JSX for highlighted text) */
	description: React.ReactNode;
	/** Label for the confirm/primary button */
	confirmLabel: string;
	/** Label for the cancel button */
	cancelLabel?: string;
	/** Icon shown in the confirm button */
	confirmIcon?: LucideIcon;
	/** "destructive" for red confirm button (e.g. remove/delete), "default" otherwise */
	variant?: "destructive" | "default";
	/** Whether the confirm action is in progress */
	isLoading?: boolean;
	/** Called when user confirms */
	onConfirm: (e?: React.MouseEvent) => void | Promise<void>;
	/** Trigger element (e.g. Button) */
	children: React.ReactNode;
	/** Additional props for the trigger (e.g. disabled, className) */
	triggerProps?: Omit<React.ComponentProps<"button">, "children">;
	/** Popover alignment */
	align?: "start" | "center" | "end";
	/** Popover side */
	side?: "top" | "right" | "bottom" | "left";
}

/**
 * Shared confirmation popover for remove/delete and similar actions.
 * Matches site theme: dark backdrop, consistent typography and buttons.
 */
export function ConfirmPopover({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	cancelLabel = "Cancel",
	confirmIcon: ConfirmIcon,
	variant = "destructive",
	isLoading = false,
	onConfirm,
	children,
	triggerProps = {},
	align = "end",
	side = "top",
}: ConfirmPopoverProps) {
	const handleConfirm = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		await onConfirm(e);
	};

	const handleCancelClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		onOpenChange(false);
	};

	const handleTriggerClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation(); // Prevent navigation when inside Link (e.g. watchlist cards)
	};

	type ChildProps = { disabled?: boolean; onClick?: (e: React.MouseEvent) => void };
	const childProps: ChildProps = React.isValidElement(children)
		? (children as React.ReactElement<ChildProps>).props
		: {};
	const triggerChild = React.isValidElement(children)
		? React.cloneElement(children as React.ReactElement, {
				...triggerProps,
				disabled: isLoading || childProps.disabled,
				onClick: (e: React.MouseEvent) => {
					handleTriggerClick(e);
					childProps.onClick?.(e);
					(triggerProps as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
				},
			} as Record<string, unknown>)
		: children;

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				{triggerChild}
			</PopoverTrigger>
			<PopoverContent
				align={align}
				side={side}
				sideOffset={8}
				className="w-[min(20rem,calc(100vw-2rem))]"
			>
				<div className="space-y-3">
					<div>
						<p className="text-sm font-medium text-white mb-0.5">
							{title}
						</p>
						<div className="text-xs text-white/60 leading-relaxed">
							{description}
						</div>
					</div>
					<div className="flex gap-2 pt-1 border-t border-white/10">
						<Button
							variant="outline"
							size="sm"
							onClick={handleCancelClick}
							disabled={isLoading}
							className="flex-1"
						>
							{cancelLabel}
						</Button>
						<Button
							variant={variant === "destructive" ? "destructive" : "default"}
							size="sm"
							onClick={handleConfirm}
							disabled={isLoading}
							className="flex-1"
						>
							{isLoading ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : ConfirmIcon ? (
								<ConfirmIcon className="h-3.5 w-3.5" />
							) : null}
							{isLoading ? "Processing…" : confirmLabel}
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
