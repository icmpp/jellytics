import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border px-4 text-sm text-white placeholder-white/30 transition-all outline-none",
        "bg-white/[0.03] border-white/[0.08]",
        "focus:bg-white/[0.05] focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "file:text-white file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
