"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const isDestructive = variant === "destructive";

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

  type ChildProps = {
    disabled?: boolean;
    onClick?: (e: React.MouseEvent) => void;
  };
  const childProps: ChildProps = React.isValidElement(children)
    ? (children as React.ReactElement<ChildProps>).props
    : {};
  const triggerChild = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement,
        {
          ...triggerProps,
          disabled: isLoading || childProps.disabled,
          onClick: (e: React.MouseEvent) => {
            childProps.onClick?.(e);
            (triggerProps as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
          },
        } as Record<string, unknown>,
      )
    : children;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{triggerChild}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        className={cn("w-[min(20rem,calc(100vw-2rem))]", isDestructive && "border-red-500/20")}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            {isDestructive && (
              <div className="shrink-0 mt-0.5 flex items-center justify-center h-8 w-8 rounded-full bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{title}</p>
              <div className="text-[13px] text-white/50 leading-relaxed mt-1">{description}</div>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-white/6">
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
              variant={isDestructive ? "destructive" : "default"}
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
