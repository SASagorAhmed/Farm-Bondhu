import { API_BASE, api, readSession } from "@/api/client";
import { messageTextForSend } from "@/lib/marketplaceChatMentions";
import {
  CHAT_CONTACT_BLOCKED_MESSAGE,
  isChatSendRestricted,
  scanMarketplaceChatText,
  type ChatContactBlockReason,
} from "@/lib/marketplaceChatContactGuard";

export interface MarketplaceChatGuardState {
  restrictedUntil?: string | null;
  violationCount?: number;
}

export function normalizeChatGuard(raw?: {
  restricted_until?: string | null;
  restrictedUntil?: string | null;
  violation_count?: number;
  violationCount?: number;
} | null): MarketplaceChatGuardState {
  if (!raw) return {};
  return {
    restrictedUntil: raw.restrictedUntil ?? raw.restricted_until ?? null,
    violationCount: raw.violationCount ?? raw.violation_count ?? 0,
  };
}

async function reportContactViolation(
  conversationId: string,
  reason?: ChatContactBlockReason
): Promise<MarketplaceChatGuardState | null> {
  const token = readSession()?.access_token;
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/v1/marketplace/chat/contact-violations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        reason: reason || "contact_guard",
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: MarketplaceChatGuardState & { restricted_until?: string | null; violation_count?: number } };
    return normalizeChatGuard(body.data);
  } catch {
    return null;
  }
}

export type MarketplaceSenderRole = "buyer" | "seller" | "admin";

export interface MarketplaceChatMessage {
  id: string;
  sender_id: string;
  sender_role?: MarketplaceSenderRole | string | null;
  message_type: string;
  text_body: string | null;
  shared_product_id: string | null;
  created_at: string;
  buyer_delivered_at?: string | null;
  buyer_read_at?: string | null;
  seller_delivered_at?: string | null;
  seller_read_at?: string | null;
  shared_product?: unknown;
  [key: string]: unknown;
}

export function mergeMessages<T extends { id: string; created_at?: string }>(
  prev: T[],
  incoming: T | T[]
): T[] {
  const list = Array.isArray(incoming) ? incoming : [incoming];
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const msg of list) {
    if (!msg?.id) continue;
    byId.set(msg.id, { ...byId.get(msg.id), ...msg });
  }
  return [...byId.values()].sort(
    (a, b) => new Date(String(a.created_at || 0)).getTime() - new Date(String(b.created_at || 0)).getTime()
  );
}

export function createOptimisticMessageId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function previewForConversationUpdate(messageType: string, textBody?: string, productName?: string): string {
  if (messageType === "product_share") {
    return productName ? `Shared: ${productName}` : "Shared a product";
  }
  return textBody?.trim() || "Sent a message";
}

async function touchConversation(
  conversationId: string,
  lastMessage: string,
  senderId: string,
  senderRole: MarketplaceSenderRole
): Promise<void> {
  await api
    .from("conversations")
    .update({
      last_message: lastMessage,
      last_message_at: new Date().toISOString(),
      last_sender_id: senderId,
      last_sender_role: senderRole,
    })
    .eq("id", conversationId);
}

