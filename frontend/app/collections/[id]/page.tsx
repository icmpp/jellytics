"use client";

import { useState, useRef, useEffect, type MouseEvent } from "react";
import { useParams } from "next/navigation";
import {
  useCollection,
  useRemoveFromCollection,
  useUpdateCollection,
  type CollectionItem,
} from "@/hooks/useCollections";
import { SimpleMediaGridPage, EmptyTerminal, TerminalAction } from "@/components/media";
import { FolderOpen, Film, Tv, Trash2, Pencil, Loader2 } from "lucide-react";
import Link from "next/link";
import { resolvePosterUrl, cn } from "@/lib/utils";
import { PosterImage } from "@/components/ui/poster-image";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
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

  const handleUpdate = () => {
    updateCollection.mutate(
      { id, name: editName.trim() || undefined, description: editDesc.trim() || undefined },
      { onSuccess: () => setEditOpen(false) },
    );
  };

  const itemCount = collection?.itemCount ?? 0;
  const itemCountLabel = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  const description = collection
    ? collection.description
      ? `${collection.description} · ${itemCountLabel}`
      : itemCountLabel
    : "";

  const items = collection?.items ?? [];
  const notFound = !isLoading && (!!error || !collection);

  const actions = collection ? (
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
        <button
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-sm border px-3.5 font-mono text-xs transition-colors",
            editOpen
              ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
              : "border-[#16162a] bg-[#0a0a14] text-white/60 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300",
          )}
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          edit
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-sm border-[#16162a] bg-[#07070d] p-0 font-mono shadow-[0_8px_40px_-8px_rgba(0,0,0,0.6)]"
      >
        <EditCollectionForm
          nameRef={editNameInputRef}
          name={editName}
          desc={editDesc}
          onNameChange={setEditName}
          onDescChange={setEditDesc}
          onSubmit={handleUpdate}
          isPending={updateCollection.isPending}
        />
      </PopoverContent>
    </Popover>
  ) : undefined;

  return (
    <SimpleMediaGridPage<CollectionItem>
      breadcrumb={breadcrumbItems}
      title={collection?.name ?? ""}
      description={description}
      actions={actions}
      isLoading={isLoading}
      isError={notFound}
      errorContent={
        <div className="flex flex-col items-center py-20 text-center font-mono">
          <FolderOpen className="mb-5 h-10 w-10 text-violet-400/30" />
          <p className="mb-1.5 text-base text-white/70">
            <span className="select-none text-red-400/70">{"! "}</span>collection not found
          </p>
          <p className="mb-5 text-xs text-violet-300/45">
            <span className="select-none text-violet-400/45">{"# "}</span>it may have been deleted
            or doesn&apos;t exist
          </p>
          <TerminalAction href="/collections" icon={FolderOpen} label="back_to_collections" />
        </div>
      }
      isEmpty={!!collection && items.length === 0}
      emptyContent={
        <EmptyTerminal
          path={`collections/${collection?.name ?? ""}`}
          statusLabel="empty"
          command={
            <>
              collection <span className="text-violet-300/70">--items</span>
            </>
          }
          output={
            <>
              query returned <span className="tabular-nums text-white/70">0</span> items
            </>
          }
          icon={FolderOpen}
          headline="this collection is empty"
          subtext="add movies or shows from their detail pages to start filling it up"
          actions={
            <>
              <TerminalAction href="/movies" icon={Film} label="browse_movies" />
              <TerminalAction href="/shows" icon={Tv} label="browse_shows" />
            </>
          }
        />
      }
      items={items}
      renderCard={(item, index) => (
        <CollectionItemCard
          item={item}
          index={index}
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
      )}
      getItemKey={(item) => `${item.itemType}-${item.itemId}`}
    />
  );
}

