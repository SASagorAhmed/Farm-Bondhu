import { apiJson, readSession } from "@/api/client";
import type {
  SellerEarningsBreakdown,
  SellerEarningsSummary,
  SellerWithdrawalRow,
} from "@/lib/sellerPayoutApi";
import type { SellerInventoryItem } from "@/lib/sellerInventoryApi";
import type { MarketplaceOrder } from "@/contexts/OrderContext";
import { parseDeliveryAddress } from "@/lib/deliveryAddress";
import type { PublicShop, StorefrontProductDisplay } from "@/lib/marketplaceShopApi";
import { readFileAsDataUrl } from "@/lib/marketplaceProductForm";
import type { SellerReviewStats } from "@/lib/marketplaceReviewsApi";

const BASE = "/v1/marketplace/admin/farmbondhu-shop";

async function adminOfficialJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readSession()?.access_token;
  const { res, body } = await apiJson(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(String((body as { error?: string }).error || "Request failed"));
  }
  return (body as { data: T }).data;
}

export type OfficialShopProductRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  image?: string | null;
  listing_status?: string | null;
  seller_id?: string;
  seller_name?: string;
  [key: string]: unknown;
};

export type OfficialShopReviewsResponse = {
  reviews: Record<string, unknown>[];
  page: number;
  limit: number;
  total: number;
  stats: SellerReviewStats;
};

export type OfficialShopProductCommentsResponse = {
  comments: Record<string, unknown>[];
  page: number;
  limit: number;
  total: number;
  stats: { total: number; needsReplyCount: number; repliedCount: number; responseRate: number };
};

function dbToOfficialShopOrder(row: Record<string, unknown>): MarketplaceOrder {
  const rawItems = Array.isArray(row.items) ? row.items : [];
  return {
    id: String(row.id),
    date: String(row.date || row.created_at || ""),
    items: rawItems.map((item: Record<string, unknown>) => ({
      productId: String(item.productId || item.product_id || ""),
      name: String(item.name || ""),
      qty: Number(item.qty ?? item.quantity ?? 0),
      price: Number(item.price ?? item.unitPrice ?? 0),
      image: String(item.image || ""),
    })),
    total: Number(row.total),
    shippingFee: Number(row.shipping_fee ?? 0),
    status: row.status as MarketplaceOrder["status"],
    buyerId: String(row.buyer_id),
    buyerName: String(row.buyer_name || "Customer"),
    sellerId: String(row.seller_id),
    sellerName: String(row.seller_name || ""),
    deliveryAddress: parseDeliveryAddress(row.delivery_address),
    paymentMethod: String(row.payment_method || ""),
    paymentStatus: (row.payment_status as MarketplaceOrder["paymentStatus"]) || "unpaid",
    timeline: (Array.isArray(row.timeline) ? row.timeline : []) as MarketplaceOrder["timeline"],
    returnReason: row.return_reason != null ? String(row.return_reason) : undefined,
    returnNote: row.return_note != null ? String(row.return_note) : undefined,
    estimatedDelivery:
      row.estimated_delivery_note != null
        ? String(row.estimated_delivery_note)
        : row.estimated_delivery != null
          ? String(row.estimated_delivery)
          : undefined,
    trackingId: row.tracking_id != null ? String(row.tracking_id) : undefined,
  };
}

export function officialShopInventoryQueryKey() {
  return ["admin-official-shop-inventory"] as const;
}

export function officialShopProductsQueryKey() {
  return ["admin-official-shop-products"] as const;
}

export function officialShopOrdersQueryKey() {
  return ["admin-official-shop-orders"] as const;
}

export function officialShopOrderQueryKey(orderId: string) {
  return ["admin-official-shop-order", orderId] as const;
}

export function officialShopProductQueryKey(productId: string) {
  return ["admin-official-shop-product", productId] as const;
}

export function officialShopEarningsQueryKey() {
  return ["admin-official-shop-earnings"] as const;
}

export function officialShopWithdrawalsQueryKey() {
  return ["admin-official-shop-withdrawals"] as const;
}

export function officialShopReviewsQueryKey(filter = "all") {
  return ["admin-official-shop-reviews", filter] as const;
}

export function officialShopProductCommentsQueryKey(filter = "all") {
  return ["admin-official-shop-product-comments", filter] as const;
}

export function fetchOfficialShopInventory(): Promise<SellerInventoryItem[]> {
  return adminOfficialJson<SellerInventoryItem[]>("/inventory");
}

export function fetchOfficialShopProducts(): Promise<OfficialShopProductRow[]> {
  return adminOfficialJson<OfficialShopProductRow[]>("/products");
}

export async function fetchOfficialShopOrders(): Promise<MarketplaceOrder[]> {
  const rows = await adminOfficialJson<Record<string, unknown>[]>("/orders");
  return (Array.isArray(rows) ? rows : []).map((row) => dbToOfficialShopOrder(row));
}

