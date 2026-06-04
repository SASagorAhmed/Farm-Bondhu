import { Product } from "@/data/mockData";

export const MARKETPLACE_SELLER_FALLBACK = "Marketplace Seller";

export type FlashSaleRequestStatus = "pending" | "approved" | "rejected" | null;

export type MarketplaceProduct = Product & {
  shopName?: string;
  is_verified_seller?: boolean;
  listing_status?: string | null;
  is_flash_sale?: boolean;
  flash_sale_end?: string;
  flash_sale_request_status?: FlashSaleRequestStatus;
  flash_sale_requested_at?: string;
  flash_sale_requested_original_price?: number;
  flash_sale_request_notes?: string;
  flash_sale_review_notes?: string;
  wholesale_price?: number | null;
  wholesale_rule?: string | null;
  wholesale_min_qty?: number | null;
  wholesale_min_order_bdt?: number | null;
  created_at?: string;
  shop_pin_order?: number | null;
  shop_sort_order?: number;
};

/** Buyer-facing seller label: shop name only, never personal profile name. */
export function getSellerDisplayName(
  product?: Pick<MarketplaceProduct, "shopName"> | null,
  shop?: { shop_name?: string | null } | null
): string {
  const fromShop = shop?.shop_name?.trim() || product?.shopName?.trim();
  return fromShop || MARKETPLACE_SELLER_FALLBACK;
}

/** Read shop brand name from shops row or latest approved shop_access request. */
export function shopNameFromApprovalRequest(row: Record<string, unknown>): string | null {
  const details = (row.details ?? row.payload ?? {}) as { shopName?: string; shop_name?: string };
  const name = String(details.shopName || details.shop_name || "").trim();
  return name || null;
}

export function dbToProduct(row: Record<string, unknown>): MarketplaceProduct {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    category: String(row.category || "animal_feed") as Product["category"],
    price: Number(row.price || 0),
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
    unit: String(row.unit || "pc"),
    image: String(row.image || ""),
    seller: String(row.seller_name || ""),
    sellerId: String(row.seller_id || ""),
    shopName: row.shop_name != null ? String(row.shop_name) : undefined,
    rating: Number(row.rating || 0),
    reviewCount: row.review_count != null ? Number(row.review_count) : undefined,
    stock: Number(row.stock || 0),
    description: String(row.description || ""),
    location: String(row.location || ""),
    freeDelivery: Boolean(row.free_delivery),
    deliveryChargeDhaka:
      row.delivery_charge_dhaka != null ? Number(row.delivery_charge_dhaka) : null,
    deliveryChargeOutside:
      row.delivery_charge_outside != null ? Number(row.delivery_charge_outside) : null,
    is_verified_seller: Boolean(row.is_verified_seller),
    listing_status: row.listing_status != null ? String(row.listing_status) : undefined,
    is_flash_sale: Boolean(row.is_flash_sale),
    flash_sale_end: row.flash_sale_end ? String(row.flash_sale_end) : undefined,
    flash_sale_request_status: row.flash_sale_request_status
      ? (String(row.flash_sale_request_status) as FlashSaleRequestStatus)
      : undefined,
    flash_sale_requested_at: row.flash_sale_requested_at
      ? String(row.flash_sale_requested_at)
      : undefined,
    flash_sale_requested_original_price:
      row.flash_sale_requested_original_price != null
        ? Number(row.flash_sale_requested_original_price)
        : undefined,
    flash_sale_request_notes: row.flash_sale_request_notes
      ? String(row.flash_sale_request_notes)
      : undefined,
    flash_sale_review_notes: row.flash_sale_review_notes
      ? String(row.flash_sale_review_notes)
      : undefined,
    wholesale_price: row.wholesale_price != null ? Number(row.wholesale_price) : null,
    wholesale_rule: row.wholesale_rule != null ? String(row.wholesale_rule) : null,
    wholesale_min_qty:
      row.wholesale_min_qty != null ? Number(row.wholesale_min_qty) : null,
    wholesale_min_order_bdt:
      row.wholesale_min_order_bdt != null ? Number(row.wholesale_min_order_bdt) : null,
    created_at: row.created_at ? String(row.created_at) : undefined,
    shop_pin_order: row.shop_pin_order != null ? Number(row.shop_pin_order) : null,
    shop_sort_order: row.shop_sort_order != null ? Number(row.shop_sort_order) : 0,
  };
}

export function productDiscountPercent(product: Pick<Product, "price" | "originalPrice">): number {
  if (!product.originalPrice || product.originalPrice <= product.price) return 0;
  return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
}

/** Admin-flagged flash sale that is currently active on the marketplace homepage. */
export function isFlashSaleActive(product: MarketplaceProduct): boolean {
  if (!product.is_flash_sale) return false;
  if (productDiscountPercent(product) <= 0) return false;
  if (product.flash_sale_end) {
    const end = new Date(product.flash_sale_end).getTime();
    if (!Number.isNaN(end) && end <= Date.now()) return false;
  }
  return true;
}

/** @deprecated Prefer isFlashSaleActive for buyer flash sale row. */
export function isFlashSaleProduct(product: MarketplaceProduct): boolean {
  return isFlashSaleActive(product);
}
