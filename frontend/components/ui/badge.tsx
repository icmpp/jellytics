import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 border transition-colors [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-purple-500/20 border-purple-500/30 text-purple-300",
        secondary: "bg-white/[0.06] border-white/[0.08] text-white/70",
        destructive: "bg-red-500/20 border-red-500/30 text-red-400",
        outline: "bg-transparent border-white/[0.08] text-white/60",
        success: "bg-emerald-500/20 border-emerald-500/30 text-emerald-400",
        warning: "bg-amber-500/20 border-amber-500/30 text-amber-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
