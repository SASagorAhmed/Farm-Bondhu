export type MarketplaceChatRole = "buyer" | "seller" | "admin";

export const ADMIN_SUPPORT_MESSAGE_LABEL = "Platform support from admin";

export function isAdminSupportMessage(msg: { sender_role?: string | null }): boolean {
  return msg.sender_role === "admin";
}

function normalizeParticipantId(id: string | undefined | null): string {
  return String(id || "").trim().toLowerCase();
}

export function isSelfShopChat(buyerId: string | undefined, sellerId: string | undefined): boolean {
  const buyer = normalizeParticipantId(buyerId);
  const seller = normalizeParticipantId(sellerId);
  if (!buyer || !seller) return false;
  return buyer === seller;
}

export function resolveSelfShopThread(
  convo:
    | {
        buyer_id?: string | null;
        seller_id?: string | null;
        is_self_chat?: boolean | null;
      }
    | null
    | undefined
): boolean {
  if (!convo) return false;
  return Boolean(convo.is_self_chat) || isSelfShopChat(convo.buyer_id ?? undefined, convo.seller_id ?? undefined);
}

export function messageRole(
  msg: { sender_role?: string | null },
  fallback: MarketplaceChatRole = "buyer"
): MarketplaceChatRole {
  return msg.sender_role === "seller" ? "seller" : msg.sender_role === "buyer" ? "buyer" : fallback;
}

export function isSameParticipant(a: string | undefined | null, b: string | undefined | null): boolean {
  const left = normalizeParticipantId(a);
  const right = normalizeParticipantId(b);
  return Boolean(left && right && left === right);
}

export const MARKETPLACE_SUPPORT_SHOP_LABEL = "FarmBondhu Support";

/** Buyer messaging a real shop (not own-shop or platform support). */
export function isMarketplaceShopBuyerChat(
  convo:
    | {
        buyer_id?: string | null;
        seller_id?: string | null;
        shop_name?: string | null;
        is_self_chat?: boolean | null;
      }
    | null
    | undefined,
  userId: string | undefined | null
): boolean {
  if (!convo || !userId) return false;
  if (!isSameParticipant(userId, convo.buyer_id)) return false;
  if (resolveSelfShopThread(convo)) return false;
  if (convo.shop_name === MARKETPLACE_SUPPORT_SHOP_LABEL) return false;
  return true;
}

/** Seller-side shop thread (includes own-shop test threads; excludes FarmBondhu Support). */
export function isSellerShopThread(
  convo:
    | {
        buyer_id?: string | null;
        seller_id?: string | null;
        shop_name?: string | null;
        is_self_chat?: boolean | null;
      }
    | null
    | undefined,
  userId: string | undefined | null
): boolean {
  if (!convo || !userId) return false;
  if (!isSameParticipant(userId, convo.seller_id)) return false;
  if (convo.shop_name === MARKETPLACE_SUPPORT_SHOP_LABEL) return false;
  return true;
}

/** Buyer-side shop thread (includes own-shop test threads; excludes FarmBondhu Support). */
export function isBuyerShopThread(
  convo:
    | {
        buyer_id?: string | null;
        seller_id?: string | null;
        shop_name?: string | null;
        is_self_chat?: boolean | null;
      }
    | null
    | undefined,
  userId: string | undefined | null
): boolean {
  if (!convo || !userId) return false;
  if (!isSameParticipant(userId, convo.buyer_id)) return false;
  if (convo.shop_name === MARKETPLACE_SUPPORT_SHOP_LABEL) return false;
  return true;
}

function hasExplicitDualRole(msg: { sender_role?: string | null }): msg is { sender_role: "buyer" | "seller" } {
  return msg.sender_role === "buyer" || msg.sender_role === "seller";
}

/** Buyer-side bubble in product chat (right). */
export function isBuyerSideMessage(
  msg: { sender_id: string; sender_role?: string | null },
  userId: string | undefined,
  selfChat: boolean
): boolean {
  if (hasExplicitDualRole(msg) && isSameParticipant(msg.sender_id, userId)) {
    return msg.sender_role === "buyer";
  }
  if (selfChat) return messageRole(msg) === "buyer";
  return isSameParticipant(msg.sender_id, userId);
}

/** Seller-side bubble in seller inbox (right). */
export function isSellerSideMessage(
  msg: { sender_id: string; sender_role?: string | null },
  sellerId: string,
  selfChat: boolean
): boolean {
  if (hasExplicitDualRole(msg) && isSameParticipant(msg.sender_id, sellerId)) {
    return msg.sender_role === "seller";
  }
  if (selfChat) return messageRole(msg) === "seller";
  return isSameParticipant(msg.sender_id, sellerId);
}

export function lastMessageRole(
  lastSenderRole: string | null | undefined,
  selfChat: boolean,
  lastSenderId: string | null | undefined,
  sellerId: string
): MarketplaceChatRole {
  if (lastSenderRole === "seller" || lastSenderRole === "buyer") return lastSenderRole;
  if (!selfChat && lastSenderId === sellerId) return "seller";
  if (!selfChat && lastSenderId) return "buyer";
  return "buyer";
}

export type SelfShopThreadSurface = "productChat" | "sellerInbox";

/** Per-bubble label for own-shop threads; product chat matches normal chats (no labels). */
export function selfShopThreadLabel(
  msg: { sender_role?: string | null },
  _shopName: string | null | undefined,
  buyerName: string | null | undefined,
  surface: SelfShopThreadSurface
): string | null {
  if (surface === "productChat") return null;
  return messageRole(msg) === "seller" ? "You" : buyerName || "Buyer";
}

/** Inbox preview prefix for own-shop last message. */
export function selfShopLastMessagePreview(
  lastSenderRole: string | null | undefined,
  buyerName: string | null | undefined,
  text: string
): string {
  const role = lastMessageRole(lastSenderRole, true, null, "");
  if (role === "seller") return `You: ${text}`;
  return `${buyerName || "Buyer"}: ${text}`;
}

/** Legacy helper — anchor product_share matching conversations.product_id (pinned first in thread). */
export function isConversationAnchorProductShare(
  msg: { message_type: string; shared_product_id?: string | null },
  conversationProductId: string | null | undefined
): boolean {
  return (
    msg.message_type === "product_share" &&
    Boolean(conversationProductId) &&
    msg.shared_product_id === conversationProductId
  );
}
