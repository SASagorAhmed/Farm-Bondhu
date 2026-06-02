import { API_BASE, readSession } from "@/api/client";

export type AdminFlashSalePatch = {
  is_flash_sale?: boolean;
  flash_sale_end?: string | null;
  original_price?: number | null;
  action?: "reject";
  review_notes?: string | null;
};

export type AdminFlashSaleRequestRow = Record<string, unknown> & {
  id: string;
  name: string;
  seller_id: string;
  seller_name?: string;
  shop_name?: string;
  owner_name?: string;
  price: number;
  flash_sale_requested_at?: string | null;
  flash_sale_requested_original_price?: number | null;
  flash_sale_request_notes?: string | null;
  listing_status?: string;
};

async function authJson<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string }> {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) return { ok: false, error: body.error || res.statusText };
  return { ok: true, data: body.data };
}

export async function adminSetProductFlashSale(
  productId: string,
  patch: AdminFlashSalePatch,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  return authJson<Record<string, unknown>>(
    `/v1/marketplace/admin/products/${encodeURIComponent(productId)}/flash-sale`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
}

export async function adminRejectFlashSaleRequest(
  productId: string,
  reviewNotes?: string,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  return adminSetProductFlashSale(productId, {
    action: "reject",
    review_notes: reviewNotes || null,
  });
}

export async function fetchAdminFlashSaleRequests(
  status = "pending",
): Promise<AdminFlashSaleRequestRow[]> {
  const q = new URLSearchParams({ status });
  const { ok, data, error } = await authJson<AdminFlashSaleRequestRow[]>(
    `/v1/marketplace/admin/flash-sale/requests?${q}`,
  );
  if (!ok) throw new Error(error || "Failed to load flash sale requests");
  return data || [];
}
