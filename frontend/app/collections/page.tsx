"use client";

import { useState, useRef, useEffect, type MouseEvent } from "react";
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  type Collection,
} from "@/hooks/useCollections";
import { SimpleMediaGridPage, EmptyTerminal, TerminalAction } from "@/components/media";
import { CollectionsGridSkeleton } from "@/components/ui/collections-grid-skeleton";
import { FolderOpen, FolderPlus, Trash2, Loader2, Clock } from "lucide-react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmPopover } from "@/components/ui/confirm-popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, COLLECTIONS_GRID_CLASS } from "@/lib/utils";

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

  const total = collections.length;

  const actions = (
    <Popover open={createOpen} onOpenChange={setCreateOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-sm border px-3.5 font-mono text-xs transition-colors",
            createOpen
              ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
              : "border-[#16162a] bg-[#0a0a14] text-white/60 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300",
          )}
        >
          <FolderPlus className="h-3.5 w-3.5 shrink-0" />
          new_collection
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-sm border-[#16162a] bg-[#07070d] p-0 font-mono shadow-[0_8px_40px_-8px_rgba(0,0,0,0.6)]"
      >
        <CreateCollectionForm
          nameRef={createNameInputRef}
          name={newName}
          desc={newDesc}
          onNameChange={setNewName}
          onDescChange={setNewDesc}
          onSubmit={handleCreate}
          isPending={createCollection.isPending}
        />
      </PopoverContent>
    </Popover>
  );

  return (
    <SimpleMediaGridPage<Collection>
      breadcrumb={breadcrumbItems}
      title="Collections"
      description={
        total > 0
          ? `${total.toLocaleString()} ${total === 1 ? "collection" : "collections"} organized`
          : "organize your movies and shows into custom collections"
      }
      actions={actions}
      isLoading={isLoading}
      isError={isError}
      errorContent={
        <div className="flex flex-col items-center py-20 text-center font-mono">
          <FolderPlus className="mb-5 h-10 w-10 text-violet-400/30" />
          <p className="mb-1.5 text-base text-white/70">
            <span className="select-none text-red-400/70">{"! "}</span>failed to load collections
          </p>
          <p className="mb-5 text-xs text-violet-300/45">
            <span className="select-none text-violet-400/45">{"# "}</span>something went wrong,
            please try again
          </p>
          <TerminalAction label="retry" onClick={() => refetch()} />
        </div>
      }
      isEmpty={collections.length === 0}
      emptyContent={
        <EmptyTerminal
          path="collections"
          statusLabel="empty"
          command={
            <>
              collections <span className="text-violet-300/70">--list</span>
            </>
          }
          output={
            <>
              query returned <span className="tabular-nums text-white/70">0</span> collections
            </>
          }
          icon={FolderOpen}
          headline="no collections yet"
          subtext="group your movies and shows into custom collections, then add items from any detail page"
          actions={
            <TerminalAction
              icon={FolderPlus}
              label="new_collection"
              variant="primary"
              onClick={() => setCreateOpen(true)}
            />
          }
        />
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

/** Terminal-styled create form, shared by the header popover. */
function CreateCollectionForm({
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
  onSubmit: (e?: React.FormEvent) => void;
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
          <span className="select-none text-white/30">{"# "}</span>new collection
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(e);
        }}
        className="space-y-3.5 px-4 py-3.5"
        role="form"
        aria-label="Create collection"
      >
        <div>
          <label htmlFor="collection-name" className="text-[11px] text-violet-300/55">
            <span className="select-none text-violet-400/45">{"# "}</span>name
          </label>
          <Input
            ref={nameRef}
            id="collection-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. sci-fi favorites"
            className="mt-1.5 h-10 rounded-sm border-[#16162a] bg-[#0a0a14] font-mono text-sm focus:border-violet-500/50 focus:bg-[#0d0d1a] focus:ring-violet-500/20"
          />
        </div>
        <div>
          <label htmlFor="collection-desc" className="text-[11px] text-violet-300/55">
            <span className="select-none text-violet-400/45">{"# "}</span>description (optional)
          </label>
          <Textarea
            id="collection-desc"
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
              creating…
            </>
          ) : (
            <>
              <FolderPlus className="h-3.5 w-3.5" />
              create
            </>
          )}
        </button>
      </form>
    </>
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
      className="group block min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div
        className={cn(
          "relative flex items-start gap-3.5 rounded-sm border border-[#16162a] bg-[#0a0a14] p-4 font-mono",
          "transition-colors duration-200 hover:border-violet-500/30 hover:bg-[#0d0d1a]",
        )}
      >
        {/* Folder icon tile — mirrors the EmptyTerminal glyph tile */}
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-violet-500/15 bg-violet-500/5">
          <FolderOpen className="h-5 w-5 text-violet-400/60 transition-colors duration-200 group-hover:text-violet-400 phosphor-glow" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 pr-6">
          <h3 className="flex items-center gap-1.5 truncate text-sm font-semibold leading-snug text-white/90 transition-colors duration-200 group-hover:text-violet-300">
            <span
              aria-hidden
              className="select-none text-violet-400/50 transition-colors group-hover:text-violet-400/80"
            >
              {">"}
            </span>
            <span className="truncate">{collection.name}</span>
          </h3>

          {collection.description ? (
            <p className="mt-1 line-clamp-2 pl-[1.1rem] text-xs leading-relaxed text-white/45">
              {collection.description}
            </p>
          ) : (
            <p className="mt-1 pl-[1.1rem] text-xs text-white/25">
              <span className="select-none text-violet-400/30">{"# "}</span>no description
            </p>
          )}

          <div className="mt-2.5 flex items-center gap-2 pl-[1.1rem]">
            <span className="inline-flex items-center gap-1 rounded-sm border border-[#16162a] bg-[#07070d] px-2 py-0.5 text-[10px] tabular-nums text-violet-300/70">
              {collection.itemCount}{" "}
              <span className="text-white/35">{collection.itemCount === 1 ? "item" : "items"}</span>
            </span>
            {collection.createdAt && (
              <span className="flex items-center gap-1 text-[10px] text-white/25">
                <Clock className="h-3 w-3 shrink-0" />
                {formatCollectionDate(collection.createdAt)}
              </span>
            )}
          </div>
        </div>

        {/* Delete button — top right, revealed on hover */}
        <div
          className="absolute right-3 top-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          onClick={stop}
        >
          <ConfirmPopover
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            theme="terminal"
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
            <button
              type="button"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-sm backdrop-blur-md",
                "bg-[#07070d] text-white/50 ring-1 ring-[#16162a]",
                "transition-all duration-150 hover:bg-red-500/20 hover:text-red-300 hover:ring-red-500/40",
              )}
              aria-label="Delete collection"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </ConfirmPopover>
        </div>
      </div>
    </Link>
  );
}
