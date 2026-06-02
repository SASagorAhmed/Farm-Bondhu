import type { QueryClient } from "@tanstack/react-query";
import type { MarketplaceChatRole } from "@/lib/marketplaceChatRoles";

export interface InboxUnreadFields {
  id: string;
  buyer_id?: string;
  seller_id?: string;
  last_sender_id?: string | null;
  last_sender_role?: string | null;
  has_unread?: boolean;
}

export function isInboundConversationUpdate(
  lastSenderRole: string | null | undefined,
  viewerRole: MarketplaceChatRole
): boolean {
  const role = String(lastSenderRole || "");
  if (viewerRole === "buyer") return role === "seller" || role === "admin";
  if (viewerRole === "seller") return role === "buyer";
  return false;
}

export function viewerRoleForConversation(
  userId: string,
  row: Pick<InboxUnreadFields, "buyer_id" | "seller_id">
): MarketplaceChatRole | null {
  const uid = String(userId || "").trim().toLowerCase();
  const buyerId = String(row.buyer_id || "").trim().toLowerCase();
  const sellerId = String(row.seller_id || "").trim().toLowerCase();
  if (uid === buyerId) return "buyer";
  if (uid === sellerId) return "seller";
  return null;
}

export function isBuyerInboxConversation(
  row: Pick<InboxUnreadFields, "buyer_id">,
  userId: string
): boolean {
  const uid = String(userId || "").trim().toLowerCase();
  const buyerId = String(row.buyer_id || "").trim().toLowerCase();
  return Boolean(uid && buyerId && uid === buyerId);
}

export function isSellerInboxConversation(
  row: Pick<InboxUnreadFields, "seller_id">,
  sellerId: string
): boolean {
  const sid = String(sellerId || "").trim().toLowerCase();
  const rowSellerId = String(row.seller_id || "").trim().toLowerCase();
  return Boolean(sid && rowSellerId && sid === rowSellerId);
}

export function isInboundMessageForUser(row: InboxUnreadFields, userId: string): boolean {
  const uid = String(userId || "").trim().toLowerCase();
  const buyerId = String(row.buyer_id || "").trim().toLowerCase();
  const sellerId = String(row.seller_id || "").trim().toLowerCase();
  const isBuyer = Boolean(uid && buyerId && uid === buyerId);
  const isSeller = Boolean(uid && sellerId && uid === sellerId);
  if (!isBuyer && !isSeller) return false;

  const role = String(row.last_sender_role || "");
  const selfChat = Boolean(buyerId && sellerId && buyerId === sellerId);

  if (selfChat) {
    return role === "buyer" || role === "seller" || role === "admin";
  }

  const inboundForBuyer = isBuyer && isInboundConversationUpdate(role, "buyer");
  const inboundForSeller = isSeller && isInboundConversationUpdate(role, "seller");
  return inboundForBuyer || inboundForSeller;
}

export function inboundAlertViewerRole(
  row: InboxUnreadFields,
  userId: string
): MarketplaceChatRole | null {
  if (!isInboundMessageForUser(row, userId)) return null;

  const uid = String(userId || "").trim().toLowerCase();
  const buyerId = String(row.buyer_id || "").trim().toLowerCase();
  const sellerId = String(row.seller_id || "").trim().toLowerCase();
  const role = String(row.last_sender_role || "");
  const selfChat = Boolean(buyerId && sellerId && buyerId === sellerId);

  if (selfChat) {
    if (role === "seller" || role === "admin") return "buyer";
    if (role === "buyer") return "seller";
    return null;
  }

  if (uid === buyerId && isInboundConversationUpdate(role, "buyer")) return "buyer";
  if (uid === sellerId && isInboundConversationUpdate(role, "seller")) return "seller";
  return null;
}

export type InboxPollSnapshot = {
  last_message_at?: string | null;
  last_sender_role?: string | null;
};

export function shouldNotifyFromInboxPoll(
  row: InboxUnreadFields & InboxPollSnapshot,
  userId: string,
  prev: InboxPollSnapshot | undefined
): boolean {
  if (!row.id || !isInboundMessageForUser(row, userId)) return false;
  if (!row.has_unread) return false;
  if (!prev) return false;
  const changed =
    prev.last_message_at !== row.last_message_at ||
    prev.last_sender_role !== row.last_sender_role;
  return changed;
}

export function shouldShowToastForConversation(
  row: InboxUnreadFields,
  userId: string,
  activeConversationId: string | null | undefined,
  activeViewerRole?: MarketplaceChatRole | null
): boolean {
  if (!isInboundMessageForUser(row, userId)) return false;
  const alertRole = inboundAlertViewerRole(row, userId);
  if (!alertRole) return false;
  if (
    activeConversationId &&
    row.id === activeConversationId &&
    activeViewerRole === alertRole
  ) {
    return false;
  }
  return true;
}

/** @deprecated Use shouldShowToastForConversation for toasts; isInboundMessageForUser for sound. */
export function shouldAlertForConversation(
  row: InboxUnreadFields,
  userId: string,
  activeConversationId: string | null | undefined,
  activeViewerRole?: MarketplaceChatRole | null
): boolean {
  return shouldShowToastForConversation(row, userId, activeConversationId, activeViewerRole);
}

export function patchInboxUnread(
  queryClient: QueryClient,
  userId: string,
  conversationId: string,
  hasUnread: boolean
): void {
  queryClient.setQueryData<InboxUnreadFields[]>(["buyer-inbox", userId], (prev) => {
    if (!prev) return prev;
    return prev.map((c) => (c.id === conversationId ? { ...c, has_unread: hasUnread } : c));
  });
}

export function buyerInboxPreview(
  lastSenderRole: string | null | undefined,
  lastSenderId: string | null | undefined,
  userId: string,
  text: string
): string {
  if (lastSenderRole === "buyer") return `You: ${text}`;
  if (lastSenderRole === "seller" || lastSenderRole === "admin") return text;
  if (lastSenderId && lastSenderId === userId) return `You: ${text}`;
  return text;
}
