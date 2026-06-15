"use client";

import { useRestoreShow } from "@/hooks/useShows";
import { useRestoreMovie } from "@/hooks/useMovies";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";

interface RestoreFromArchiveButtonProps {
  itemType: "show" | "movie";
  itemId: number;
  itemTitle: string;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
  className?: string;
  children?: React.ReactNode;
}

export function RestoreFromArchiveButton({
  itemType,
  itemId,
  variant = "outline",
  size = "sm",
  className,
  children,
}: RestoreFromArchiveButtonProps) {
  const restoreShow = useRestoreShow();
  const restoreMovie = useRestoreMovie();

  const mutation = itemType === "show" ? restoreShow : restoreMovie;
  const isLoading = mutation.isPending;

  // Toasts (success + undo + error) and optimistic archive removal live in the
  // restore hooks — fire-and-forget here.
  const handleRestore = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    mutation.mutate(itemId);
  };

  const buttonContent = children || (
    <>
      <RotateCcw className="h-4 w-4" />
      Restore
    </>
  );

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={isLoading}
      onClick={handleRestore}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonContent}
    </Button>
  );
}
