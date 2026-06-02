import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, API_BASE, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMarketplaceChatFocus } from "@/contexts/MarketplaceChatFocusContext";
import { notifyIncomingChatMessage, loadChatSoundPreference, setupChatAudioUnlock } from "@/lib/marketplaceChatAlerts";
import {
  isInboundMessageForUser,
  shouldNotifyFromInboxPoll,
  shouldShowToastForConversation,
  isInboundConversationUpdate,
} from "@/lib/marketplaceChatUnread";
import {
  isChatAlertAlreadyAcked,
  seedChatAlertAcksForReadRows,
  setChatAlertAck,
} from "@/lib/marketplaceChatAlertAck";
import { isMarketplaceChatRealtimeAvailable } from "@/lib/marketplaceChatRealtime";

type ConversationRow = {
  id?: string;
  buyer_id?: string;
  seller_id?: string;
  last_message?: string | null;
  last_message_at?: string | null;
  last_sender_id?: string | null;
  last_sender_role?: string | null;
  conversation_kind?: string | null;
  shop_name?: string | null;
  buyer_name?: string | null;
  has_unread?: boolean;
};

type ChatMessageRow = {
  id?: string;
  conversation_id?: string;
  sender_role?: string | null;
  text_body?: string | null;
  message_type?: string | null;
};

function sellerMessagesPath(conversationId: string | undefined): string {
  return conversationId
    ? `/seller/dashboard?tab=messages&convo=${conversationId}`
    : "/seller/dashboard?tab=messages";
}

function alertMeta(row: ConversationRow, userId: string): { title: string; path: string } {
  const uid = String(userId || "").trim().toLowerCase();
  const buyerId = String(row.buyer_id || "").trim().toLowerCase();
  const sellerId = String(row.seller_id || "").trim().toLowerCase();
  const isBuyer = Boolean(uid && buyerId && uid === buyerId);
  const isSeller = Boolean(uid && sellerId && uid === sellerId);
  const role = String(row.last_sender_role || "");
  const selfChat = Boolean(buyerId && sellerId && buyerId === sellerId);

  if (selfChat) {
    if (role === "buyer" && isSeller) {
      return {
        title: row.buyer_name || "Your shop",
        path: sellerMessagesPath(row.id),
      };
    }
    if (role === "seller" && isBuyer) {
      return { title: row.shop_name || "New message", path: `/marketplace/chat/${row.id}` };
    }
  }

  const inboundForSeller = isSeller && isInboundConversationUpdate(role, "seller");
  if (inboundForSeller) {
    return {
      title: row.buyer_name || "New message",
      path: sellerMessagesPath(row.id),
    };
  }
  return { title: row.shop_name || "New message", path: `/marketplace/chat/${row.id}` };
}

async function fetchConversationAlertMeta(
  conversationId: string
): Promise<Pick<ConversationRow, "shop_name" | "buyer_name">> {
  const token = readSession()?.access_token;
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const res = await fetch(`${API_BASE}/v1/marketplace/chat/conversations/${conversationId}/bootstrap`, {
      headers,
    });
    if (!res.ok) return {};
    const body = (await res.json()) as {
      data?: { conversation?: { shop_name?: string; other_name?: string } };
    };
    const conversation = body.data?.conversation;
    return {
      shop_name: conversation?.shop_name ?? null,
      buyer_name: conversation?.other_name ?? null,
    };
  } catch {
    return {};
  }
}

function notifyForRow(
  row: ConversationRow,
  uid: string,
  activeConversationId: string | null | undefined,
  activeViewerRole: ReturnType<typeof useMarketplaceChatFocus>["activeViewerRole"],
  body: string,
  navigate: ReturnType<typeof useNavigate>,
  soundLabels: {
    enableToast: string;
    enableButton: string;
    openSettingsButton: string;
    testOk: string;
  },
  openMessageLabel: string,
  debounceKey?: string,
  options?: { recordAck?: boolean }
): void {
  if (!row.id || !isInboundMessageForUser(row, uid)) return;

  const suppressToast = !shouldShowToastForConversation(
    row,
    uid,
    activeConversationId,
    activeViewerRole
  );
  const { title, path } = alertMeta(row, uid);
  notifyIncomingChatMessage({
    title,
    body,
    onNavigate: () => navigate(path),
    soundLabels,
    openMessageLabel,
    suppressToast,
    soundDebounceKey: debounceKey || `convo-${row.id}-${row.last_message_at || Date.now()}`,
  });
  if (options?.recordAck !== false && row.last_message_at) {
    setChatAlertAck(uid, row.id, row.last_message_at);
  }
}

