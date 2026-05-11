"use client";

import { useState, useRef, useEffect, type MouseEvent } from "react";
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  type Collection,
} from "@/hooks/useCollections";
import { SimpleMediaGridPage } from "@/components/media";
import { Button } from "@/components/ui/button";
import { CollectionsGridSkeleton } from "@/components/ui/collections-grid-skeleton";
import { FolderOpen, FolderPlus, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmPopover } from "@/components/ui/confirm-popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, COLLECTIONS_GRID_CLASS, MEDIA_CARD_BASE } from "@/lib/utils";

function formatCollectionDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function CollectionsPage() {
  const { data: collections = [], isLoading, isError, refetch } = useCollections();
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const createNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (createOpen) createNameInputRef.current?.focus();
  }, [createOpen]);

  const handleCreate = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newName.trim()) return;
    createCollection.mutate(
      { name: newName.trim(), description: newDesc.trim() || undefined },
      {
        onSuccess: () => {
          setNewName("");
          setNewDesc("");
          setCreateOpen(false);
        },
      },
    );
  };

  const breadcrumbItems = [{ icon: "home" as const, href: "/dashboard" }, { label: "Collections" }];

  const actions = (
    <Popover open={createOpen} onOpenChange={setCreateOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <FolderPlus className="h-4 w-4 mr-2" />
          New collection
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate(e);
          }}
          className="space-y-4"
          role="form"
          aria-label="Create collection"
        >
          <div>
            <Label htmlFor="collection-name">Name</Label>
            <Input
              ref={createNameInputRef}
              id="collection-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Sci-Fi favorites"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="collection-desc">Description (optional)</Label>
            <Textarea
              id="collection-desc"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="A short description..."
              rows={2}
              className="mt-1.5"
            />
          </div>
          <Button type="submit" disabled={!newName.trim() || createCollection.isPending}>
            {createCollection.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating…
              </>
            ) : (
              "Create"
            )}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );

  return (
    <SimpleMediaGridPage<Collection>
      breadcrumb={breadcrumbItems}
      title="Collections"
      description="Organize your movies and shows into custom collections"
      icon={<FolderPlus className="h-6 w-6 sm:h-7 sm:w-7 text-purple-400 shrink-0" />}
      actions={actions}
      isLoading={isLoading}
      isError={isError}
      errorContent={
        <div className="flex flex-col items-center py-24 text-center">
          <FolderPlus className="h-16 w-16 text-white/20 mx-auto mb-4" />
          <p className="text-base font-medium text-white/60 mb-1.5">Failed to load collections</p>
          <p className="text-sm text-white/40 mb-4">Something went wrong. Please try again.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      }
      isEmpty={collections.length === 0}
      emptyContent={
        <div className="flex flex-col items-center py-24 gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/4 border border-white/8">
            <FolderOpen className="h-8 w-8 text-white/20" />
          </div>
          <div className="text-center max-w-sm w-full">
            <p className="text-white/60 text-lg mb-2 font-medium">No collections yet</p>
            <p className="text-sm text-white/40 mb-6 mx-auto">
              Create a collection to group your movies and shows. Add items from any movie or show
              detail page.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate(e);
              }}
              className="flex flex-col gap-4 p-6 rounded-2xl bg-white/3 border border-white/8 text-left"
              aria-label="Create your first collection"
            >
              <div>
                <Label htmlFor="empty-collection-name">Name</Label>
                <Input
                  id="empty-collection-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sci-Fi favorites"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="empty-collection-desc">Description (optional)</Label>
                <Textarea
                  id="empty-collection-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="A short description..."
                  rows={2}
                  className="mt-1.5"
                />
              </div>
              <Button
                type="submit"
                disabled={!newName.trim() || createCollection.isPending}
                className="w-full"
              >
                {createCollection.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating…
                  </>
                ) : (
                  <>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Create your first collection
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      }
      skeletonContent={<CollectionsGridSkeleton count={6} />}
      gridClass={COLLECTIONS_GRID_CLASS}
      items={collections}
      renderCard={(c) => (
        <CollectionCard
          collection={c}
          onDelete={() => deleteCollection.mutate(c.id)}
          isDeleting={deleteCollection.isPending && deleteCollection.variables === c.id}
        />
      )}
      getItemKey={(c) => String(c.id)}
    />
  );
}

function CollectionCard({
  collection,
  onDelete,
  isDeleting,
}: {
  collection: Collection;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      href={`/collections/${collection.id}`}
      aria-label={`Open collection: ${collection.name}`}
      className="block min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background group"
    >
      <div
        className={cn(
          MEDIA_CARD_BASE,
          "relative p-4 flex gap-3.5 items-start",
          "hover:border-white/12 hover:bg-linear-to-b hover:from-white/[0.07] hover:to-white/3",
          "transition-all duration-200",
        )}
      >
        {/* Folder icon */}
        <div className="shrink-0 mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500/20 to-purple-600/20 border border-white/8">
          <FolderOpen className="h-5 w-5 text-purple-400/80 transition-colors duration-200 group-hover:text-purple-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-6">
          <h3
            className={cn(
              "text-sm font-semibold text-white leading-snug truncate",
              "transition-colors duration-200 group-hover:text-purple-300",
            )}
          >
            {collection.name}
          </h3>

          {collection.description ? (
            <p className="mt-1 text-xs text-white/45 line-clamp-2 leading-relaxed">
              {collection.description}
            </p>
          ) : (
            <p className="mt-1 text-xs text-white/25 italic">No description</p>
          )}

          <div className="mt-2.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/6 border border-white/8 px-2 py-0.5 text-[10px] font-medium text-white/50 tabular-nums">
              {collection.itemCount}{" "}
              <span className="font-normal text-white/35">
                {collection.itemCount === 1 ? "item" : "items"}
              </span>
            </span>
            {collection.createdAt && (
              <span className="text-[10px] text-white/25">
                {formatCollectionDate(collection.createdAt)}
              </span>
            )}
          </div>
        </div>

        {/* Delete button — top right, revealed on hover */}
        <div
          className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          onClick={stop}
        >
          <ConfirmPopover
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Delete collection?"
            description={
              <>
                <span className="text-white/70">&quot;{collection.name}&quot;</span> and all its
                items will be permanently removed.
              </>
            }
            confirmLabel="Delete"
            cancelLabel="Cancel"
            confirmIcon={Trash2}
            variant="destructive"
            isLoading={isDeleting}
            onConfirm={() => {
              onDelete();
              setConfirmOpen(false);
            }}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn(
                "h-6 w-6 rounded-full",
                "bg-white/6 ring-1 ring-white/10 text-white/40",
                "hover:bg-red-500/20 hover:text-red-300 hover:ring-red-500/30",
                "transition-all duration-150",
              )}
              aria-label="Delete collection"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </ConfirmPopover>
        </div>
      </div>
    </Link>
  );
}
