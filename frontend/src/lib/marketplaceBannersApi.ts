import { apiJson } from "@/api/client";

export interface MarketplaceBanner {
  id: string;
  image_url: string;
  alt_text: string | null;
  link_url: string | null;
  sort_order: number;
  display_seconds: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function fetchMarketplaceBanners(): Promise<MarketplaceBanner[]> {
  const { res, body } = await apiJson("/v1/marketplace/banners");
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load banners"));
  return ((body as { data?: MarketplaceBanner[] }).data || []) as MarketplaceBanner[];
}

export async function fetchAdminMarketplaceBanners(): Promise<MarketplaceBanner[]> {
  const { res, body } = await apiJson("/v1/marketplace/admin/banners");
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load banners"));
  return ((body as { data?: MarketplaceBanner[] }).data || []) as MarketplaceBanner[];
}

export async function uploadMarketplaceBannerImage(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const { res, body } = await apiJson("/v1/marketplace/admin/banners/upload-image", {
    method: "POST",
    body: JSON.stringify({ image: dataUrl }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Session expired — please sign in again");
    throw new Error(String((body as { error?: string }).error || "Image upload failed"));
  }
  const url = (body as { data?: { url?: string } }).data?.url;
  if (!url) throw new Error("Image upload failed");
  return String(url);
}

export async function createMarketplaceBanner(payload: {
  image_url: string;
  alt_text?: string | null;
  link_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
  display_seconds?: number;
  starts_at?: string | null;
  ends_at?: string | null;
}): Promise<MarketplaceBanner> {
  const { res, body } = await apiJson("/v1/marketplace/admin/banners", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to create banner"));
  return (body as { data: MarketplaceBanner }).data;
}

export async function updateMarketplaceBanner(
  id: string,
  payload: Partial<{
    image_url: string;
    alt_text: string | null;
    link_url: string | null;
    sort_order: number;
    is_active: boolean;
    display_seconds: number;
    starts_at: string | null;
    ends_at: string | null;
  }>
): Promise<MarketplaceBanner> {
  const { res, body } = await apiJson(`/v1/marketplace/admin/banners/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to update banner"));
  return (body as { data: MarketplaceBanner }).data;
}

export async function deleteMarketplaceBanner(id: string): Promise<void> {
  const { res, body } = await apiJson(`/v1/marketplace/admin/banners/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(String((body as { error?: string }).error || "Failed to delete banner"));
  }
}
