import { apiJson } from "@/api/client";

export interface OpenMarketplaceChatResult {
  conversationId: string;
  created: boolean;
  productShareAdded: boolean;
  conversation?: { id: string };
}

export async function openMarketplaceChat(
  sellerId: string,
  productId: string,
): Promise<OpenMarketplaceChatResult> {
  const { res, body } = await apiJson("/v1/marketplace/chat/open", {
    method: "POST",
    body: JSON.stringify({ seller_id: sellerId, product_id: productId }),
  });
  if (!res.ok) {
    throw new Error(String((body as { error?: string }).error || "Could not start conversation"));
  }
  const data = (body as { data?: OpenMarketplaceChatResult }).data;
  if (!data?.conversationId) {
    throw new Error("Could not start conversation");
  }
  return data;
}

export async function deleteMarketplaceConversation(conversationId: string): Promise<void> {
  const { res, body } = await apiJson(`/v1/marketplace/chat/conversations/${conversationId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(String((body as { error?: string }).error || "Could not delete conversation"));
  }
}
