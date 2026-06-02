import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, X, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { MARKETPLACE_THEME, marketplaceStarStyle } from "@/lib/marketplaceTheme";
import {
  readFileAsDataUrl,
  submitProductReview,
  uploadReviewPhoto,
} from "@/lib/marketplaceReviewsApi";

interface Props {
  orderId: string;
  productId: string;
  productName: string;
  onSubmitted?: (aggregates?: { rating: number; reviewCount: number }) => void;
  onCancel?: () => void;
}

export default function ProductReviewForm({
  orderId,
  productId,
  productName,
  onSubmitted,
  onCancel,
}: Props) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || photos.length >= 3) return;
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploaded = await uploadReviewPhoto(dataUrl);
      if (!uploaded.ok || !uploaded.url) {
        toast.error(uploaded.error || "Photo upload failed");
        return;
      }
      setPhotos((prev) => [...prev, uploaded.url].slice(0, 3));
    } catch {
      toast.error("Could not upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (rating < 1) {
      toast.error("Please select a star rating");
      return;
    }
    setSubmitting(true);
    const result = await submitProductReview({
      order_id: orderId,
      product_id: productId,
      rating,
      comment: comment.trim() || undefined,
      photo_urls: photos.length > 0 ? photos : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error || "Could not submit review");
      return;
    }
    toast.success("Review submitted");
    onSubmitted?.(
      result.data
        ? { rating: result.data.rating, reviewCount: result.data.reviewCount }
        : undefined,
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Reviewing <span className="font-medium text-foreground">{productName}</span>
      </p>

      <div>
        <Label className="text-sm mb-2 block">Rating</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className="p-1"
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(value)}
              aria-label={`${value} stars`}
            >
              <Star
                className="h-6 w-6"
                style={marketplaceStarStyle(value <= (hoverRating || rating))}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="reviewComment" className="text-sm mb-2 block">
          Comment (optional)
        </Label>
        <Textarea
          id="reviewComment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Share your experience with this product…"
        />
      </div>

      <div>
        <Label className="text-sm mb-2 block">Photos (optional, max 3)</Label>
        <div className="flex flex-wrap gap-2 items-center">
          {photos.map((url, index) => (
            <div key={url} className="relative h-16 w-16 rounded-md overflow-hidden border">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white"
                onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <label className="h-16 w-16 rounded-md border border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/50">
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} disabled={uploading} />
            </label>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Skip
          </Button>
        )}
        <Button
          type="button"
          className="text-white"
          style={{ backgroundColor: MARKETPLACE_THEME.primary }}
          disabled={submitting || uploading}
          onClick={handleSubmit}
        >
          {submitting ? "Submitting…" : "Submit review"}
        </Button>
      </div>
    </div>
  );
}
