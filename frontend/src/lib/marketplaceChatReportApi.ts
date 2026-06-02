import { API_BASE, readSession } from "@/api/client";

export interface ModerationReportRow {
  id: string;
  type: "community" | "marketplace";
  status: "pending" | "resolved";
  reason: string;
  details?: string | null;
  created_at: string;
  reporter: { id: string; name: string; role?: string };
  target: {
    summary: string;
    conversation_id?: string | null;
    post_id?: string | null;
    comment_id?: string | null;
    buyer_name?: string | null;
    seller_name?: string | null;
    shop_name?: string | null;
    seller_phone?: string | null;
    product_name?: string | null;
  };
  action_url: string;
}

export async function submitConversationReport(
  conversationId: string,
  reason: string,
  details?: string
): Promise<{ ok: true } | { ok: false; message: string; alreadyReported?: boolean }> {
  const token = readSession()?.access_token;
  if (!token) return { ok: false, message: "Please sign in to report" };

  const res = await fetch(`${API_BASE}/v1/marketplace/chat/conversations/${conversationId}/report`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason, details: details || undefined }),
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (res.status === 409 || body.code === "already_reported") {
    return { ok: false, message: "You have already reported this conversation", alreadyReported: true };
  }
  if (!res.ok) {
    return { ok: false, message: body.error || "Failed to submit report" };
  }
  return { ok: true };
}

export async function fetchModerationReports(opts?: {
  type?: "all" | "community" | "marketplace";
  status?: "pending" | "resolved" | "all";
}): Promise<ModerationReportRow[]> {
  const token = readSession()?.access_token;
  if (!token) return [];

  const params = new URLSearchParams();
  if (opts?.type) params.set("type", opts.type);
  if (opts?.status) params.set("status", opts.status);

  const res = await fetch(`${API_BASE}/v1/admin/moderation-reports?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: ModerationReportRow[] };
  return body.data || [];
}

export async function resolveMarketplaceModerationReport(reportId: string): Promise<boolean> {
  const token = readSession()?.access_token;
  if (!token) return false;

  const res = await fetch(`${API_BASE}/v1/admin/moderation-reports/marketplace/${reportId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}
