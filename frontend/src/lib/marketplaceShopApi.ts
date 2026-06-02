import { API_BASE, readSession, apiJson } from "@/api/client";
import { dbToProduct, MarketplaceProduct } from "@/lib/marketplaceProduct";
import { readFileAsDataUrl } from "@/lib/marketplaceProductForm";

export type PublicShop = {
  user_id: string;
  shop_name?: string | null;
  description?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  location?: string | null;
  rating?: number | null;
  total_products?: number | null;
  total_sales?: number | null;
  total_units_sold?: number | null;
  is_verified?: boolean | null;
  created_date?: string | null;
  status?: string | null;
};

export type StorefrontProductDisplay = {
  product_id: string;
  shop_pin_order?: number | null;
  shop_sort_order?: number;
};

export const MAX_PINNED_PRODUCTS = 8;

export function shopPath(sellerId: string): string {
  return `/marketplace/shop/${encodeURIComponent(sellerId)}`;
}

export function sellerShopEditorPath(): string {
  return "/seller/my-shop";
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string }> {
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

export async function fetchPublicShop(sellerId: string): Promise<PublicShop | null> {
  const { ok, data } = await authFetch<PublicShop>(`/v1/marketplace/shops/by-user/${encodeURIComponent(sellerId)}`);
  return ok && data ? data : null;
}

export type FetchShopProductsResult = {
  products: MarketplaceProduct[];
  error?: string;
  usedFallbackSort?: boolean;
};

export async function fetchShopProducts(
  sellerId: string,
  options?: { limit?: number; sort?: "newest" | "storefront" }
): Promise<FetchShopProductsResult> {
  const limit = options?.limit ?? 200;
  const preferredSort = options?.sort ?? "storefront";

  async function load(sort: "newest" | "storefront") {
    const params = new URLSearchParams({
      seller_id: sellerId,
      limit: String(limit),
      sort,
    });
    return authFetch<Record<string, unknown>[]>(`/v1/marketplace/products?${params.toString()}`);
  }

  let { ok, data, error } = await load(preferredSort);
  let usedFallbackSort = false;

  if (!ok && preferredSort === "storefront") {
    const retry = await load("newest");
    ok = retry.ok;
    data = retry.data;
    error = retry.error;
    usedFallbackSort = Boolean(retry.ok);
  }

  if (!ok || !Array.isArray(data)) {
    return { products: [], error: error || "Failed to load shop products" };
  }

  return {
    products: data.map((row) => dbToProduct(row)),
    usedFallbackSort,
  };
}

export async function updateMyShop(
  userId: string,
  patch: { description?: string; location?: string; shop_name?: string; logo_url?: string; banner_url?: string }
): Promise<{ ok: boolean; error?: string }> {
  const { ok, error } = await authFetch(`/v1/marketplace/shops/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return { ok, error };
}

export async function uploadShopAsset(type: "banner" | "logo", file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const { res, body } = await apiJson("/v1/marketplace/shops/upload-asset", {
    method: "POST",
    body: JSON.stringify({ type, image: dataUrl }),
  });
  if (!res.ok) {
    throw new Error(String((body as { error?: string }).error || "Upload failed"));
  }
  const url = (body as { data?: { url?: string } }).data?.url;
  if (!url) throw new Error("Upload failed");
  return url;
}

export async function updateShopStorefront(
  userId: string,
  items: StorefrontProductDisplay[]
): Promise<{ ok: boolean; error?: string }> {
  const { ok, error } = await authFetch(`/v1/marketplace/shops/${encodeURIComponent(userId)}/storefront`, {
    method: "PATCH",
    body: JSON.stringify({ items }),
  });
  return { ok, error };
}

export function nextPinSlot(products: MarketplaceProduct[]): number | null {
  const used = new Set(
    products
      .map((p) => p.shop_pin_order)
      .filter((n): n is number => n != null && n >= 1 && n <= MAX_PINNED_PRODUCTS)
  );
  for (let i = 1; i <= MAX_PINNED_PRODUCTS; i++) {
    if (!used.has(i)) return i;
  }
  return null;
}
