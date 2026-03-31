"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDeleteShow } from "@/hooks/useShows";
import { useDeleteMovie } from "@/hooks/useMovies";
import { Button } from "@/components/ui/button";
import { ConfirmPopover } from "@/components/ui/confirm-popover";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/useToast";

interface RemoveFromLibraryButtonProps {
  itemType: "show" | "movie";
  itemId: number;
  itemTitle: string;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
  className?: string;
  children?: React.ReactNode;
  iconOnly?: boolean;
}

export function RemoveFromLibraryButton({
  itemType,
  itemId,
  itemTitle,
  variant = "ghost",
  size = "sm",
  className,
  children,
  iconOnly = false,
}: RemoveFromLibraryButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const deleteShow = useDeleteShow();
  const deleteMovie = useDeleteMovie();

  const mutation = itemType === "show" ? deleteShow : deleteMovie;
  const isLoading = mutation.isPending;

  const handleRemove = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      if (itemType === "show") {
        await deleteShow.mutateAsync(itemId);
      } else {
        await deleteMovie.mutateAsync(itemId);
      }
      setOpen(false);
      toast.success({
        title: "Removed from library",
        description: `"${itemTitle}" has been removed from your library.`,
      });
      router.push(itemType === "show" ? "/shows" : "/movies");
    } catch (error) {
      console.error("Failed to remove from library:", error);
      toast.error({
        title: "Error",
        description: "Failed to remove from library. Please try again.",
      });
    }
  };

  const buttonContent = children || (
    <>
      <Trash2 className={iconOnly ? "size-6" : "h-4 w-4"} />
      {!iconOnly && "Remove from library"}
    </>
  );

  return (
    <ConfirmPopover
      open={open}
      onOpenChange={setOpen}
      title="Remove from library?"
      description={
        <>
          <span className="text-white/70">&quot;{itemTitle}&quot;</span> will be permanently
          removed, including watch history, ratings, and reviews. This cannot be undone.
        </>
      }
      confirmLabel="Remove"
      cancelLabel="Cancel"
      confirmIcon={Trash2}
      variant="destructive"
      isLoading={isLoading}
      onConfirm={handleRemove}
    >
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        aria-label="Remove from library"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonContent}
      </Button>
    </ConfirmPopover>
  );
}
