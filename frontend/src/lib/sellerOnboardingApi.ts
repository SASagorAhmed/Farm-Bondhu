import { API_BASE, readSession } from "@/api/client";
import type { SellerOnboardingMe } from "@/lib/marketplaceLaneLabels";

export interface SellerOnboardingLaneInput {
  lane: string;
  license_number?: string | null;
  license_file_url?: string | null;
}

export interface SellerOnboardingPayload {
  business_name: string;
  phone: string;
  location: string;
  lanes: SellerOnboardingLaneInput[];
}

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

export async function fetchSellerOnboardingMe(): Promise<SellerOnboardingMe | null> {
  const { ok, data } = await authJson<SellerOnboardingMe>("/v1/marketplace/seller-onboarding/me");
  return ok && data ? data : null;
}

export async function submitSellerOnboarding(payload: SellerOnboardingPayload) {
  return authJson("/v1/marketplace/seller-onboarding", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resubmitSellerLanes(lanes: SellerOnboardingLaneInput[]) {
  return authJson("/v1/marketplace/seller-onboarding/resubmit", {
    method: "POST",
    body: JSON.stringify({ lanes }),
  });
}

export async function uploadSellerLicense(fileData: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}/v1/marketplace/seller-onboarding/upload-license`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ file: fileData }),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: { url?: string }; error?: string };
  if (!res.ok) return { ok: false, error: body.error || res.statusText };
  return { ok: true, url: body.data?.url };
}

export async function adminReviewSellerLane(
  userId: string,
  lane: string,
  action: "approve" | "reject",
  review_notes?: string
) {
  return authJson(`/v1/marketplace/admin/seller-lanes/${encodeURIComponent(userId)}/${encodeURIComponent(lane)}`, {
    method: "PATCH",
    body: JSON.stringify({ action, review_notes }),
  });
}

export type AdminSellerLaneRow = {
  user_id: string;
  lane: string;
  status: "pending" | "approved" | "rejected";
  license_number?: string | null;
  license_file_url?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  user_name?: string;
  user_email?: string;
  request_details?: {
    business_name?: string;
    phone?: string;
    location?: string;
    lanes?: SellerOnboardingLaneInput[];
  };
};

export async function adminListSellerLanes(status = "pending", userId?: string) {
  const params = new URLSearchParams({ status });
  if (userId) params.set("user_id", userId);
  return authJson<AdminSellerLaneRow[]>(`/v1/marketplace/admin/seller-lanes?${params.toString()}`);
}

export async function adminListSellerLanesForUser(userId: string, status = "all") {
  return adminListSellerLanes(status, userId);
}

export async function adminListPendingProducts() {
  return authJson<Record<string, unknown>[]>("/v1/marketplace/admin/products/listings?listing_status=pending_review");
}

export async function adminModerateProductListing(
  productId: string,
  action: "approve" | "reject",
  review_notes?: string
) {
  return authJson(`/v1/marketplace/admin/products/${encodeURIComponent(productId)}/listing`, {
    method: "PATCH",
    body: JSON.stringify({ action, review_notes }),
  });
}
