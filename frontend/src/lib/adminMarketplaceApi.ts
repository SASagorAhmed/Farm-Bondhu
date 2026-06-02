import { apiJson } from "@/api/client";

export type AdminBuyerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  status: string;
  primary_role: string;
  avatar_url: string | null;
  marketplace_blocked: boolean;
  created_at: string;
  roles: string[];
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
};

export type AdminSellerRow = {
  user_id: string;
  shop_name: string;
  description: string | null;
  location: string | null;
  status: string;
  is_verified: boolean;
  total_products: number;
  total_sales: number;
  created_at: string;
  logo_url: string | null;
  owner_name: string;
  owner_avatar_url: string | null;
  owner_email: string;
  owner_phone: string | null;
  owner_status: string;
  marketplace_blocked: boolean;
  roles: string[];
  product_count: number;
  order_count: number;
  revenue: number;
};

export type ModerationAction =
  | "suspend"
  | "activate"
  | "block"
  | "unblock"
  | "remove_marketplace_access"
  | "soft_delete"
  | "permanent_delete";

export type ModerationResult = {
  ok: boolean;
  deleted?: boolean;
  status?: string;
  marketplace_blocked?: boolean;
  message?: string;
};

export type OfficialFarmBondhuShopMeta = {
  seller_id: string;
  shop_name: string;
};

export type AdminOrderRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  buyer_name: string;
  seller_name: string;
  items: unknown;
  total: number;
  shipping_fee: number | null;
  delivery_address: unknown;
  payment_method: string | null;
  payment_status: string | null;
  timeline: unknown;
  estimated_delivery: string | null;
  estimated_delivery_note: string | null;
  status: string;
  date: string | null;
  return_reason: string | null;
  return_note: string | null;
  tracking_id: string | null;
  created_at: string;
  updated_at: string | null;
};

export type AdminTransactionRow = {
  id: string;
  order_id: string;
  type: "order_payment" | "fulfillment" | "refund";
  amount: number;
  payment_method: string | null;
  payment_status: string | null;
  buyer_name: string;
  seller_name: string;
  status: string;
  order_status?: string;
  note: string | null;
  created_at: string;
};

type Paginated<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
};

function buildQuery(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== "all") q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchOfficialFarmBondhuShopMeta(): Promise<OfficialFarmBondhuShopMeta> {
  const { res, body } = await apiJson("/v1/marketplace/admin/farmbondhu-shop/meta");
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load FarmBondhu shop"));
  return (body as { data: OfficialFarmBondhuShopMeta }).data;
}

export async function fetchAdminBuyers(params: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Paginated<AdminBuyerRow>> {
  const { res, body } = await apiJson(`/v1/marketplace/admin/buyers${buildQuery(params)}`);
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load buyers"));
  return body as Paginated<AdminBuyerRow>;
}

export async function fetchAdminBuyerDetail(id: string) {
  const { res, body } = await apiJson(`/v1/marketplace/admin/buyers/${id}`);
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load buyer"));
  return (body as { data: unknown }).data;
}

export async function fetchAdminSellers(params: {
  search?: string;
  verified?: string;
  limit?: number;
  offset?: number;
}): Promise<Paginated<AdminSellerRow>> {
  const { res, body } = await apiJson(`/v1/marketplace/admin/sellers${buildQuery(params)}`);
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load sellers"));
  return body as Paginated<AdminSellerRow>;
}

/** All marketplace shops for admin marketplace / flash sale browsers. */
export async function fetchAdminShopsList(params?: {
  search?: string;
  limit?: number;
}): Promise<AdminSellerRow[]> {
  const result = await fetchAdminSellers({
    search: params?.search,
    limit: params?.limit ?? 500,
    offset: 0,
  });
  return result.data;
}

export type AdminProductRow = Record<string, unknown> & {
  id: string;
  name: string;
  seller_id: string;
  seller_name?: string;
  price: number;
  original_price?: number | null;
  stock?: number;
  listing_status?: string;
  is_flash_sale?: boolean;
  flash_sale_end?: string | null;
  flash_sale_request_status?: string | null;
  flash_sale_requested_at?: string | null;
  flash_sale_requested_original_price?: number | null;
  flash_sale_request_notes?: string | null;
  flash_sale_review_notes?: string | null;
};

export async function fetchAdminProducts(params?: { limit?: number }): Promise<AdminProductRow[]> {
  const limit = Math.min(Math.max(params?.limit ?? 500, 1), 1000);
  const { res, body } = await apiJson("/v1/compat/from/admin", {
    method: "POST",
    body: JSON.stringify({
      action: "select",
      table: "products",
      mode: "admin_all",
      limit,
    }),
  });
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load products"));
  return ((body as { data?: AdminProductRow[] }).data || []) as AdminProductRow[];
}

export async function adminSetShopVerified(
  userId: string,
  isVerified: boolean,
  adminUserId?: string,
): Promise<void> {
  const { res, body } = await apiJson(
    `/v1/marketplace/admin/shops/${encodeURIComponent(userId)}/verification`,
    {
      method: "PATCH",
      body: JSON.stringify({
        is_verified: isVerified,
        verified_by: isVerified ? adminUserId : null,
      }),
    },
  );
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to update shop verification"));
}

export async function adminVerifySellerProducts(userId: string, isVerified: boolean): Promise<void> {
  const { res, body } = await apiJson("/v1/marketplace/admin/products/verify-seller", {
    method: "PATCH",
    body: JSON.stringify({ seller_user_id: userId, is_verified_seller: isVerified }),
  });
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to update seller products"));
}

export async function fetchAdminSellerDetail(userId: string) {
  const { res, body } = await apiJson(`/v1/marketplace/admin/sellers/${userId}`);
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load seller"));
  return (body as { data: unknown }).data;
}

export async function fetchAdminMarketplaceOrders(params: {
  status?: string;
  payment_status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Paginated<AdminOrderRow>> {
  const { res, body } = await apiJson(`/v1/marketplace/admin/orders${buildQuery(params)}`);
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load orders"));
  return body as Paginated<AdminOrderRow>;
}

export async function fetchAdminOrderDetail(orderId: string): Promise<AdminOrderRow> {
  const { res, body } = await apiJson(`/v1/marketplace/admin/orders/${orderId}`);
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load order"));
  return (body as { data: AdminOrderRow }).data;
}

export async function fetchAdminTransactions(params: {
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<Paginated<AdminTransactionRow> & { summary?: { total_volume: number; paid_count: number; unpaid_count: number; refund_count: number } }> {
  const { res, body } = await apiJson(`/v1/marketplace/admin/transactions${buildQuery(params)}`);
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load transactions"));
  return body as Paginated<AdminTransactionRow> & {
    summary?: { total_volume: number; paid_count: number; unpaid_count: number; refund_count: number };
  };
}

export async function moderateAdminBuyer(
  id: string,
  action: ModerationAction,
  confirmPhrase: string
): Promise<ModerationResult> {
  const { res, body } = await apiJson(`/v1/marketplace/admin/buyers/${id}/moderate`, {
    method: "PATCH",
    body: JSON.stringify({ action, confirmPhrase }),
  });
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Moderation failed"));
  return (body as { data: ModerationResult }).data;
}

export async function moderateAdminSeller(
  userId: string,
  action: ModerationAction,
  confirmPhrase: string
): Promise<ModerationResult> {
  const { res, body } = await apiJson(`/v1/marketplace/admin/sellers/${userId}/moderate`, {
    method: "PATCH",
    body: JSON.stringify({ action, confirmPhrase }),
  });
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Moderation failed"));
  return (body as { data: ModerationResult }).data;
}
