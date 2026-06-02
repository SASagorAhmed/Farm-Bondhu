import { API_BASE, readSession } from "@/api/client";
import type { PublicShop } from "@/lib/marketplaceShopApi";

export type SellerProductDetailResponse = {
  product: Record<string, unknown>;
  shop: PublicShop | null;
};

async function authFetch<T>(
  path: string,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: T;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: body.error || res.statusText };
  return { ok: true, data: body.data };
}

export async function fetchSellerProduct(
  productId: string,
): Promise<
  { ok: true; data: SellerProductDetailResponse } | { ok: false; error: string }
> {
  const { ok, data, error } = await authFetch<SellerProductDetailResponse>(
    `/v1/marketplace/seller/products/${encodeURIComponent(productId)}`,
  );
  if (!ok || !data?.product) {
    return { ok: false, error: error || "Failed to load product" };
  }
  return { ok: true, data };
}
