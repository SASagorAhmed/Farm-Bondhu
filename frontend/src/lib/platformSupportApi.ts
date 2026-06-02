import { apiJson } from "@/api/client";

export type SupportTopic = "help" | "complaint";

export type SupportInboxRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  support_topic: SupportTopic | null;
  support_status: "open" | "resolved" | null;
  last_message: string;
  last_message_at: string;
  shop_name: string | null;
};

export type PlatformSupportMeta = {
  seller_id: string;
  shop_name: string;
  support_product_id: string;
};

export async function fetchPlatformSupportMeta(): Promise<PlatformSupportMeta> {
  const { res, body } = await apiJson("/v1/marketplace/admin/platform-support/meta");
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Support not configured"));
  return (body as { data: PlatformSupportMeta }).data;
}

export async function openSupportConversation(params: {
  topic: SupportTopic;
  message?: string;
}): Promise<{ conversation_id: string; support_topic: SupportTopic; support_status: string }> {
  const { res, body } = await apiJson("/v1/marketplace/chat/support/open", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Could not open support chat"));
  return (body as { data: { conversation_id: string; support_topic: SupportTopic; support_status: string } }).data;
}

export async function fetchSupportInbox(): Promise<SupportInboxRow[]> {
  const { res, body } = await apiJson("/v1/marketplace/chat/support/inbox");
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load support chats"));
  return (body as { data: SupportInboxRow[] }).data || [];
}

export async function resolveSupportConversation(conversationId: string): Promise<void> {
  const { res, body } = await apiJson(`/v1/marketplace/chat/support/${conversationId}/resolve`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Could not resolve conversation"));
}
