"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmPopover } from "@/components/ui/confirm-popover";
import { FieldLabel, INPUT_CLASS, TerminalButton } from "@/components/settings/SettingsPrimitives";
import { cn } from "@/lib/utils";
import { MessageSquare, Save, Edit2, Loader2, Trash2 } from "lucide-react";
import { Review } from "@/hooks/useReviews";

interface ReviewEditorProps {
  review: Review | null;
  onSave: (reviewText: string, notes?: string) => void;
  onDelete: () => void;
  isLoading?: boolean;
  isDeleting?: boolean;
}

/** Terminal-themed card header: muted icon + `# title` + fading rule, with an optional action slot. */
function ReviewHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <CardHeader>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-white/25">
            <MessageSquare className="h-4 w-4" />
          </span>
          <span className="shrink-0 select-none font-mono text-xs text-violet-400/55">#</span>
          <span className="truncate font-mono text-xs uppercase tracking-[0.15em] text-violet-300/70">
            {title}
          </span>
          {!action && (
            <div
              className="h-px min-w-4 flex-1"
              style={{ background: "linear-gradient(90deg, #16162a 60%, transparent)" }}
            />
          )}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </CardHeader>
  );
}

export function ReviewEditor({
  review,
  onSave,
  onDelete,
  isLoading,
  isDeleting = false,
}: ReviewEditorProps) {
  const [reviewText, setReviewText] = useState(review?.review_text || "");
  const [notes, setNotes] = useState(review?.notes || "");
  const [isEditing, setIsEditing] = useState(!review);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [prevReview, setPrevReview] = useState(review);
  if (prevReview !== review) {
    setPrevReview(review);
    if (review) {
      setReviewText(review.review_text || "");
      setNotes(review.notes || "");
      setIsEditing(false);
    }
  }

  const handleSave = () => {
    onSave(reviewText, notes);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (review) {
      setReviewText(review.review_text || "");
      setNotes(review.notes || "");
      setIsEditing(false);
    } else {
      setReviewText("");
      setNotes("");
    }
  };

  if (!isEditing && review) {
    return (
      <Card>
        <ReviewHeader
          title="your_review"
          action={
            <>
              <TerminalButton
                variant="idle"
                className="h-8 px-2.5"
                onClick={() => setIsEditing(true)}
                disabled={isLoading || isDeleting}
              >
                <Edit2 className="h-3.5 w-3.5" />
                edit
              </TerminalButton>
              <ConfirmPopover
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                theme="terminal"
                title="delete review?"
                description="Your review will be permanently removed. This cannot be undone."
                confirmLabel="delete"
                cancelLabel="cancel"
                confirmIcon={Trash2}
                variant="destructive"
                isLoading={isDeleting}
                onConfirm={() => {
                  onDelete();
                  setDeleteOpen(false);
                }}
              >
                <TerminalButton
                  variant="danger"
                  className="h-8 w-8 px-0"
                  disabled={isLoading || isDeleting}
                  aria-label="Delete review"
                >
                  <Trash2 className="h-4 w-4" />
                </TerminalButton>
              </ConfirmPopover>
            </>
          }
        />
        <CardContent className="space-y-4">
          {review.review_text && (
            <div>
              <FieldLabel className="mb-2 block">review</FieldLabel>
              <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-white/75">
                {review.review_text}
              </p>
            </div>
          )}
          {review.notes && (
            <div className="border-t border-[#16162a] pt-4">
              <FieldLabel className="mb-2 block">private_notes</FieldLabel>
              <p className="whitespace-pre-wrap font-mono text-sm text-white/55">{review.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <ReviewHeader title={review ? "edit_review" : "write_review"} />
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="review_text">
            <FieldLabel>review</FieldLabel>
          </label>
          <Textarea
            id="review_text"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="share your thoughts about this title..."
            className={cn(INPUT_CLASS, "min-h-[120px]")}
            rows={5}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="notes">
            <FieldLabel>private_notes</FieldLabel>
          </label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="add private notes (only visible to you)..."
            className={cn(INPUT_CLASS, "min-h-[100px]")}
            rows={4}
          />
          <p className="font-mono text-xs text-violet-300/45">
            <span className="select-none text-violet-400/40">{"# "}</span>
            notes are private and only visible to you
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <TerminalButton
            variant="primary"
            onClick={handleSave}
            disabled={isLoading || !reviewText.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                save_review
              </>
            )}
          </TerminalButton>
          {review && (
            <TerminalButton variant="idle" onClick={handleCancel} disabled={isLoading}>
              cancel
            </TerminalButton>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