export async function fetchOfficialShopOrder(orderId: string): Promise<MarketplaceOrder> {
  const row = await adminOfficialJson<Record<string, unknown>>(`/orders/${encodeURIComponent(orderId)}`);
  return dbToOfficialShopOrder(row);
}

export function fetchOfficialShopProduct(productId: string): Promise<Record<string, unknown>> {
  return adminOfficialJson<Record<string, unknown>>(`/products/${encodeURIComponent(productId)}`);
}

export function fetchOfficialShopEarningsSummary(): Promise<SellerEarningsSummary> {
  return adminOfficialJson<SellerEarningsSummary>("/earnings/summary");
}

export function fetchOfficialShopEarningsBreakdown(): Promise<SellerEarningsBreakdown> {
  return adminOfficialJson<SellerEarningsBreakdown>("/earnings/breakdown");
}

export function fetchOfficialShopWithdrawals(): Promise<SellerWithdrawalRow[]> {
  return adminOfficialJson<SellerWithdrawalRow[]>("/withdrawals");
}

export function createOfficialShopWithdrawal(payload: {
  request_amount: number;
  note?: string | null;
}): Promise<SellerWithdrawalRow> {
  return adminOfficialJson<SellerWithdrawalRow>("/withdrawals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchOfficialShopOrderStatus(
  orderId: string,
  patch: {
    status: string;
    timeline: unknown[];
    tracking_id?: string;
    payment_status?: string;
  },
): Promise<void> {
  const token = readSession()?.access_token;
  const { res, body } = await apiJson(`/v1/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(String((body as { error?: string }).error || "Could not update order"));
  }
}

export async function updateOfficialShopProfile(
  patch: Partial<Pick<PublicShop, "description" | "location" | "shop_name" | "logo_url" | "banner_url">>,
): Promise<PublicShop> {
  return adminOfficialJson<PublicShop>("/shop", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function updateOfficialShopStorefront(
  items: StorefrontProductDisplay[],
): Promise<unknown> {
  return adminOfficialJson("/storefront", {
    method: "PATCH",
    body: JSON.stringify({ items }),
  });
}

export async function uploadOfficialShopAsset(type: "banner" | "logo", file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const data = await adminOfficialJson<{ url: string }>("/upload-asset", {
    method: "POST",
    body: JSON.stringify({ type, image: dataUrl }),
  });
  if (!data?.url) throw new Error("Upload failed");
  return data.url;
}

export function fetchOfficialShopReviews(opts?: {
  filter?: "all" | "needs_reply" | "replied";
  productId?: string;
  page?: number;
}): Promise<OfficialShopReviewsResponse> {
  const params = new URLSearchParams();
  if (opts?.filter && opts.filter !== "all") params.set("filter", opts.filter);
  if (opts?.productId) params.set("product_id", opts.productId);
  if (opts?.page) params.set("page", String(opts.page));
  const qs = params.toString();
  return adminOfficialJson<OfficialShopReviewsResponse>(`/reviews${qs ? `?${qs}` : ""}`);
}

export function submitOfficialShopReviewReply(reviewId: string, reply: string): Promise<Record<string, unknown>> {
  return adminOfficialJson<Record<string, unknown>>(`/reviews/${encodeURIComponent(reviewId)}/reply`, {
    method: "PUT",
    body: JSON.stringify({ reply }),
  });
}

export function fetchOfficialShopProductComments(opts?: {
  filter?: "all" | "needs_reply" | "replied";
  page?: number;
}): Promise<OfficialShopProductCommentsResponse> {
  const params = new URLSearchParams();
  if (opts?.filter && opts.filter !== "all") params.set("filter", opts.filter);
  if (opts?.page) params.set("page", String(opts.page));
  const qs = params.toString();
  return adminOfficialJson<OfficialShopProductCommentsResponse>(
    `/product-comments${qs ? `?${qs}` : ""}`,
  );
}

export function submitOfficialShopProductCommentReply(
  commentId: string,
  body: string,
): Promise<Record<string, unknown>> {
  return adminOfficialJson<Record<string, unknown>>(
    `/product-comments/${encodeURIComponent(commentId)}/reply`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
  );
}

/** Admin-scoped shop actions for SellerStorefrontLayout in official shop editor. */
export const officialShopStorefrontActions = {
  updateShop: async (
    _sellerId: string,
    patch: { description?: string; location?: string; logo_url?: string; banner_url?: string },
  ) => {
    try {
      await updateOfficialShopProfile(patch);
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Update failed" };
    }
  },
  updateStorefront: async (_sellerId: string, items: StorefrontProductDisplay[]) => {
    try {
      await updateOfficialShopStorefront(items);
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Update failed" };
    }
  },
  uploadAsset: async (_type: "banner" | "logo", file: File) => uploadOfficialShopAsset(_type, file),
};