export async function sendMarketplaceMessage<T extends MarketplaceChatMessage>(options: {
  conversationId: string;
  senderId: string;
  senderRole: MarketplaceSenderRole;
  messageType: "text" | "product_share";
  textBody?: string;
  sharedProductId?: string;
  sharedProduct?: unknown;
  productName?: string;
  chatGuard?: MarketplaceChatGuardState;
  onOptimistic: (message: T) => void;
  onConfirmed: (tempId: string, message: T) => void;
  onRollback: (tempId: string) => void;
  onError?: (message: string) => void;
  onContactBlocked?: () => void;
  onChatGuardUpdate?: (guard: MarketplaceChatGuardState) => void;
}): Promise<boolean> {
  if (options.messageType === "text") {
    if (isChatSendRestricted(options.chatGuard?.restrictedUntil)) {
      options.onError?.("Chat sending is temporarily restricted. Please try again later.");
      return false;
    }

    const scan = scanMarketplaceChatText(options.textBody || "");
    if (scan.blocked) {
      options.onContactBlocked?.();
      options.onError?.(CHAT_CONTACT_BLOCKED_MESSAGE);
      const updatedGuard = await reportContactViolation(options.conversationId, scan.reason);
      if (updatedGuard) options.onChatGuardUpdate?.(updatedGuard);
      return false;
    }
  }

  const tempId = createOptimisticMessageId();
  const optimistic = {
    id: tempId,
    conversation_id: options.conversationId,
    sender_id: options.senderId,
    sender_role: options.senderRole,
    message_type: options.messageType,
    text_body: options.messageType === "text" ? (options.textBody || "") : null,
    shared_product_id: options.messageType === "product_share" ? (options.sharedProductId || null) : null,
    shared_product: options.sharedProduct || null,
    created_at: new Date().toISOString(),
  } as T;

  options.onOptimistic(optimistic);

  const { data, error } = await api.from("chat_messages").insert({
    conversation_id: options.conversationId,
    sender_id: options.senderId,
    sender_role: options.senderRole,
    message_type: options.messageType,
    ...(options.messageType === "text" ? { text_body: options.textBody?.trim() } : {}),
    ...(options.messageType === "product_share" ? { shared_product_id: options.sharedProductId } : {}),
  });

  if (error || !data) {
    options.onRollback(tempId);
    options.onError?.(error?.message || "Failed to send message");
    return false;
  }

  const confirmed = {
    ...(data as Record<string, unknown>),
    shared_product: options.sharedProduct || null,
  } as T;
  options.onConfirmed(tempId, confirmed);

  void touchConversation(
    options.conversationId,
    previewForConversationUpdate(options.messageType, options.textBody, options.productName),
    options.senderId,
    options.senderRole
  );

  return true;
}

export async function sendTextAndProductShares<T extends MarketplaceChatMessage>(options: {
  conversationId: string;
  senderId: string;
  senderRole: MarketplaceSenderRole;
  rawText: string;
  products: { id: string; name: string; [key: string]: unknown }[];
  chatGuard?: MarketplaceChatGuardState;
  onOptimistic: (message: T) => void;
  onConfirmed: (tempId: string, message: T) => void;
  onRollback: (tempId: string) => void;
  onError?: (message: string) => void;
  onContactBlocked?: () => void;
  onChatGuardUpdate?: (guard: MarketplaceChatGuardState) => void;
}): Promise<boolean> {
  const textBody = messageTextForSend(options.rawText);
  const callbacks = {
    onOptimistic: options.onOptimistic,
    onConfirmed: options.onConfirmed,
    onRollback: options.onRollback,
    onError: options.onError,
  };

  if (textBody) {
    const textOk = await sendMarketplaceMessage<T>({
      conversationId: options.conversationId,
      senderId: options.senderId,
      senderRole: options.senderRole,
      messageType: "text",
      textBody,
      chatGuard: options.chatGuard,
      onContactBlocked: options.onContactBlocked,
      onChatGuardUpdate: options.onChatGuardUpdate,
      ...callbacks,
    });
    if (!textOk) return false;
  }

  for (const product of options.products) {
    const ok = await sendMarketplaceMessage<T>({
      conversationId: options.conversationId,
      senderId: options.senderId,
      senderRole: options.senderRole,
      messageType: "product_share",
      sharedProductId: product.id,
      sharedProduct: product,
      productName: product.name,
      ...callbacks,
    });
    if (!ok) return false;
  }

  return true;
}

export async function sendTextAndProductShare<T extends MarketplaceChatMessage>(options: {
  conversationId: string;
  senderId: string;
  senderRole: MarketplaceSenderRole;
  rawText: string;
  product: { id: string; name: string; [key: string]: unknown };
  onOptimistic: (message: T) => void;
  onConfirmed: (tempId: string, message: T) => void;
  onRollback: (tempId: string) => void;
  onError?: (message: string) => void;
}): Promise<boolean> {
  return sendTextAndProductShares<T>({
    ...options,
    products: [options.product],
  });
}