function isAdminWorkspacePath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function useMarketplaceChatAlerts(): void {
  const { user, hasCapability } = useAuth();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const { activeConversationId, activeViewerRole } = useMarketplaceChatFocus();
  const navigate = useNavigate();
  const onAdminRoute = isAdminWorkspacePath(pathname);
  const activeIdRef = useRef(activeConversationId);
  const activeRoleRef = useRef(activeViewerRole);
  activeIdRef.current = activeConversationId;
  activeRoleRef.current = activeViewerRole;

  const soundLabels = useRef({
    enableToast: t("chat.soundEnableToast"),
    enableButton: t("chat.soundEnableButton"),
    openSettingsButton: t("chat.soundOpenSettings"),
    testOk: t("chat.soundTestOk"),
  });
  soundLabels.current = {
    enableToast: t("chat.soundEnableToast"),
    enableButton: t("chat.soundEnableButton"),
    openSettingsButton: t("chat.soundOpenSettings"),
    testOk: t("chat.soundTestOk"),
  };
  const openMessageLabel = t("chat.openMessage");

  const inboxSnapshotRef = useRef<Map<string, { last_message_at?: string; last_sender_role?: string | null }>>(
    new Map()
  );

  useEffect(() => setupChatAudioUnlock(), []);

  useEffect(() => {
    if (!user?.id) return;
    void loadChatSoundPreference();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || onAdminRoute) return;

    const uid = user.id;

    const handleMessageInsert = async (msg: ChatMessageRow) => {
      if (!msg.conversation_id) return;
      if (msg.message_type === "product_share") return;

      const { data: convo } = await api
        .from("conversations")
        .select("id, buyer_id, seller_id, conversation_kind")
        .eq("id", msg.conversation_id)
        .maybeSingle();

      if (!convo?.id) return;
      if (convo.conversation_kind && convo.conversation_kind !== "marketplace") return;

      const meta = await fetchConversationAlertMeta(convo.id);

      const row: ConversationRow = {
        id: convo.id,
        buyer_id: convo.buyer_id,
        seller_id: convo.seller_id,
        last_sender_role: msg.sender_role,
        shop_name: meta.shop_name,
        buyer_name: meta.buyer_name,
      };

      notifyForRow(
        row,
        uid,
        activeIdRef.current,
        activeRoleRef.current,
        msg.text_body || "New message",
        navigate,
        soundLabels.current,
        openMessageLabel,
        `msg-${msg.id || msg.conversation_id}`
      );
    };

    const channel = api
      .channel(`chat-alerts-${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          void handleMessageInsert(payload.new as ChatMessageRow);
        }
      )
      .subscribe();

    return () => {
      api.removeChannel(channel);
    };
  }, [navigate, onAdminRoute, openMessageLabel, user?.id, t]);

  useEffect(() => {
    if (!user?.id || onAdminRoute || isMarketplaceChatRealtimeAvailable()) return;

    let cancelled = false;
    const canPollSeller = hasCapability("can_sell");
    const pollInitializedRef = { current: false };

    const processPollRows = (rows: ConversationRow[], seedOnly: boolean) => {
      if (seedOnly) {
        seedChatAlertAcksForReadRows(user.id, rows);
      }
      for (const row of rows) {
        if (!row.id) continue;
        const prev = inboxSnapshotRef.current.get(row.id);

        if (seedOnly) {
          inboxSnapshotRef.current.set(row.id, {
            last_message_at: row.last_message_at,
            last_sender_role: row.last_sender_role,
          });
          continue;
        }

        const shouldNotify =
          shouldNotifyFromInboxPoll(row, user.id, prev) &&
          !isChatAlertAlreadyAcked(user.id, row.id, row.last_message_at);

        inboxSnapshotRef.current.set(row.id, {
          last_message_at: row.last_message_at,
          last_sender_role: row.last_sender_role,
        });

        if (shouldNotify) {
          notifyForRow(
            row,
            user.id,
            activeIdRef.current,
            activeRoleRef.current,
            row.last_message || "New message",
            navigate,
            soundLabels.current,
            openMessageLabel,
            `poll-${row.id}-${row.last_message_at}`
          );
        }
      }
    };

    const pollInbox = async () => {
      const token = readSession()?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const seedOnly = !pollInitializedRef.current;

      const buyerRes = await fetch(`${API_BASE}/v1/marketplace/chat/inbox`, { headers });
      if (cancelled) return;

      const buyerBody = (await buyerRes.json().catch(() => ({}))) as { data?: ConversationRow[] };
      if (buyerRes.ok) {
        processPollRows(buyerBody.data || [], seedOnly);
      }

      if (!canPollSeller) {
        if (seedOnly) pollInitializedRef.current = true;
        return;
      }

      const sellerRes = await fetch(`${API_BASE}/v1/marketplace/chat/seller/${user.id}/bootstrap`, {
        headers,
      });
      if (!sellerRes.ok || cancelled) {
        if (seedOnly) pollInitializedRef.current = true;
        return;
      }

      const sellerBody = (await sellerRes.json().catch(() => ({}))) as { data?: ConversationRow[] };
      processPollRows(sellerBody.data || [], seedOnly);
      if (seedOnly) pollInitializedRef.current = true;
    };

    void pollInbox();
    const timer = window.setInterval(() => {
      void pollInbox();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hasCapability, navigate, onAdminRoute, openMessageLabel, user?.id, t]);
}
