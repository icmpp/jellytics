"use client";

import { useState, useRef, useEffect, type MouseEvent } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  useCollection,
  useRemoveFromCollection,
  useUpdateCollection,
} from "@/hooks/useCollections";
import { AppLayout, PageContent, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { MediaGridSkeleton } from "@/components/ui/media-grid-skeleton";
import { FolderOpen, Film, Tv, Trash2, Pencil, Loader2, ArrowUp, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  resolvePosterUrl,
  MEDIA_GRID_CLASS,
  MEDIA_CARD_LINK_CLASS,
  cn,
} from "@/lib/utils";
import { PosterImage } from "@/components/ui/poster-image";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmPopover } from "@/components/ui/confirm-popover";

export default function CollectionDetailPage() {
  const params = useParams();
  const id = parseInt(params.id as string, 10);
  const { data: collection, isLoading, error } = useCollection(id);
  const removeFromCollection = useRemoveFromCollection();
  const updateCollection = useUpdateCollection();
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const editNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editOpen) editNameInputRef.current?.focus();
  }, [editOpen]);

  const breadcrumbItems = [
    { icon: "home" as const, href: "/dashboard" },
    { label: "Collections", href: "/collections" },
    { label: collection?.name ?? "…" },
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader breadcrumb={breadcrumbItems} title="" />
        <PageContent>
          <MediaGridSkeleton count={12} />
        </PageContent>
      </AppLayout>
    );
  }

  if (error || !collection) {
    return (
      <AppLayout>
        <PageHeader breadcrumb={breadcrumbItems} title="Collection not found" />
        <PageContent>
          <div className="flex flex-col items-center py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/4 border border-white/8 mb-5">
              <FolderOpen className="h-8 w-8 text-white/20" />
            </div>
            <p className="text-base font-medium text-white/60 mb-1.5">Collection not found</p>
            <p className="text-sm text-white/40 mb-6">
              This collection may have been deleted or doesn&apos;t exist.
            </p>
            <Link href="/collections">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Collections
              </Button>
            </Link>
          </div>
        </PageContent>
      </AppLayout>
    );
  }

  const handleUpdate = () => {
    updateCollection.mutate(
      { id, name: editName.trim() || undefined, description: editDesc.trim() || undefined },
      { onSuccess: () => setEditOpen(false) },
    );
  };

  const itemCountLabel = `${collection.itemCount} ${collection.itemCount === 1 ? "item" : "items"}`;
  const description = collection.description
    ? `${collection.description} · ${itemCountLabel}`
    : itemCountLabel;

  return (
    <AppLayout>
      <PageHeader
        breadcrumb={breadcrumbItems}
        title={collection.name}
        description={description}
        icon={<FolderOpen className="h-6 w-6 sm:h-7 sm:w-7 text-purple-400 shrink-0" />}
        actions={
          <Popover
            open={editOpen}
            onOpenChange={(o) => {
              setEditOpen(o);
              if (o) {
                setEditName(collection.name);
                setEditDesc(collection.description ?? "");
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUpdate();
                }}
                className="space-y-4"
                aria-label="Edit collection"
              >
                <div>
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    ref={editNameInputRef}
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Collection name"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-desc">Description (optional)</Label>
                  <Textarea
                    id="edit-desc"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="A short description..."
                    rows={2}
                    className="mt-1.5"
                  />
                </div>
                <Button type="submit" disabled={!editName.trim() || updateCollection.isPending}>
                  {updateCollection.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </form>
            </PopoverContent>
          </Popover>
        }
      />

      <PageContent>
        {collection.items.length === 0 ? (
          <div className="flex flex-col items-center py-24 px-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/4 border border-white/8 mb-5">
              <FolderOpen className="h-8 w-8 text-white/20" />
            </div>
            <p className="text-base font-medium text-white/60 mb-1.5">This collection is empty</p>
            <p className="text-sm text-white/35 mb-8">
              Add movies or shows from their detail pages.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/movies">
                <Button variant="outline" className="gap-2">
                  <Film className="h-4 w-4" />
                  Browse Movies
                </Button>
              </Link>
              <Link href="/shows">
                <Button variant="outline" className="gap-2">
                  <Tv className="h-4 w-4" />
                  Browse Shows
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className={MEDIA_GRID_CLASS}>
            {collection.items.map((item, index) => (
              <motion.div
                key={`${item.itemType}-${item.itemId}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  delay: Math.min(index * 0.035, 0.45),
                  ease: "easeOut",
                }}
              >
                <CollectionItemCard
                  item={item}
                  onRemove={() =>
                    removeFromCollection.mutate({
                      collectionId: id,
                      itemType: item.itemType,
                      itemId: item.itemId,
                    })
                  }
                  isRemoving={
                    removeFromCollection.isPending &&
                    removeFromCollection.variables?.itemId === item.itemId &&
                    removeFromCollection.variables?.itemType === item.itemType
                  }
                />
              </motion.div>
            ))}
          </div>
        )}
      </PageContent>

      <JumpToTopButton />
    </AppLayout>
  );
}

function CollectionItemCard({
  item,
  onRemove,
  isRemoving,
}: {
  item: { itemType: string; itemId: number; title?: string; posterUrl?: string };
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const href = item.itemType === "show" ? `/shows/${item.itemId}` : `/movies/${item.itemId}`;
  const Icon = item.itemType === "show" ? Tv : Film;
  const posterSrc = item.posterUrl ? resolvePosterUrl(item.posterUrl) : undefined;

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      href={href}
      aria-label={`View details for ${item.title || "Untitled"}`}
      className={MEDIA_CARD_LINK_CLASS}
    >
      {/* card-border gives the animated gradient border on hover */}
      <div
        className={cn(
          "card-border group relative rounded-2xl p-[2px]",
          "shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5),0_1px_4px_-1px_rgba(0,0,0,0.35)]",
        )}
      >
        <div className="relative isolate aspect-2/3 w-full cursor-pointer overflow-hidden rounded-[calc(1rem-2px)] bg-zinc-950">
          {/* Poster */}
          <PosterImage
            src={posterSrc}
            alt={item.title || ""}
            type={item.itemType === "show" ? "show" : "movie"}
            sizes="(max-width: 640px) 50vw, 20vw"
            showLabel={false}
          />

          {/* Base gradient — legibility at bottom */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/90 via-black/35 to-black/10"
          />

          {/* Hover gradient deepening */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />

          {/* Specular highlight on hover */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(ellipse 80% 35% at 50% 0%, rgba(255,255,255,0.05), transparent)",
            }}
          />

          {/* Type badge — top left */}
          <div className="absolute left-2 top-2 z-10">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                "bg-black/55 ring-1 ring-white/15 backdrop-blur-md",
                "text-[10px] font-semibold text-white/70",
              )}
            >
              <Icon className="h-2.5 w-2.5" />
              {item.itemType === "show" ? "Show" : "Movie"}
            </span>
          </div>

          {/* Remove button — top right, revealed on hover */}
          <div
            className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            onClick={stop}
          >
            <ConfirmPopover
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title="Remove from collection?"
              description={
                <>
                  <span className="text-white/70">
                    &quot;{item.title || "This item"}&quot;
                  </span>{" "}
                  will be removed from this collection.
                </>
              }
              confirmLabel="Remove"
              cancelLabel="Cancel"
              confirmIcon={Trash2}
              variant="destructive"
              isLoading={isRemoving}
              onConfirm={() => {
                onRemove();
                setConfirmOpen(false);
              }}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "h-7 w-7 rounded-full backdrop-blur-md",
                  "bg-black/55 ring-1 ring-white/15 text-white/60",
                  "hover:bg-red-500/30 hover:text-red-300 hover:ring-red-500/40",
                  "transition-all duration-150",
                )}
                aria-label="Remove from collection"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </ConfirmPopover>
          </div>

          {/* Bottom info zone — title overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 px-3 pb-3 pt-10">
            <h3
              className={cn(
                "line-clamp-2 text-[0.8125rem] font-semibold leading-snug tracking-tight text-white",
                "transition-colors duration-200 group-hover:text-primary/90",
              )}
            >
              {item.title || "Untitled"}
            </h3>
          </div>
        </div>
      </div>
    </Link>
  );
}

function JumpToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 800);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Jump to top"
      className={cn(
        "fixed bottom-6 right-6 z-30 h-11 w-11 rounded-full",
        "bg-purple-500/90 text-white shadow-xl shadow-black/40",
        "hover:bg-purple-500 transition-colors",
        "flex items-center justify-center",
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
