import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  fetchSellerReviews,
  mapSellerReview,
  submitSellerReviewReply,
  type SellerReviewRow,
} from "@/lib/marketplaceReviewsApi";
import {
  fetchOfficialShopReviews,
  submitOfficialShopReviewReply,
} from "@/lib/adminFarmBondhuShopApi";
import { marketplaceStarStyle } from "@/lib/marketplaceTheme";
import SellerInlineReplyForm from "@/components/marketplace/seller/SellerInlineReplyForm";

type Filter = "all" | "needs_reply" | "replied";

interface Props {
  userId: string;
  filter: Filter;
  apiMode?: "seller" | "official";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ReviewCard({
  review,
  onSaved,
  apiMode = "seller",
}: {
  review: SellerReviewRow;
  onSaved: () => void;
  apiMode?: "seller" | "official";
}) {
  const productPath =
    apiMode === "official"
      ? `/admin/farmbondhu-shop/products/${review.product_id}`
      : `/seller/products/${review.product_id}`;

  const handleReply = async (reply: string) => {
    if (apiMode === "official") {
      try {
        await submitOfficialShopReviewReply(review.id, reply);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save reply");
        return false;
      }
    } else {
      const result = await submitSellerReviewReply(review.id, reply);
      if (!result.ok) {
        toast.error(result.error || "Could not save reply");
        return false;
      }
    }
    toast.success(review.seller_reply ? "Reply updated" : "Reply posted");
    onSaved();
    return true;
  };

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-card">
      <div className="flex items-start gap-3 flex-wrap">
        {review.product_image && (
          <img src={review.product_image} alt="" className="h-12 w-12 rounded-md object-cover border shrink-0" />
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={productPath} className="font-medium text-foreground hover:underline">
              {review.product_name || "Product"}
            </Link>
            {!review.seller_reply && (
              <Badge variant="secondary" className="text-[10px]">Needs reply</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {review.buyer_name || "Buyer"} · Order #{review.order_id.slice(0, 10).toUpperCase()} · {formatDate(review.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5" style={marketplaceStarStyle(i < review.rating)} />
          ))}
        </div>
      </div>

      {review.comment && <p className="text-sm text-foreground leading-relaxed">{review.comment}</p>}

      {review.photo_urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.photo_urls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt="" className="h-16 w-16 rounded-md object-cover border" />
            </a>
          ))}
        </div>
      )}

      {review.seller_reply && (
        <div className="rounded-md bg-muted/40 border-l-2 pl-3 py-2 ml-1" style={{ borderColor: "var(--marketplace-primary, #0d9488)" }}>
          <p className="text-xs font-medium text-muted-foreground mb-1">Your response</p>
          <p className="text-sm text-foreground">{review.seller_reply}</p>
          {review.seller_reply_at && (
            <p className="text-[11px] text-muted-foreground mt-1">{formatDate(review.seller_reply_at)}</p>
          )}
        </div>
      )}

      <SellerInlineReplyForm
        initialValue={review.seller_reply || ""}
        submitLabel={review.seller_reply ? "Update reply" : "Post reply"}
        onSubmit={handleReply}
      />
    </div>
  );
}

async function loadReviews(filter: Filter, apiMode: "seller" | "official") {
  if (apiMode === "official") {
    const data = await fetchOfficialShopReviews({ filter });
    return {
      ok: true as const,
      reviews: (data.reviews || []).map((row) => mapSellerReview(row)),
      page: data.page,
      total: data.total,
      stats: data.stats,
    };
  }
  return fetchSellerReviews({ filter });
}

export default function SellerReviewInbox({ userId, filter, apiMode = "seller" }: Props) {
  const queryClient = useQueryClient();
  const queryKeyPrefix = apiMode === "official" ? "admin-official-shop-reviews" : "seller-reviews";
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [queryKeyPrefix, userId, filter],
    queryFn: () => loadReviews(filter, apiMode),
  });

  const reviews = data?.ok ? data.reviews : [];
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, userId] });
    queryClient.invalidateQueries({ queryKey: ["product-reviews"] });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading reviews…</p>;
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {filter === "needs_reply" ? "No reviews waiting for a reply." : "No verified reviews yet."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} onSaved={invalidate} apiMode={apiMode} />
      ))}
      {isFetching && <p className="text-xs text-muted-foreground text-center">Refreshing…</p>}
    </div>
  );
}

export function useSellerReviewStats(userId: string, apiMode: "seller" | "official" = "seller") {
  const queryKeyPrefix = apiMode === "official" ? "admin-official-shop-reviews" : "seller-reviews";
  return useQuery({
    queryKey: [queryKeyPrefix, userId, "all"],
    queryFn: () => loadReviews("all", apiMode),
    select: (d) => (d.ok ? d.stats : null),
  });
}
