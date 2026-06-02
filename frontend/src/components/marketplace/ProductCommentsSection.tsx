import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import {
  fetchProductComments,
  submitProductComment,
  submitSellerCommentReply,
} from "@/lib/marketplaceReviewsApi";
import SellerInlineReplyForm from "@/components/marketplace/seller/SellerInlineReplyForm";

interface Props {
  productId: string;
  isProductOwner?: boolean;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ProductCommentsSection({ productId, isProductOwner = false }: Props) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["product-comments", productId, page],
    queryFn: () => fetchProductComments(productId, page),
  });

  const comments = data?.ok ? data.comments : [];
  const total = data?.ok ? data.total : 0;
  const hasMore = comments.length > 0 && page * 20 < total;

  const invalidateComments = () => {
    queryClient.invalidateQueries({ queryKey: ["product-comments", productId] });
    queryClient.invalidateQueries({ queryKey: ["seller-product-comments"] });
  };

  const handleSubmit = async () => {
    const text = body.trim();
    if (!text) {
      toast.error("Write a comment first");
      return;
    }
    setSubmitting(true);
    const result = await submitProductComment(productId, text);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error || "Could not post comment");
      return;
    }
    setBody("");
    toast.success("Comment posted");
    setPage(1);
    invalidateComments();
  };

  const handleSellerReply = async (commentId: string, reply: string) => {
    const result = await submitSellerCommentReply(commentId, reply);
    if (!result.ok) {
      toast.error(result.error || "Could not save reply");
      return false;
    }
    toast.success("Reply saved");
    invalidateComments();
    return true;
  };

  return (
    <div className="space-y-4">
      {isProductOwner && (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground bg-muted/20">
          You are viewing your product — answer customer questions below. Buyers ask here; you reply as the seller.
        </div>
      )}

      {isAuthenticated && !isProductOwner ? (
        <div className="space-y-2 rounded-lg border p-4 bg-muted/20">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Ask a question or share a comment about this product…"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="text-white"
              style={{ backgroundColor: MARKETPLACE_THEME.primary }}
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </div>
      ) : !isAuthenticated ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <button type="button" className="font-medium text-primary underline" onClick={() => navigate("/login")}>
            Log in
          </button>{" "}
          to post a comment about this product.
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Be the first to ask or share feedback.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                  {(comment.user_name || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{comment.user_name || "User"}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(comment.created_at)}</p>
                </div>
              </div>
              <p className="text-sm text-foreground leading-relaxed pl-10">{comment.body}</p>

              {comment.seller_reply && (
                <div className="ml-10 rounded-md bg-muted/40 border-l-2 pl-3 py-2" style={{ borderColor: MARKETPLACE_THEME.primary }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Store className="h-3.5 w-3.5 text-muted-foreground" />
                    <Badge variant="outline" className="text-[10px] h-5">Seller</Badge>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{comment.seller_reply.body}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{formatDate(comment.seller_reply.created_at)}</p>
                </div>
              )}

              {isProductOwner && (
                <div className="pl-10">
                  <SellerInlineReplyForm
                    initialValue={comment.seller_reply?.body || ""}
                    submitLabel={comment.seller_reply ? "Update reply" : "Post reply"}
                    editLabel="Reply as seller"
                    compact
                    onSubmit={(text) => handleSellerReply(comment.id, text)}
                  />
                </div>
              )}
            </div>
          ))}
          {hasMore && (
            <Button variant="outline" size="sm" disabled={isFetching} onClick={() => setPage((p) => p + 1)}>
              {isFetching ? "Loading…" : "Load more comments"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
