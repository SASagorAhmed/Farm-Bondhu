/** Re-highlight anchor product card after this idle gap (ms) when buyer sends text. */
export const CHAT_PRODUCT_RESURFACE_IDLE_MS = 30 * 60 * 1000;
/** Brief highlight duration when thread opens or anchor is restored. */
export const CHAT_PRODUCT_OPEN_HIGHLIGHT_MS = 3000;

export interface ChatProductReference {
  id: string;
  name: string;
  price: number;
  image: string;
  location?: string | null;
  rating?: number | null;
  stock?: number | null;
  category?: string | null;
}

export function productReferenceFromInboxFields(fields: {
  product_id?: string | null;
  product_name?: string | null;
  product_image?: string | null;
  product_price?: number | null;
  product_category?: string | null;
}): ChatProductReference | null {
  if (!fields.product_id || !fields.product_name) return null;
  return {
    id: fields.product_id,
    name: fields.product_name,
    price: fields.product_price ?? 0,
    image: fields.product_image || "",
    category: fields.product_category ?? null,
  };
}

export interface ThreadMessageLike {
  id?: string;
  message_type: string;
  shared_product_id?: string | null;
  created_at?: string;
}

function sortByCreatedAt<T extends ThreadMessageLike>(a: T, b: T): number {
  return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
}

/** Earliest product_share for the conversation product — the bootstrap anchor only. */
export function getConversationAnchorMessageId<T extends ThreadMessageLike>(
  messages: T[],
  conversationProductId: string | null | undefined
): string | null {
  if (!conversationProductId) return null;
  const anchor = [...messages]
    .sort(sortByCreatedAt)
    .find(
      (m) =>
        m.message_type === "product_share" && m.shared_product_id === conversationProductId
    );
  return anchor?.id ?? null;
}

/** Split bootstrap anchor product_share from other messages (later shares stay chronological). */
export function partitionAnchorProductMessages<T extends ThreadMessageLike>(
  messages: T[],
  conversationProductId: string | null | undefined
): { anchor: T[]; rest: T[] } {
  if (!conversationProductId) {
    return { anchor: [], rest: [...messages].sort(sortByCreatedAt) };
  }
  const anchorId = getConversationAnchorMessageId(messages, conversationProductId);
  if (!anchorId) {
    return { anchor: [], rest: [...messages].sort(sortByCreatedAt) };
  }
  const anchor = messages.filter((m) => m.id === anchorId);
  const rest = messages.filter((m) => m.id !== anchorId).sort(sortByCreatedAt);
  return { anchor, rest };
}

/** Bootstrap anchor bubble first, then the rest in send order. */
export function orderedThreadMessages<T extends ThreadMessageLike>(
  messages: T[],
  conversationProductId: string | null | undefined,
  options?: { pinAnchor?: boolean }
): T[] {
  if (options?.pinAnchor === false) {
    return chronologicalThreadMessages(messages);
  }
  const { anchor, rest } = partitionAnchorProductMessages(messages, conversationProductId);
  return [...anchor, ...rest];
}

/** All messages in send order (no pinned product at top). */
export function chronologicalThreadMessages<T extends ThreadMessageLike>(messages: T[]): T[] {
  return [...messages].sort(sortByCreatedAt);
}

export function isAnchorProductShareMessage(
  msg: ThreadMessageLike,
  conversationProductId: string | null | undefined,
  allMessages?: ThreadMessageLike[]
): boolean {
  if (!allMessages) {
    return (
      msg.message_type === "product_share" &&
      Boolean(conversationProductId) &&
      msg.shared_product_id === conversationProductId
    );
  }
  const anchorId = getConversationAnchorMessageId(allMessages, conversationProductId);
  return Boolean(anchorId && msg.id === anchorId);
}
