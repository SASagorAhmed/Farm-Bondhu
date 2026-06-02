import { API_BASE, readSession } from "@/api/client";
import type { MarketplaceChatRole } from "@/lib/marketplaceChatRoles";
import type { MarketplaceSenderRole } from "@/lib/marketplaceChatSend";

export type ReceiptStatus = "sending" | "sent" | "delivered" | "seen";
export type ReceiptLevel = "delivered" | "read";

export interface ChatReceiptFields {
  id: string;
  sender_role?: string | null;
  buyer_delivered_at?: string | null;
  buyer_read_at?: string | null;
  seller_delivered_at?: string | null;
  seller_read_at?: string | null;
}

function recipientPrefixForSender(senderRole: MarketplaceSenderRole): "buyer" | "seller" {
  return senderRole === "buyer" ? "seller" : "buyer";
}

export function getOutboundReceiptStatus(
  msg: ChatReceiptFields,
  mySenderRole: MarketplaceSenderRole
): ReceiptStatus {
  if (String(msg.id).startsWith("local-")) return "sending";

  const prefix = recipientPrefixForSender(mySenderRole);
  const deliveredAt = prefix === "buyer" ? msg.buyer_delivered_at : msg.seller_delivered_at;
  const readAt = prefix === "buyer" ? msg.buyer_read_at : msg.seller_read_at;

  if (readAt) return "seen";
  if (deliveredAt) return "delivered";
  return "sent";
}

export function applyLocalReceiptUpdates<T extends ChatReceiptFields>(
  messages: T[],
  viewerRole: MarketplaceChatRole,
  level: ReceiptLevel
): T[] {
  const now = new Date().toISOString();
  const incomingRole = viewerRole === "buyer" ? "seller" : "buyer";

  return messages.map((m) => {
    if (m.sender_role !== incomingRole) return m;
    if (viewerRole === "buyer") {
      return {
        ...m,
        buyer_delivered_at: m.buyer_delivered_at || now,
        buyer_read_at: level === "read" ? m.buyer_read_at || now : m.buyer_read_at,
      };
    }
    return {
      ...m,
      seller_delivered_at: m.seller_delivered_at || now,
      seller_read_at: level === "read" ? m.seller_read_at || now : m.seller_read_at,
    };
  });
}

export async function markConversationReceipts(
  conversationId: string,
  viewerRole: MarketplaceChatRole,
  level: ReceiptLevel
): Promise<boolean> {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}/v1/marketplace/chat/conversations/${conversationId}/receipts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ level, viewer_role: viewerRole }),
  });
  return res.ok;
}
