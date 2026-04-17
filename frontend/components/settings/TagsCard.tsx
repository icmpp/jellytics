"use client";

import { Tag, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TagItem {
  id: number;
  name: string;
  color: string;
}

interface CreateTagMutation {
  mutate: (data: { name: string }, options?: { onSuccess?: () => void }) => void;
  isPending: boolean;
}

interface DeleteTagMutation {
  mutate: (id: number) => void;
  isPending: boolean;
}

interface Props {
  tags: TagItem[];
  createTag: CreateTagMutation;
  deleteTag: DeleteTagMutation;
  newTagName: string;
  setNewTagName: (name: string) => void;
}

export function TagsCard({ tags, createTag, deleteTag, newTagName, setNewTagName }: Props) {
  const handleCreate = () => {
    if (newTagName.trim()) {
      createTag.mutate({ name: newTagName.trim() }, { onSuccess: () => setNewTagName("") });
    }
  };

  return (
    <Card className="relative overflow-hidden h-full flex flex-col">
      <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-3xl opacity-15 bg-purple-500" />
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Tag className="h-5 w-5 text-purple-400" />
          Tags
        </CardTitle>
        <CardDescription>
          Organize movies and shows with custom tags. Add them from detail pages, filter on library
          pages.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-4 min-h-0">
        <div className="flex gap-2 shrink-0">
          <Input
            placeholder="New tag name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            className="flex-1"
          />
          <Button onClick={handleCreate} disabled={!newTagName.trim() || createTag.isPending}>
            {createTag.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Tag"}
          </Button>
        </div>

        <div className="rounded-xl border border-white/6 overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/5 bg-white/2 shrink-0">
            <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
              {tags.length} {tags.length === 1 ? "Tag" : "Tags"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3.5 bg-white/1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 content-start">
                {tags.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                    style={{
                      backgroundColor: `${t.color}20`,
                      borderColor: `${t.color}50`,
                      color: t.color,
                    }}
                  >
                    {t.name}
                    <button
                      type="button"
                      onClick={() => deleteTag.mutate(t.id)}
                      disabled={deleteTag.isPending}
                      className="hover:opacity-70 rounded p-0.5"
                      aria-label={`Delete ${t.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[60px]">
                <Tag className="h-4 w-4 text-white/15" />
                <p className="text-xs text-white/25">No tags yet — add one above</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
