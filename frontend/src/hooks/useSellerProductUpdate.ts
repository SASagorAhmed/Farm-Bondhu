import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  MARKETPLACE_SELLER_FALLBACK,
  shopNameFromApprovalRequest,
} from "@/lib/marketplaceProduct";
import {
  ProductFormValues,
  resolveProductImageUrl,
  toSellerApiPayload,
} from "@/lib/marketplaceProductForm";
import { invalidateMarketplaceStockQueries } from "@/lib/marketplaceStockQueries";
import { toast } from "sonner";

export function useSellerProductUpdate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const invalidateCaches = useCallback(
    (productId?: string) => {
      invalidateMarketplaceStockQueries(queryClient, {
        userId: user?.id,
        productIds: productId ? [productId] : undefined,
      });
      if (productId) {
        void queryClient.invalidateQueries({
          queryKey: ["product-detail", productId],
        });
      }
    },
    [queryClient, user?.id],
  );

  const resolveVendorShopName = useCallback(async (): Promise<string> => {
    if (!user) return MARKETPLACE_SELLER_FALLBACK;
    const { data: shop } = await api
      .from("shops")
      .select("shop_name")
      .eq("user_id", user.id)
      .single();
    const fromShop = shop?.shop_name?.trim();
    if (fromShop) return fromShop;

    const { data: requests } = await api
      .from("approval_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("request_type", "shop_access")
      .order("created_at", { ascending: false });
    const approved = (requests || []).find(
      (r: { status?: string }) => r.status === "approved",
    );
    if (approved) {
      const fromRequest = shopNameFromApprovalRequest(
        approved as Record<string, unknown>,
      );
      if (fromRequest) return fromRequest;
    }
    return MARKETPLACE_SELLER_FALLBACK;
  }, [user]);

  const submitProduct = useCallback(
    async (
      mode: "create" | "edit",
      values: ProductFormValues,
      options?: {
        editingId?: string | null;
        listingStatus?: string | null;
        onSuccess?: () => void;
      },
    ) => {
      if (!user) return;
      const imageUrl = await resolveProductImageUrl(values);
      const sellerName = await resolveVendorShopName();
      const payload = {
        ...toSellerApiPayload(values, imageUrl),
        seller_id: user.id,
        seller_name: sellerName,
      };

      if (mode === "edit" && options?.editingId) {
        const { error } = await api
          .from("products")
          .update(payload)
          .eq("id", options.editingId);
        if (error) throw new Error(error.message);
        invalidateCaches(options.editingId);
        if (options.listingStatus === "rejected") {
          toast.success("Product resubmitted for review");
        } else {
          toast.success(
            "Product updated — pending admin review if listing changed",
          );
        }
      } else {
        const { error } = await api.from("products").insert(payload);
        if (error) throw new Error(error.message);
        invalidateCaches();
        toast.success(
          "Product submitted for review. It will appear on the marketplace after admin approval.",
        );
      }
      options?.onSuccess?.();
    },
    [user, invalidateCaches, resolveVendorShopName],
  );

  const updateDescription = useCallback(
    async (productId: string, description: string) => {
      const { error } = await api
        .from("products")
        .update({ description: description.trim() })
        .eq("id", productId);
      if (error) throw new Error(error.message);
      invalidateCaches(productId);
      toast.success("Description updated");
    },
    [invalidateCaches],
  );

  return { submitProduct, updateDescription, invalidateCaches };
}
