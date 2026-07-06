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
  /** Visual theme. "terminal" matches the terminal/vim app theme. */
  theme?: "default" | "terminal";
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
  theme = "default",
}: ConfirmPopoverProps) {
  const isDestructive = variant === "destructive";
  const isTerminal = theme === "terminal";

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
        className={cn(
          "w-[min(20rem,calc(100vw-2rem))]",
          isTerminal
            ? "overflow-hidden rounded-sm border-[#16162a] bg-[#07070d] p-0 font-mono shadow-[0_8px_40px_-8px_rgba(0,0,0,0.6)]"
            : isDestructive && "border-red-500/20",
        )}
      >
        {isTerminal ? (
          <div>
            {/* Terminal window chrome */}
            <div
              className="flex items-center gap-2.5 border-b border-[#16162a] px-3.5 py-2"
              style={{ background: "#06060d" }}
            >
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-[#ef4444]/70" />
                <div className="h-2 w-2 rounded-full bg-[#f59e0b]/70" />
                <div className="h-2 w-2 rounded-full bg-[#22c55e]/70" />
              </div>
              <span
                className={cn("text-xs", isDestructive ? "text-red-400/70" : "text-violet-400/70")}
              >
                <span className="select-none text-white/30">{"# "}</span>confirm
              </span>
            </div>

            {/* Body */}
            <div className="px-4 py-3.5">
              <p className="flex items-start gap-1.5 text-sm leading-snug text-white/85">
                <span
                  aria-hidden
                  className={cn(
                    "select-none phosphor-glow",
                    isDestructive ? "text-red-400" : "text-violet-400",
                  )}
                >
                  {isDestructive ? "!" : ">"}
                </span>
                {title}
              </p>
              <div className="mt-1.5 pl-[1.15rem] text-xs leading-relaxed text-white/50">
                {description}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelClick}
                  disabled={isLoading}
                  className="h-9 flex-1 rounded-sm border border-[#16162a] bg-[#0a0a14] text-xs lowercase text-white/60 transition-colors hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300 disabled:opacity-50"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className={cn(
                    "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-sm border text-xs lowercase transition-colors disabled:opacity-50",
                    isDestructive
                      ? "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                      : "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15",
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : ConfirmIcon ? (
                    <ConfirmIcon className="h-3.5 w-3.5" />
                  ) : null}
                  {isLoading ? "processing…" : confirmLabel}
                </button>
              </div>
            </div>
          </div>
        ) : (
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
        )}
      </PopoverContent>
    </Popover>
  );
}
