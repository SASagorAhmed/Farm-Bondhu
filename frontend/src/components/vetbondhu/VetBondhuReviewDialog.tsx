import { type CSSProperties, useState } from "react";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ICON_COLORS } from "@/lib/iconColors";
import { submitVetBondhuReview } from "@/lib/vetbondhuReviewsApi";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  vetName?: string | null;
  animalType?: string | null;
  onSubmitted?: () => void;
};

const VB = ICON_COLORS.vetbondhu;

export default function VetBondhuReviewDialog({
  open,
  onOpenChange,
  bookingId,
  vetName,
  animalType,
  onSubmitted,
}: Props) {
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await submitVetBondhuReview({ bookingId, rating, comment });
      toast({ title: "Review submitted", description: "Thank you for reviewing your VetBondhu doctor." });
      setComment("");
      setRating(5);
      onOpenChange(false);
      onSubmitted?.();
    } catch (err) {
      toast({
        title: "Could not submit review",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Review doctor</DialogTitle>
          <DialogDescription>
            Share your experience with {vetName || "your VetBondhu doctor"}
            {animalType ? ` for ${animalType}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Rating</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className="rounded-md p-1 transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{ "--tw-ring-color": VB } as CSSProperties}
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                >
                  <Star
                    className="h-7 w-7"
                    style={{
                      color: VB,
                      fill: value <= rating ? VB : "transparent",
                      opacity: value <= rating ? 1 : 0.45,
                    }}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">{rating}/5</span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Comment optional</p>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
              placeholder="Write a short note about the consultation..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting} className="text-white" style={{ backgroundColor: VB }}>
              {submitting ? "Submitting..." : "Submit review"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
