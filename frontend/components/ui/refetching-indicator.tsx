import { Loader2 } from "lucide-react";

interface RefetchingIndicatorProps {
  isFetching: boolean;
  isLoading: boolean;
}

export function RefetchingIndicator({ isFetching, isLoading }: RefetchingIndicatorProps) {
  if (!isFetching || isLoading) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-white/40">
      <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
      <span>Refreshing...</span>
    </div>
  );
}
