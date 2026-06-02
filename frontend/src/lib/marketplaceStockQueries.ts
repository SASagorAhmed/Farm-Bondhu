import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { invalidateSellerInventoryQueries } from "@/lib/sellerInventoryApi";

export function invalidateMarketplaceStockQueries(
  queryClient: QueryClient,
  options?: { userId?: string; productIds?: string[] },
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys().products() });
  invalidateSellerInventoryQueries(queryClient, options?.userId);
  for (const productId of options?.productIds || []) {
    void queryClient.invalidateQueries({ queryKey: ["product-detail", productId] });
  }
}
