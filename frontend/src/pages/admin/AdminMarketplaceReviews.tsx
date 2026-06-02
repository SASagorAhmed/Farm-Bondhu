import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Star, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import { AdminGreenbondhuConfirmDialog } from "@/components/admin/AdminGreenbondhuConfirmDialog";
import {
  adminDeleteProductComment,
  adminDeleteReview,
  adminListProductComments,
  adminListReviews,
} from "@/lib/marketplaceReviewsApi";

type DeleteTarget =
  | { type: "review"; id: string; label: string }
  | { type: "comment"; id: string; label: string };

export default function AdminMarketplaceReviews() {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["admin-marketplace-reviews"],
    queryFn: async () => {
      const result = await adminListReviews();
      return result.ok && Array.isArray(result.data) ? result.data : [];
    },
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["admin-marketplace-product-comments"],
    queryFn: async () => {
      const result = await adminListProductComments();
      return result.ok && Array.isArray(result.data) ? result.data : [];
    },
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result =
      deleteTarget.type === "review"
        ? await adminDeleteReview(deleteTarget.id)
        : await adminDeleteProductComment(deleteTarget.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error || "Remove failed");
      return;
    }
    toast.success(deleteTarget.type === "review" ? "Review removed" : "Comment removed");
    setDeleteTarget(null);
    queryClient.invalidateQueries({ queryKey: ["admin-marketplace-reviews"] });
    queryClient.invalidateQueries({ queryKey: ["admin-marketplace-product-comments"] });
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${ICON_COLORS.cart}, ${MARKETPLACE_THEME.primary})` }}
        >
          <Star className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Product Reviews & Comments</h1>
            <Badge variant="outline" className="text-[10px]">Marketplace</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Remove abusive verified reviews or open product comments. Buyers cannot delete their own posts.
          </p>
        </div>
      </motion.div>

      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews">Verified reviews ({reviews.filter((r) => !r.deleted_at).length})</TabsTrigger>
          <TabsTrigger value="comments">Product comments ({comments.filter((c) => !c.deleted_at).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="mt-4">
          <Card className="shadow-card overflow-hidden">
            <CardContent className="p-0">
              {reviewsLoading ? (
                <p className="p-6 text-sm text-muted-foreground">Loading reviews…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map((row) => (
                      <TableRow key={String(row.id)} className={row.deleted_at ? "opacity-50" : undefined}>
                        <TableCell className="font-medium">{String(row.product_name || row.product_id)}</TableCell>
                        <TableCell>{String(row.buyer_name || row.buyer_id)}</TableCell>
                        <TableCell>{String(row.rating)} ★</TableCell>
                        <TableCell className="max-w-xs truncate">{String(row.comment || "—")}</TableCell>
                        <TableCell>{new Date(String(row.created_at)).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          {row.deleted_at ? (
                            <Badge variant="secondary">Removed</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive gap-1"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "review",
                                  id: String(row.id),
                                  label: String(row.product_name || "review"),
                                })
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Remove
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="mt-4">
          <Card className="shadow-card overflow-hidden">
            <CardContent className="p-0">
              {commentsLoading ? (
                <p className="p-6 text-sm text-muted-foreground">Loading comments…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comments.map((row) => (
                      <TableRow key={String(row.id)} className={row.deleted_at ? "opacity-50" : undefined}>
                        <TableCell className="font-medium">{String(row.product_name || row.product_id)}</TableCell>
                        <TableCell>{String(row.user_name || row.user_id)}</TableCell>
                        <TableCell className="max-w-md truncate">{String(row.body)}</TableCell>
                        <TableCell>{new Date(String(row.created_at)).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          {row.deleted_at ? (
                            <Badge variant="secondary">Removed</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive gap-1"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "comment",
                                  id: String(row.id),
                                  label: String(row.product_name || "comment"),
                                })
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Remove
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AdminGreenbondhuConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.type === "review" ? "Remove verified review" : "Remove product comment"}
        description={`This will hide the ${deleteTarget?.type === "review" ? "review" : "comment"} for "${deleteTarget?.label}" from public product pages.`}
        actionLabel="Remove"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
