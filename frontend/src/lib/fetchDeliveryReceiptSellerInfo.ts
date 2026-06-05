import { api } from "@/api/client";
import { fetchPublicShop } from "@/lib/marketplaceShopApi";
import type { DeliveryReceiptSellerInfo } from "@/lib/marketplaceDeliveryReceiptPdf";
import type { MarketplaceOrder } from "@/contexts/OrderContext";

export async function fetchDeliveryReceiptSellerInfo(
  order: MarketplaceOrder,
): Promise<DeliveryReceiptSellerInfo> {
  const [shop, profileResult] = await Promise.all([
    fetchPublicShop(order.sellerId),
    api.from("profiles").select("name, phone").eq("id", order.sellerId).maybeSingle(),
  ]);

  const profile = profileResult.data;

  return {
    shopName: shop?.shop_name?.trim() || order.sellerName || "Shop",
    sellerName: profile?.name?.trim() || order.sellerName || "Seller",
    phone: profile?.phone?.trim() || undefined,
    location: shop?.location?.trim() || undefined,
  };
}
