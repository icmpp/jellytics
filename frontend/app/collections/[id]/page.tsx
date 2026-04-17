"use client";

import { useParams } from "next/navigation";
import {
  useCollection,
  useRemoveFromCollection,
  useUpdateCollection,
} from "@/hooks/useCollections";
import { AppLayout, PageContent, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { FolderPlus, Film, Tv, Trash2, Pencil, Loader2 } from "lucide-react";
import Link from "next/link";
import { resolvePosterUrl, MEDIA_GRID_CLASS, cn, MEDIA_POSTER_CONTAINER } from "@/lib/utils";
import { PosterImage } from "@/components/ui/poster-image";
import { useState, useRef, useEffect } from "react";
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
    if (editOpen) {
      editNameInputRef.current?.focus();
    }
  }, [editOpen]);

  const breadcrumbItems = [
    { icon: "home" as const, href: "/dashboard" },
    { label: "Collections", href: "/collections" },
    { label: collection?.name ?? "" },
  ];

  if (isLoading || !collection) {
    return (
      <AppLayout>
        <PageContent>
          <PageHeader breadcrumb={breadcrumbItems} title="" />
          <div className={MEDIA_GRID_CLASS}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-2/3 w-full" />
            ))}
          </div>
        </PageContent>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <PageContent>
          <div className="text-center py-16">
            <FolderPlus className="h-16 w-16 text-white/20 mx-auto mb-4" />
            <p className="text-red-400 text-lg mb-2">Collection not found</p>
            <Link href="/collections">
              <Button variant="outline">Back to Collections</Button>
            </Link>
          </div>
        </PageContent>
      </AppLayout>
    );
  }

  const handleUpdate = () => {
    updateCollection.mutate({
      id,
      name: editName.trim() || undefined,
      description: editDesc.trim() || undefined,
    });
    setEditOpen(false);
  };

  return (
    <AppLayout>
      <PageContent>
        <PageHeader
          breadcrumb={breadcrumbItems}
          title={collection.name}
          description={
            collection.description
              ? `${collection.description} · ${collection.itemCount} ${collection.itemCount === 1 ? "item" : "items"}`
              : `${collection.itemCount} ${collection.itemCount === 1 ? "item" : "items"}`
          }
          actions={
            <Popover
              open={editOpen}
              onOpenChange={(o) => {
                setEditOpen(o);
                if (o) {
                  setEditName(collection.name);
                  setEditDesc(collection.description || "");
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Pencil className="h-3 w-3 mr-2" />
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
                      placeholder="Description"
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

        {collection.items.length === 0 ? (
          <div className="flex flex-col items-center py-24 gap-4">
            <FolderPlus className="h-12 w-12 text-white/20" />
            <p className="text-white/60">This collection is empty.</p>
            <p className="text-sm text-white/40">Add movies or shows from their detail pages.</p>
            <div className="flex gap-3">
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
            {collection.items.map((item) => (
              <CollectionItemCard
                key={`${item.itemType}-${item.itemId}`}
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
            ))}
          </div>
        )}
      </PageContent>
    </AppLayout>
  );
}

function CollectionItemCard({
  item,
  onRemove,
  isRemoving,
}: {
  item: {
    itemType: string;
    itemId: number;
    title?: string;
    posterUrl?: string;
  };
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const href = item.itemType === "show" ? `/shows/${item.itemId}` : `/movies/${item.itemId}`;
  const Icon = item.itemType === "show" ? Tv : Film;
  const posterSrc = item.posterUrl ? resolvePosterUrl(item.posterUrl) : undefined;

  return (
    <Link href={href} className="min-w-0 h-full flex flex-col group">
      <div className={cn(MEDIA_POSTER_CONTAINER, "hover:border-white/12 transition-all")}>
        <PosterImage
          src={posterSrc}
          alt={item.title || ""}
          type={item.itemType === "show" ? "show" : "movie"}
          sizes="(max-width: 640px) 50vw, 20vw"
          hoverScale
          iconSize="h-10 w-10"
          showLabel={false}
        />
        <div
          className="absolute top-2 right-2 z-10"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <ConfirmPopover
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Remove from collection?"
            description={
              <>
                <span className="text-white/70">&quot;{item.title || "this item"}&quot;</span> will
                be removed from this collection.
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
              className="h-8 w-8 rounded-lg bg-black/60 border border-white/20 text-white/80 hover:bg-red-500/30 hover:text-red-300 hover:border-red-500/50"
              aria-label="Remove from collection"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </ConfirmPopover>
        </div>
      </div>
      <div className="mt-3 min-w-0">
        <h3 className="font-medium text-white text-sm line-clamp-2 group-hover:text-purple-400 transition-colors">
          {item.title || "Untitled"}
        </h3>
        <span className="text-xs text-white/40 flex items-center gap-1 mt-1">
          <Icon className="h-3 w-3" />
          {item.itemType === "show" ? "Show" : "Movie"}
        </span>
      </div>
    </Link>
  );
}
