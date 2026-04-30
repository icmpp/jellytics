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
import { FolderOpen, FolderPlus, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmPopover } from "@/components/ui/confirm-popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
          <FolderPlus className="h-12 w-12 text-white/20" />
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
      className="block min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div
        className={cn(
          "card-border group relative rounded-2xl p-[2px]",
          "shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5),0_1px_4px_-1px_rgba(0,0,0,0.35)]",
        )}
      >
        <div className="relative isolate aspect-2/3 w-full cursor-pointer overflow-hidden rounded-[calc(1rem-2px)]">
          {/* Gradient "poster" background */}
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-br from-violet-950 via-purple-950 to-fuchsia-950"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-br from-violet-500/15 via-purple-500/10 to-fuchsia-500/15"
          />

          {/* Bottom gradient for text legibility */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent"
          />

          {/* Centered folder icon */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-20">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl",
                "bg-white/8 ring-1 ring-white/10",
              )}
            >
              <FolderOpen className="h-7 w-7 text-white/50 transition-colors duration-200 group-hover:text-primary/70" />
            </div>
          </div>

          {/* Item count — top left */}
          <span
            className={cn(
              "absolute left-2 top-2 z-10",
              "flex items-center gap-1 rounded-full px-2 py-0.5",
              "bg-black/55 ring-1 ring-white/15 backdrop-blur-md",
              "text-[10px] font-semibold tabular-nums text-white/70",
            )}
          >
            {collection.itemCount}
            <span className="font-normal text-white/40">
              {collection.itemCount === 1 ? "item" : "items"}
            </span>
          </span>

          {/* Delete button — top right, revealed on hover */}
          <div
            className="absolute right-2 top-2 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
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
                  "h-7 w-7 rounded-full backdrop-blur-md",
                  "bg-black/55 ring-1 ring-white/15 text-white/60",
                  "hover:bg-red-500/30 hover:text-red-300 hover:ring-red-500/40",
                  "transition-all duration-150",
                )}
                aria-label="Delete collection"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </ConfirmPopover>
          </div>

          {/* Bottom info */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 px-3 pb-3 pt-10">
            <h3
              className={cn(
                "line-clamp-2 text-[0.8125rem] font-semibold leading-snug tracking-tight text-white",
                "transition-colors duration-200 group-hover:text-primary/90",
              )}
            >
              {collection.name}
            </h3>
            {collection.description ? (
              <p className="line-clamp-2 text-[10px] font-medium leading-snug tracking-wide text-white/45">
                {collection.description}
              </p>
            ) : (
              <p className="text-[10px] font-medium tracking-wide text-white/30">No description</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
