import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import ProductReviewForm from "@/components/marketplace/ProductReviewForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  productId: string;
  productName: string;
  onSubmitted?: () => void;
}

type ProductDetailCache = {
  product: {
    rating: number;
    reviewCount?: number;
    [key: string]: unknown;
  } | null;
  shop: unknown;
};

export default function ProductReviewDialog({
  open,
  onOpenChange,
  orderId,
  productId,
  productName,
  onSubmitted,
}: Props) {
  const queryClient = useQueryClient();

  const handleSubmitted = (aggregates?: { rating: number; reviewCount: number }) => {
    if (aggregates) {
      queryClient.setQueryData<ProductDetailCache>(["product-detail", productId], (old) => {
        if (!old?.product) return old;
        return {
          ...old,
          product: {
            ...old.product,
            rating: aggregates.rating,
            reviewCount: aggregates.reviewCount,
          },
        };
      });
    }
    queryClient.invalidateQueries({ queryKey: ["pending-reviewables"] });
    queryClient.invalidateQueries({ queryKey: ["order-review-status", orderId] });
    queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
    queryClient.invalidateQueries({ queryKey: ["product-detail", productId] });
    onOpenChange(false);
    onSubmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Write a review</DialogTitle>
        </DialogHeader>
        <ProductReviewForm
          orderId={orderId}
          productId={productId}
          productName={productName}
          onCancel={() => onOpenChange(false)}
          onSubmitted={handleSubmitted}
        />
      </DialogContent>
    </Dialog>
  );
}
