"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmPopover } from "@/components/ui/confirm-popover";
import { MessageSquare, Save, Edit2, Loader2, Trash2 } from "lucide-react";
import { Review } from "@/hooks/useReviews";

interface ReviewEditorProps {
  review: Review | null;
  onSave: (reviewText: string, notes?: string) => void;
  onDelete: () => void;
  isLoading?: boolean;
  isDeleting?: boolean;
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
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-400" />
              Your Review
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                disabled={isLoading || isDeleting}
              >
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
              <ConfirmPopover
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Delete review?"
                description="Your review will be permanently removed. This cannot be undone."
                confirmLabel="Delete"
                cancelLabel="Cancel"
                confirmIcon={Trash2}
                variant="destructive"
                isLoading={isDeleting}
                onConfirm={() => {
                  onDelete();
                  setDeleteOpen(false);
                }}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white/40 hover:text-red-400 hover:bg-red-500/10"
                  disabled={isLoading || isDeleting}
                  aria-label="Delete review"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </ConfirmPopover>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {review.review_text && (
            <div>
              <Label className="text-white/40 text-sm mb-2 block">Review</Label>
              <p className="text-white/80 whitespace-pre-wrap leading-relaxed">
                {review.review_text}
              </p>
            </div>
          )}
          {review.notes && (
            <div className="pt-4 border-t border-white/8">
              <Label className="text-white/40 text-sm mb-2 block">Private Notes</Label>
              <p className="text-white/60 text-sm whitespace-pre-wrap">{review.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-400" />
          {review ? "Edit Review" : "Write a Review"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="review_text" className="text-white/60">
            Review
          </Label>
          <Textarea
            id="review_text"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Share your thoughts about this show/movie..."
            className="min-h-[120px]"
            rows={5}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes" className="text-white/60">
            Private Notes
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add private notes (only visible to you)..."
            className="min-h-[100px]"
            rows={4}
          />
          <p className="text-xs text-white/30">Notes are private and only visible to you</p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={isLoading || !reviewText.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Review
              </>
            )}
          </Button>
          {review && (
            <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
