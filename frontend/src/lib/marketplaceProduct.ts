import { Product } from "@/data/mockData";

export type MarketplaceProduct = Product & {
  is_verified_seller?: boolean;
  is_flash_sale?: boolean;
  flash_sale_end?: string;
  created_at?: string;
};

export function dbToProduct(row: Record<string, unknown>): MarketplaceProduct {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    category: String(row.category || "feed") as Product["category"],
    price: Number(row.price || 0),
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
    unit: String(row.unit || "pc"),
    image: String(row.image || ""),
    seller: String(row.seller_name || ""),
    sellerId: String(row.seller_id || ""),
    rating: Number(row.rating || 0),
    reviewCount: row.review_count != null ? Number(row.review_count) : undefined,
    stock: Number(row.stock || 0),
    description: String(row.description || ""),
    location: String(row.location || ""),
    freeDelivery: Boolean(row.free_delivery),
    is_verified_seller: Boolean(row.is_verified_seller),
    is_flash_sale: Boolean(row.is_flash_sale),
    flash_sale_end: row.flash_sale_end ? String(row.flash_sale_end) : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export function productDiscountPercent(product: Pick<Product, "price" | "originalPrice">): number {
  if (!product.originalPrice || product.originalPrice <= product.price) return 0;
  return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
}

export function isFlashSaleProduct(product: MarketplaceProduct): boolean {
  if (product.is_flash_sale) return true;
  return productDiscountPercent(product) > 0;
}
