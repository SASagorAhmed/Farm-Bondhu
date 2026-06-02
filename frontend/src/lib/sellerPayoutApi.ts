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

export type SellerOrderEarningRow = {
  id: string;
  buyer_name: string;
  total: number;
  status: string;
  payment_status: string | null;
  created_at: string;
  updated_at?: string;
  delivered_at: string;
};

export type SellerEarningsExcludedStatus = {
  status: string;
  count: number;
  total_amount: number;
};

export type SellerEarningsBreakdown = {
  eligibility_rule: string;
  included_orders: SellerOrderEarningRow[];
  included_total: number;
  included_count: number;
  excluded_by_status: SellerEarningsExcludedStatus[];
  excluded_sample: SellerOrderEarningRow[];
  summary: SellerEarningsSummary;
  verification: {
    listed_included_sum: number;
    gross_earnings: number;
    matches: boolean;
  };
};

export type SellerEarningsSummary = {
  gross_earnings: number;
  order_count: number;
  monthly_gross: number;
  platform_fee_rate: number;
  platform_fee: number;
  net_earnings: number;
  withdrawn_total: number;
  pending_withdraw_total: number;
  available_balance: number;
  monthly_trend: { month: string; amount: number }[];
  history: SellerOrderEarningRow[];
};

export type SellerWithdrawalRow = {
  id: string;
  request_amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  note?: string | null;
  review_note?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

export async function fetchSellerEarningsSummary(): Promise<SellerEarningsSummary> {
  const { ok, data, error } = await authJson<SellerEarningsSummary>(
    "/v1/marketplace/seller/earnings/summary?history_limit=100",
  );
  if (!ok || !data) throw new Error(error || "Failed to load earnings");
  return data;
}

export async function fetchSellerEarningsBreakdown(): Promise<SellerEarningsBreakdown> {
  const { ok, data, error } = await authJson<SellerEarningsBreakdown>(
    "/v1/marketplace/seller/earnings/breakdown",
  );
  if (!ok || !data) throw new Error(error || "Failed to load earnings breakdown");
  return data;
}

export async function fetchSellerWithdrawals(): Promise<SellerWithdrawalRow[]> {
  const { ok, data, error } = await authJson<SellerWithdrawalRow[]>(
    "/v1/marketplace/seller/withdrawals",
  );
  if (!ok) {
    console.warn("[sellerPayoutApi] withdrawals:", error || "Failed to load withdrawals");
    return [];
  }
  return data || [];
}

export async function createSellerWithdrawalRequest(payload: {
  request_amount: number;
  note?: string | null;
}): Promise<SellerWithdrawalRow> {
  const { ok, data, error } = await authJson<SellerWithdrawalRow>(
    "/v1/marketplace/seller/withdrawals",
    { method: "POST", body: JSON.stringify(payload) },
  );
  if (!ok || !data) throw new Error(error || "Withdrawal request failed");
  return data;
}

export type AdminSellerWithdrawalRow = SellerWithdrawalRow & {
  seller_user_id: string;
  seller_name?: string | null;
  seller_email?: string | null;
  shop_name?: string | null;
  gross_earnings?: number;
  platform_fee?: number;
  net_earnings?: number;
  available_balance?: number;
};

export async function fetchAdminSellerWithdrawals(status?: string): Promise<AdminSellerWithdrawalRow[]> {
  const qs = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  const { ok, data, error } = await authJson<AdminSellerWithdrawalRow[]>(
    `/v1/marketplace/admin/seller-withdrawals${qs}`,
  );
  if (!ok) throw new Error(error || "Failed to load seller withdrawals");
  return data || [];
}

export type AdminSellerWithdrawalDetails = {
  request: AdminSellerWithdrawalRow;
  summary: SellerEarningsSummary;
  orders: SellerOrderEarningRow[];
  seller_profile: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    shop_name?: string | null;
    shop_description?: string | null;
  };
  request_history: SellerWithdrawalRow[];
};

export async function fetchAdminSellerWithdrawalDetails(
  id: string,
): Promise<AdminSellerWithdrawalDetails> {
  const { ok, data, error } = await authJson<AdminSellerWithdrawalDetails>(
    `/v1/marketplace/admin/seller-withdrawals/${encodeURIComponent(id)}/details`,
  );
  if (!ok || !data) throw new Error(error || "Failed to load withdrawal details");
  return data;
}

export async function reviewAdminSellerWithdrawal(
  id: string,
  action: "approve" | "reject",
  note?: string | null,
): Promise<AdminSellerWithdrawalRow> {
  const { ok, data, error } = await authJson<AdminSellerWithdrawalRow>(
    `/v1/marketplace/admin/seller-withdrawals/${encodeURIComponent(id)}/${action}`,
    {
      method: "POST",
      body: JSON.stringify({ note: note?.trim() || null }),
    },
  );
  if (!ok || !data) throw new Error(error || `Failed to ${action} withdrawal`);
  return data;
}