/** Terminal-styled edit form rendered inside the header popover. */
function EditCollectionForm({
  nameRef,
  name,
  desc,
  onNameChange,
  onDescChange,
  onSubmit,
  isPending,
}: {
  nameRef: React.RefObject<HTMLInputElement | null>;
  name: string;
  desc: string;
  onNameChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <>
      {/* Terminal window chrome */}
      <div
        className="flex items-center gap-2.5 border-b border-[#16162a] px-3.5 py-2"
        style={{ background: "#06060d" }}
      >
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[#ef4444]/70" />
          <div className="h-2 w-2 rounded-full bg-[#f59e0b]/70" />
          <div className="h-2 w-2 rounded-full bg-[#22c55e]/70" />
        </div>
        <span className="text-xs text-violet-400/70">
          <span className="select-none text-white/30">{"# "}</span>edit collection
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-3.5 px-4 py-3.5"
        aria-label="Edit collection"
      >
        <div>
          <label htmlFor="edit-name" className="text-[11px] text-violet-300/55">
            <span className="select-none text-violet-400/45">{"# "}</span>name
          </label>
          <Input
            ref={nameRef}
            id="edit-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="collection name"
            className="mt-1.5 h-10 rounded-sm border-[#16162a] bg-[#0a0a14] font-mono text-sm focus:border-violet-500/50 focus:bg-[#0d0d1a] focus:ring-violet-500/20"
          />
        </div>
        <div>
          <label htmlFor="edit-desc" className="text-[11px] text-violet-300/55">
            <span className="select-none text-violet-400/45">{"# "}</span>description (optional)
          </label>
          <Textarea
            id="edit-desc"
            value={desc}
            onChange={(e) => onDescChange(e.target.value)}
            placeholder="a short description..."
            rows={2}
            className="mt-1.5 rounded-sm border-[#16162a] bg-[#0a0a14] font-mono text-sm focus:border-violet-500/50 focus:bg-[#0d0d1a] focus:ring-violet-500/20"
          />
        </div>
        <button
          type="submit"
          disabled={!name.trim() || isPending}
          className={cn(
            "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-sm border text-xs lowercase transition-colors disabled:opacity-50",
            "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15",
          )}
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              saving…
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" />
              save
            </>
          )}
        </button>
      </form>
    </>
  );
}

const ABOVE_THE_FOLD_COUNT = 8;

function CollectionItemCard({
  item,
  index = 0,
  onRemove,
  isRemoving,
}: {
  item: CollectionItem;
  index?: number;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isShow = item.itemType === "show";
  const href = isShow ? `/shows/${item.itemId}` : `/movies/${item.itemId}`;
  const posterSrc = item.posterUrl ? resolvePosterUrl(item.posterUrl) : undefined;

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      href={href}
      aria-label={`View details for ${item.title || "Untitled"}`}
      className="block min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* terminal border lights up violet on hover */}
      <div
        className={cn(
          "group relative rounded-sm border border-[#16162a] bg-[#07070d] p-px",
          "transition-colors duration-300 hover:border-violet-500/40",
          "shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5),0_1px_4px_-1px_rgba(0,0,0,0.35)]",
          "hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6),0_0_0_1px_rgba(139,92,246,0.25)]",
        )}
      >
        <div className="relative isolate aspect-2/3 w-full cursor-pointer overflow-hidden rounded-[2px] bg-zinc-950">
          {/* Poster */}
          <PosterImage
            src={posterSrc}
            alt={item.title || ""}
            type={isShow ? "show" : "movie"}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            iconSize="h-10 w-10"
            showLabel={false}
            priority={index < ABOVE_THE_FOLD_COUNT}
          />

          {/* Bottom gradient */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/90 via-black/35 to-black/10"
          />

          {/* Type badge — top left */}
          <span
            aria-label={isShow ? "TV show" : "Movie"}
            className={cn(
              "absolute left-2 top-2 z-10",
              "flex h-7 w-7 items-center justify-center rounded-sm",
              "bg-black/60 ring-1 ring-[#16162a] backdrop-blur-md",
            )}
          >
            {isShow ? (
              <Tv className="h-3.5 w-3.5 text-violet-300/70" />
            ) : (
              <Film className="h-3.5 w-3.5 text-violet-300/70" />
            )}
          </span>

          {/* Remove button — top right, always visible */}
          <div className="absolute right-2 top-2 z-10" onClick={stop}>
            <ConfirmPopover
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              theme="terminal"
              title="Remove from collection?"
              description={
                <>
                  <span className="text-white/70">&quot;{item.title || "This item"}&quot;</span>{" "}
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
              <button
                type="button"
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-sm backdrop-blur-md",
                  "bg-black/60 text-white/60 ring-1 ring-[#16162a]",
                  "transition-all duration-150 hover:bg-red-500/20 hover:text-red-300 hover:ring-red-500/40",
                )}
                aria-label="Remove from collection"
              >
                {isRemoving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </ConfirmPopover>
          </div>

          {/* Bottom info zone — title overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 px-3 pb-3 pt-10">
            <h3
              className={cn(
                "line-clamp-2 font-mono text-[0.8125rem] font-semibold leading-snug tracking-tight text-white",
                "transition-colors duration-200 group-hover:text-violet-300",
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
