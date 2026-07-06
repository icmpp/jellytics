"use client";

import { Tag, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SettingsCardHeader, INPUT_CLASS, TerminalButton } from "./SettingsPrimitives";

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
    <Card className="flex h-full flex-col">
      <SettingsCardHeader
        icon={<Tag className="h-5 w-5" />}
        title="tags"
        description="Organize movies and shows with custom tags. Add them from detail pages, filter on library pages."
      />
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
            className={`flex-1 ${INPUT_CLASS}`}
          />
          <TerminalButton
            onClick={handleCreate}
            disabled={!newTagName.trim() || createTag.isPending}
          >
            {createTag.isPending ? <Loader2 className="animate-spin" /> : "add_tag"}
          </TerminalButton>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-sm border border-[#16162a] min-h-0">
          <div className="flex shrink-0 items-center justify-between border-b border-[#16162a] bg-[#0a0a14] px-3.5 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-violet-300/55">
              <span className="select-none text-violet-400/40">{"// "}</span>
              {tags.length} {tags.length === 1 ? "tag" : "tags"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto bg-[#06060d] p-3.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 content-start">
                {tags.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-xs"
                    style={{
                      backgroundColor: `${t.color}1a`,
                      borderColor: `${t.color}50`,
                      color: t.color,
                    }}
                  >
                    <span className="select-none opacity-60">#</span>
                    {t.name}
                    <button
                      type="button"
                      onClick={() => deleteTag.mutate(t.id)}
                      disabled={deleteTag.isPending}
                      className="rounded-sm p-0.5 hover:opacity-70"
                      aria-label={`Delete ${t.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[60px] flex-col items-center justify-center gap-2">
                <Tag className="h-4 w-4 text-white/15" />
                <p className="font-mono text-xs text-white/25">
                  <span className="select-none text-violet-400/40">{"# "}</span>no tags yet — add
                  one above
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
