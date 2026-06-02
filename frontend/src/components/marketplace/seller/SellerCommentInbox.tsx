import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  fetchSellerProductComments,
  submitSellerCommentReply,
  type SellerCommentRow,
} from "@/lib/marketplaceReviewsApi";
import SellerInlineReplyForm from "@/components/marketplace/seller/SellerInlineReplyForm";

type Filter = "all" | "needs_reply" | "replied";

interface Props {
  userId: string;
  filter: Filter;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function CommentCard({ comment, onSaved }: { comment: SellerCommentRow; onSaved: () => void }) {
  const handleReply = async (body: string) => {
    const result = await submitSellerCommentReply(comment.id, body);
    if (!result.ok) {
      toast.error(result.error || "Could not save reply");
      return false;
    }
    toast.success(comment.seller_reply ? "Reply updated" : "Reply posted");
    onSaved();
    return true;
  };

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-card">
      <div className="flex items-start gap-3 flex-wrap">
        {comment.product_image && (
          <img src={comment.product_image} alt="" className="h-12 w-12 rounded-md object-cover border shrink-0" />
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/seller/products/${comment.product_id}`} className="font-medium text-foreground hover:underline">
              {comment.product_name || "Product"}
            </Link>
            {!comment.seller_reply && (
              <Badge variant="secondary" className="text-[10px]">Needs reply</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {comment.user_name || "Customer"} · {formatDate(comment.created_at)}
          </p>
        </div>
      </div>

      <p className="text-sm text-foreground leading-relaxed">{comment.body}</p>

      {comment.seller_reply && (
        <div className="rounded-md bg-muted/40 border-l-2 pl-3 py-2 ml-1" style={{ borderColor: "var(--marketplace-primary, #0d9488)" }}>
          <p className="text-xs font-medium text-muted-foreground mb-1">Your response</p>
          <p className="text-sm text-foreground">{comment.seller_reply.body}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{formatDate(comment.seller_reply.created_at)}</p>
        </div>
      )}

      <SellerInlineReplyForm
        initialValue={comment.seller_reply?.body || ""}
        submitLabel={comment.seller_reply ? "Update reply" : "Post reply"}
        onSubmit={handleReply}
      />
    </div>
  );
}

export default function SellerCommentInbox({ userId, filter }: Props) {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["seller-product-comments", userId, filter],
    queryFn: () => fetchSellerProductComments({ filter }),
  });

  const comments = data?.ok ? data.comments : [];
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["seller-product-comments", userId] });
    queryClient.invalidateQueries({ queryKey: ["product-comments"] });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading questions…</p>;
  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {filter === "needs_reply" ? "No questions waiting for a reply." : "No product questions yet."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <CommentCard key={comment.id} comment={comment} onSaved={invalidate} />
      ))}
      {isFetching && <p className="text-xs text-muted-foreground text-center">Refreshing…</p>}
    </div>
  );
}

export function useSellerCommentStats(userId: string) {
  return useQuery({
    queryKey: ["seller-product-comments", userId, "all"],
    queryFn: () => fetchSellerProductComments({ filter: "all" }),
    select: (d) => (d.ok ? d.stats : null),
  });
}
