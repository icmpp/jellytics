"use client";

import { useRestoreShow } from "@/hooks/useShows";
import { useRestoreMovie } from "@/hooks/useMovies";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/useToast";

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
  itemTitle,
  variant = "outline",
  size = "sm",
  className,
  children,
}: RestoreFromArchiveButtonProps) {
  const restoreShow = useRestoreShow();
  const restoreMovie = useRestoreMovie();

  const mutation = itemType === "show" ? restoreShow : restoreMovie;
  const isLoading = mutation.isPending;

  const handleRestore = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (itemType === "show") {
        await restoreShow.mutateAsync(itemId);
      } else {
        await restoreMovie.mutateAsync(itemId);
      }
      toast.success({
        title: "Restored to library",
        description: `"${itemTitle}" has been restored to your library.`,
      });
    } catch (error) {
      console.error("Failed to restore from archive:", error);
      toast.error({
        title: "Error",
        description: "Failed to restore. Please try again.",
      });
    }
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
