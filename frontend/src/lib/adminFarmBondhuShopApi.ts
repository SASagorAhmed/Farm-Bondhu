import { apiJson, readSession } from "@/api/client";
import type {
  SellerEarningsBreakdown,
  SellerEarningsSummary,
  SellerWithdrawalRow,
} from "@/lib/sellerPayoutApi";
import type { SellerInventoryItem } from "@/lib/sellerInventoryApi";
import type { MarketplaceOrder } from "@/contexts/OrderContext";
import { parseDeliveryAddress } from "@/lib/deliveryAddress";

const BASE = "/v1/marketplace/admin/farmbondhu-shop";

async function adminOfficialJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readSession()?.access_token;
  const { res, body } = await apiJson(`${BASE}${path}`, {
    ...init,
    headers: {
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

export function officialShopEarningsQueryKey() {
  return ["admin-official-shop-earnings"] as const;
}

export function officialShopWithdrawalsQueryKey() {
  return ["admin-official-shop-withdrawals"] as const;
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

export function fetchOfficialShopEarningsSummary(): Promise<SellerEarningsSummary> {
  return adminOfficialJson<SellerEarningsSummary>("/earnings/summary");
}

export function fetchOfficialShopEarningsBreakdown(): Promise<SellerEarningsBreakdown> {
  return adminOfficialJson<SellerEarningsBreakdown>("/earnings/breakdown");
}

export function fetchOfficialShopWithdrawals(): Promise<SellerWithdrawalRow[]> {
  return adminOfficialJson<SellerWithdrawalRow[]>("/withdrawals");
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
