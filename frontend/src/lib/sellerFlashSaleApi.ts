import { API_BASE, readSession } from "@/api/client";

async function authJson<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data?: T; error?: string }> {
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

export async function requestSellerFlashSale(
  productId: string,
  opts?: { requested_original_price?: number; notes?: string },
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  return authJson<Record<string, unknown>>(
    `/v1/marketplace/seller/products/${encodeURIComponent(productId)}/flash-sale-request`,
    {
      method: "POST",
      body: JSON.stringify(opts || {}),
    },
  );
}

export async function cancelSellerFlashSaleRequest(
  productId: string,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  return authJson<Record<string, unknown>>(
    `/v1/marketplace/seller/products/${encodeURIComponent(productId)}/flash-sale-request`,
    { method: "DELETE" },
  );
}
