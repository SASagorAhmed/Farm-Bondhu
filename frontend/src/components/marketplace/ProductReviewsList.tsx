import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, ShieldCheck, Store } from "lucide-react";
import { fetchPendingReviewables, fetchProductReviews, submitSellerReviewReply, type PendingReviewable } from "@/lib/marketplaceReviewsApi";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import ProductReviewDialog from "@/components/marketplace/ProductReviewDialog";
import { MARKETPLACE_THEME, marketplaceStarStyle } from "@/lib/marketplaceTheme";
import SellerInlineReplyForm from "@/components/marketplace/seller/SellerInlineReplyForm";
import { toast } from "sonner";

interface Props {
  productId: string;
  averageRating?: number;
  reviewCount?: number;
  isProductOwner?: boolean;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ProductReviewsList({
  productId,
  averageRating = 0,
  reviewCount = 0,
  isProductOwner = false,
}: Props) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [reviewTarget, setReviewTarget] = useState<PendingReviewable | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["product-reviews", productId, page],
    queryFn: () => fetchProductReviews(productId, page),
  });

  const { data: pendingData } = useQuery({
    queryKey: ["pending-reviewables", productId],
    enabled: isAuthenticated && !isProductOwner,
    queryFn: () => fetchPendingReviewables(productId),
  });

  const pendingItems = pendingData?.ok ? pendingData.items : [];
  const reviews = data?.ok ? data.reviews : [];
  const total = data?.ok ? data.total : reviewCount;
  const average = data?.ok ? data.averageRating : averageRating;
  const hasMore = reviews.length > 0 && page * 20 < total;

  const invalidateReviews = () => {
    queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
    queryClient.invalidateQueries({ queryKey: ["seller-reviews"] });
  };

  const handleSellerReply = async (reviewId: string, reply: string) => {
    const result = await submitSellerReviewReply(reviewId, reply);
    if (!result.ok) {
      toast.error(result.error || "Could not save reply");
      return false;
    }
    toast.success("Reply saved");
    invalidateReviews();
    return true;
  };

  return (
    <div className="space-y-4">
      {isProductOwner && (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground bg-muted/20">
          You are viewing your product — reply to verified customer reviews below. Buyers will see your responses publicly.
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Star className="h-5 w-5" style={marketplaceStarStyle(true)} />
          <span className="text-lg font-semibold text-foreground">{Number(average).toFixed(1)}</span>
        </div>
        <span className="text-sm text-muted-foreground">{total} verified review{total === 1 ? "" : "s"}</span>
      </div>

      {isAuthenticated && !isProductOwner ? (
        pendingItems.length > 0 && (
          <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
            <p className="text-sm font-medium text-foreground">Review your purchase</p>
            <div className="space-y-2">
              {pendingItems.map((item) => (
                <div
                  key={`${item.orderId}:${item.productId}`}
                  className="flex items-center justify-between gap-3 flex-wrap text-sm"
                >
                  <div>
                    <p className="text-foreground">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      Order #{item.orderId.slice(0, 10).toUpperCase()}
                      {item.orderDate ? ` · ${formatDate(item.orderDate)}` : ""}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setReviewTarget(item)}>
                    <Star className="h-3.5 w-3.5" /> Write review
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )
      ) : !isAuthenticated ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <button
            type="button"
            className="font-medium underline"
            style={{ color: MARKETPLACE_THEME.primary }}
            onClick={() => navigate("/login")}
          >
            Log in
          </button>{" "}
          to review a verified purchase of this product.
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No verified reviews yet. Reviews appear after delivery.</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-medium text-foreground text-sm">{review.buyer_name || "Buyer"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(review.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5" style={marketplaceStarStyle(i < review.rating)} />
                    ))}
                  </div>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <ShieldCheck className="h-3 w-3" /> Verified purchase
                  </Badge>
                </div>
              </div>
              {review.comment && <p className="text-sm text-foreground leading-relaxed">{review.comment}</p>}
              {review.photo_urls.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {review.photo_urls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                      <img src={url} alt="" className="h-20 w-20 rounded-md object-cover border" />
                    </a>
                  ))}
                </div>
              )}

              {review.seller_reply && (
                <div className="rounded-md bg-muted/40 border-l-2 pl-3 py-2 ml-1 mt-2" style={{ borderColor: MARKETPLACE_THEME.primary }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Store className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-foreground">Response from seller</p>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{review.seller_reply}</p>
                  {review.seller_reply_at && (
                    <p className="text-[11px] text-muted-foreground mt-1">{formatDate(review.seller_reply_at)}</p>
                  )}
                </div>
              )}

              {isProductOwner && (
                <SellerInlineReplyForm
                  initialValue={review.seller_reply || ""}
                  submitLabel={review.seller_reply ? "Update reply" : "Post reply"}
                  editLabel="Reply as seller"
                  compact
                  onSubmit={(text) => handleSellerReply(review.id, text)}
                />
              )}
            </div>
          ))}
          {hasMore && (
            <Button variant="outline" size="sm" disabled={isFetching} onClick={() => setPage((p) => p + 1)}>
              {isFetching ? "Loading…" : "Load more reviews"}
            </Button>
          )}
        </div>
      )}

      {reviewTarget && (
        <ProductReviewDialog
          open={Boolean(reviewTarget)}
          onOpenChange={(open) => !open && setReviewTarget(null)}
          orderId={reviewTarget.orderId}
          productId={reviewTarget.productId}
          productName={reviewTarget.productName}
        />
      )}
    </div>
  );
}
