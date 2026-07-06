"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2.5 p-4 sm:max-w-[420px]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

// Terminal-window chrome: rounded-sm panel, #07070d body, #16162a hairline with a
// variant-colored left accent. The variant semantics live in the title-bar tag.
const toastVariants = cva(
  "group pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-sm border bg-[#07070d] font-mono text-white shadow-[0_8px_40px_-8px_rgba(0,0,0,0.6)] transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border-[#16162a] border-l-2 border-l-violet-500/60",
        destructive: "border-[#16162a] border-l-2 border-l-red-500/60",
        success: "border-[#16162a] border-l-2 border-l-emerald-500/60",
        info: "border-[#16162a] border-l-2 border-l-violet-500/60",
        warning: "border-[#16162a] border-l-2 border-l-amber-500/60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type ToastVariant = "default" | "destructive" | "success" | "info" | "warning";

const VARIANT_META: Record<ToastVariant, { tag: string; glyph: string; color: string }> = {
  default: { tag: "msg", glyph: "›", color: "text-violet-300" },
  success: { tag: "success", glyph: "✓", color: "text-emerald-400" },
  destructive: { tag: "error", glyph: "✕", color: "text-red-400" },
  info: { tag: "info", glyph: "›", color: "text-violet-300" },
  warning: { tag: "warning", glyph: "!", color: "text-amber-400" },
};

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, children, ...props }, ref) => {
  const meta = VARIANT_META[(variant as ToastVariant) ?? "default"];

  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {/* Terminal title bar */}
      <div
        className="flex h-7 shrink-0 items-center gap-2 px-3"
        style={{ background: "#06060d", borderBottom: "1px solid #16162a" }}
      >
        <div aria-hidden className="flex shrink-0 items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[#ef4444]/70" />
          <div className="h-2 w-2 rounded-full bg-[#f59e0b]/70" />
          <div className="h-2 w-2 rounded-full bg-[#22c55e]/70" />
        </div>
        <span
          className={cn(
            "flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] select-none",
            meta.color,
          )}
        >
          <span aria-hidden>{meta.glyph}</span>
          {meta.tag}
        </span>
      </div>

      {/* Body */}
      <div className="px-3.5 py-2.5">{children}</div>
    </ToastPrimitives.Root>
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "mt-2.5 inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-violet-500/30 bg-violet-500/10 px-2.5 font-mono text-xs text-violet-300 transition-colors hover:border-violet-500/50 hover:bg-violet-500/20 hover:text-violet-200 focus:outline-none focus:ring-1 focus:ring-violet-500/40 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-1.5 top-0 flex h-7 w-7 items-center justify-center rounded-sm text-white/30 transition-colors hover:bg-[#0d0d1a] hover:text-white/70 focus:outline-none focus:ring-1 focus:ring-violet-500/30",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("font-mono text-sm font-semibold leading-snug text-white/90", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(
      "mt-1 font-mono text-xs leading-relaxed text-white/55 before:mr-1.5 before:select-none before:text-violet-400/40 before:content-['#']",
      className,
    )}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<React.ComponentPropsWithoutRef<typeof ToastAction>>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
