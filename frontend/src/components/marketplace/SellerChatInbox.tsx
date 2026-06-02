import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, API_BASE, readSession } from "@/api/client";
import { MessageCircle, Send, ArrowLeft, ExternalLink, Share2, Package, Flag, Trash2, Store } from "lucide-react";
import { shopPath } from "@/lib/marketplaceShopApi";
import { setChatAlertAck } from "@/lib/marketplaceChatAlertAck";
import { deleteMarketplaceConversation } from "@/lib/marketplaceChatApi";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { motion } from "framer-motion";
import { withApiTiming } from "@/lib/perfMetrics";
import { mergeMessages, sendMarketplaceMessage, sendTextAndProductShares, normalizeChatGuard, type MarketplaceChatGuardState } from "@/lib/marketplaceChatSend";
import { containsProductMention, containsReportMention, stripProductMention, stripAllMentionTags, getChatMentionTags, type ChatMentionTagId } from "@/lib/marketplaceChatMentions";
import type { ChatMentionProduct } from "@/lib/marketplaceChatMentions";
import ChatProductMentionPicker, { ChatProductMentionChipRow } from "@/components/marketplace/ChatProductMentionPicker";
import ChatMentionComposerInput from "@/components/marketplace/ChatMentionComposerInput";
import ChatContactBlockedBanner from "@/components/marketplace/ChatContactBlockedBanner";
import { useLiveChatRestriction } from "@/lib/useLiveChatRestriction";
import { useChatInboxPoll, useChatThreadPoll } from "@/lib/marketplaceChatRealtime";
import {
  resolveSelfShopThread,
  isSellerSideMessage,
  isAdminSupportMessage,
  selfShopLastMessagePreview,
  selfShopThreadLabel,
} from "@/lib/marketplaceChatRoles";
import {
  CHAT_PRODUCT_OPEN_HIGHLIGHT_MS,
  chronologicalThreadMessages,
  isAnchorProductShareMessage,
  orderedThreadMessages,
} from "@/lib/marketplaceChatProduct";
import { getOutboundReceiptStatus } from "@/lib/marketplaceChatReceipts";
import { useConversationReceipts } from "@/lib/useConversationReceipts";
import ChatMessageReceipt from "@/components/marketplace/ChatMessageReceipt";
import ChatMessageTranslate from "@/components/marketplace/ChatMessageTranslate";
import ChatScrollToBottomButton from "@/components/marketplace/ChatScrollToBottomButton";
import ChatConversationReportDialog from "@/components/marketplace/ChatConversationReportDialog";
import ChatReportStatusBanner from "@/components/marketplace/ChatReportStatusBanner";
import ChatAdminSupportBubble from "@/components/marketplace/ChatAdminSupportBubble";
import ChatThreadDateDivider from "@/components/marketplace/ChatThreadDateDivider";
import { groupMessagesByDate } from "@/lib/marketplaceChatDates";
import { useChatScrollToBottom } from "@/lib/useChatScrollToBottom";
import { useMarketplaceChatFocus } from "@/contexts/MarketplaceChatFocusContext";
import { isInboundConversationUpdate } from "@/lib/marketplaceChatUnread";

interface ConvoItem {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  last_message: string;
  last_message_at: string;
  last_sender_id?: string | null;
  last_sender_role?: string | null;
  has_unread?: boolean;
  buyer_name: string;
  shop_name?: string;
  is_self_chat?: boolean;
  product_name?: string;
  product_image?: string;
  product_price?: number;
  is_canonical?: boolean;
  is_superseded_duplicate?: boolean;
  has_pending_report?: boolean;
}

function ownShopLabel(c: ConvoItem): string {
  return c.shop_name || "Your own shop";
}

function formatLastMessagePreview(c: ConvoItem, sellerId: string): string {
  const text = c.last_message || "";
  if (resolveSelfShopThread(c)) {
    return selfShopLastMessagePreview(c.last_sender_role, c.buyer_name, text);
  }
  if (c.last_sender_id && c.last_sender_id === sellerId) return `You: ${text}`;
  return `${c.buyer_name || "Buyer"}: ${text}`;
}

function messageSenderLabel(c: ConvoItem | undefined, sellerId: string, msg: ChatMsg): string {
  if (resolveSelfShopThread(c)) {
    const label = selfShopThreadLabel(msg, c?.shop_name, c?.buyer_name, "sellerInbox");
    return label || "Buyer";
  }
  if (msg.sender_id === sellerId) return "You";
  return c?.buyer_name || "Buyer";
}

interface ChatMsg {
  id: string;
  sender_id: string;
  sender_role?: string | null;
  buyer_delivered_at?: string | null;
  buyer_read_at?: string | null;
  seller_delivered_at?: string | null;
  seller_read_at?: string | null;
  message_type: string;
  text_body: string | null;
  shared_product_id: string | null;
  created_at: string;
  shared_product?: any;
}

interface ThreadConvoMeta {
  buyer_id: string;
  seller_id: string;
  is_self_chat?: boolean;
  product_id?: string | null;
  shop_name?: string;
  is_superseded_duplicate?: boolean;
  has_pending_report?: boolean;
}

export default function SellerChatInbox({ sellerId }: { sellerId: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setActiveConversationId, setActiveViewerRole } = useMarketplaceChatFocus();
  const [conversations, setConversations] = useState<ConvoItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [threadConvo, setThreadConvo] = useState<ThreadConvoMeta | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareProducts, setShareProducts] = useState<any[]>([]);
  const [shareSearch, setShareSearch] = useState("");
  const [highlightProductCard, setHighlightProductCard] = useState(false);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionDraft, setMentionDraft] = useState("");
  const [pendingMentionProducts, setPendingMentionProducts] = useState<ChatMentionProduct[]>([]);
  const [contactBlockedWarning, setContactBlockedWarning] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [userReported, setUserReported] = useState(false);
  const mentionTags = useMemo(() => getChatMentionTags(), []);
  const [chatGuard, setChatGuard] = useState<MarketplaceChatGuardState>({});
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const selectedRef = useRef<string | null>(selected);
  selectedRef.current = selected;

  const selectedConvo = useMemo(
    () => (selected ? conversations.find((c) => c.id === selected) : undefined),
    [conversations, selected]
  );
  const activeConvo = useMemo((): ConvoItem | undefined => {
    if (!selected) return undefined;
    if (threadConvo && selectedConvo) {
      return {
        ...selectedConvo,
        buyer_id: threadConvo.buyer_id,
        seller_id: threadConvo.seller_id,
        is_self_chat: threadConvo.is_self_chat ?? selectedConvo.is_self_chat,
        product_id: threadConvo.product_id ?? selectedConvo.product_id,
        shop_name: threadConvo.shop_name ?? selectedConvo.shop_name,
      };
    }
    if (threadConvo) {
      return {
        id: selected,
        buyer_id: threadConvo.buyer_id,
        seller_id: threadConvo.seller_id,
        is_self_chat: threadConvo.is_self_chat,
        product_id: threadConvo.product_id ?? null,
        shop_name: threadConvo.shop_name,
        last_message: "",
        last_message_at: new Date().toISOString(),
        buyer_name: "Buyer",
      };
    }
    return selectedConvo;
  }, [selected, selectedConvo, threadConvo]);
  const marketplaceBuyerThread = Boolean(activeConvo && !resolveSelfShopThread(activeConvo));
  const threadMessages = useMemo(() => {
    if (marketplaceBuyerThread) return chronologicalThreadMessages(messages);
    return orderedThreadMessages(messages, activeConvo?.product_id ?? selectedConvo?.product_id);
  }, [messages, activeConvo?.product_id, selectedConvo?.product_id, marketplaceBuyerThread]);
  const threadDateGroups = useMemo(
    () => groupMessagesByDate(threadMessages),
    [threadMessages]
  );
  const { showScrollDown, scrollToBottom } = useChatScrollToBottom({
    scrollAreaRef,
    bottomRef,
    messageCount: threadMessages.length,
    enabled: Boolean(selected),
  });

  const loadConversations = useCallback(async () => {
    setLoadError(null);
    const token = readSession()?.access_token;
    const res = await withApiTiming("/v1/marketplace/chat/seller/:sellerId/bootstrap", () =>
      fetch(`${API_BASE}/v1/marketplace/chat/seller/${sellerId}/bootstrap`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    );
    const body = await res.json().catch(() => ({}));
    const convos = (body as { data?: ConvoItem[]; chat_guard?: MarketplaceChatGuardState }).data;
    const guard = (body as { chat_guard?: MarketplaceChatGuardState & { restricted_until?: string | null; violation_count?: number } }).chat_guard;
    if (guard) setChatGuard(normalizeChatGuard(guard));
    if (!res.ok) {
      setConversations([]);
      setLoadError((body as { error?: string }).error || "Failed to load conversations");
      setLoading(false);
      return;
    }

    setConversations(convos || []);
    setLoading(false);
  }, [sellerId]);

  useChatInboxPoll(loadConversations, Boolean(sellerId) && !selected);

  useEffect(() => {
    if (!sellerId) return;
    setLoading(true);
    loadConversations();
    const channel = api
      .channel(`seller-inbox-${sellerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `seller_id=eq.${sellerId}` },
        (payload) => {
          const row = payload.new as (Partial<ConvoItem> & { last_message?: string; last_message_at?: string; last_sender_id?: string; last_sender_role?: string }) | null;
          if (!row?.id) {
            void loadConversations();
            return;
          }
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === row.id);
            if (idx < 0) {
              void loadConversations();
              return prev;
            }
            const next = [...prev];
            const inbound = isInboundConversationUpdate(row.last_sender_role, "seller");
            next[idx] = {
              ...next[idx],
              last_message: row.last_message || next[idx].last_message,
              last_message_at: row.last_message_at || next[idx].last_message_at,
              last_sender_id: row.last_sender_id ?? next[idx].last_sender_id,
              last_sender_role: row.last_sender_role ?? next[idx].last_sender_role,
              has_unread: inbound ? true : next[idx].has_unread,
            };
            next.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
            return next;
          });
        }
      )
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [loadConversations, sellerId]);

  const enrichMessages = useCallback(async (msgs: any[]): Promise<ChatMsg[]> => {
    const productIds = [...new Set(msgs.filter(m => m.shared_product_id).map(m => m.shared_product_id))];
    let productMap = new Map();
    if (productIds.length > 0) {
      const { data } = await api.from("products").select("id, name, price, image, stock").in("id", productIds);
      if (data) productMap = new Map(data.map(p => [p.id, p]));
    }
    return msgs.map(m => ({ ...m, shared_product: m.shared_product_id ? productMap.get(m.shared_product_id) || null : null }));
  }, []);

  const handlePolledThreadMessages = useCallback(async (raw: unknown[]) => {
    const enriched = await enrichMessages(raw as any[]);
    setMessages((prev) => mergeMessages(prev, enriched));
  }, [enrichMessages]);

  useChatThreadPoll(selected, Boolean(selected), handlePolledThreadMessages);

  useConversationReceipts({
    conversationId: selected,
    viewerRole: "seller",
    enabled: Boolean(selected),
    messageCount: messages.length,
    onLocalUpdate: setMessages,
  });

  useEffect(() => {
    setActiveConversationId(selected);
    setActiveViewerRole(selected ? "seller" : null);
    return () => {
      setActiveConversationId(null);
      setActiveViewerRole(null);
    };
  }, [selected, setActiveConversationId, setActiveViewerRole]);

  useEffect(() => {
    const convoParam = searchParams.get("convo");
    if (!convoParam || conversations.length === 0) return;
    if (conversations.some((c) => c.id === convoParam)) {
      setSelected(convoParam);
    }
  }, [searchParams, conversations]);

  useEffect(() => {
    if (!selected || messages.length === 0) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === selected ? { ...c, has_unread: false } : c))
    );
  }, [selected, messages.length]);

  useEffect(() => {
    if (!selected || !sellerId) return;
    const row = conversations.find((c) => c.id === selected);
    const at = row?.last_message_at || messages[messages.length - 1]?.created_at;
    if (at) setChatAlertAck(sellerId, selected, at);
  }, [selected, sellerId, conversations, messages]);

  // Load thread (bootstrap ensures anchor product_share)
  useEffect(() => {
    if (!selected) {
      setThreadConvo(null);
      return;
    }
    const loadThread = async () => {
      const token = readSession()?.access_token;
      const res = await fetch(`${API_BASE}/v1/marketplace/chat/conversations/${selected}/bootstrap`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        toast.error("Could not load conversation");
        return;
      }
      const body = (await res.json()) as {
        data?: {
          redirect_conversation_id?: string;
          messages?: ChatMsg[];
          chat_guard?: MarketplaceChatGuardState;
          conversation?: {
            id?: string;
            buyer_id?: string;
            seller_id?: string;
            is_self_chat?: boolean;
            product_id?: string | null;
            shop_name?: string;
            user_has_reported?: boolean;
            is_superseded_duplicate?: boolean;
            has_pending_report?: boolean;
          };
        };
      };
      if (body.data?.redirect_conversation_id && body.data.redirect_conversation_id !== selected) {
        setSelected(body.data.redirect_conversation_id);
        return;
      }
      setMessages(body.data?.messages || []);
      const convoMeta = body.data?.conversation;
      if (convoMeta?.buyer_id && convoMeta?.seller_id) {
        setThreadConvo({
          buyer_id: convoMeta.buyer_id,
          seller_id: convoMeta.seller_id,
          is_self_chat: convoMeta.is_self_chat,
          product_id: convoMeta.product_id,
          shop_name: convoMeta.shop_name,
          is_superseded_duplicate: convoMeta.is_superseded_duplicate,
          has_pending_report: convoMeta.has_pending_report,
        });
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === selected);
          if (idx < 0) {
            return [
              {
                id: selected,
                buyer_id: convoMeta.buyer_id!,
                seller_id: convoMeta.seller_id!,
                is_self_chat: convoMeta.is_self_chat,
                product_id: convoMeta.product_id ?? null,
                last_message: "New conversation",
                last_message_at: new Date().toISOString(),
                buyer_name: "Buyer",
                shop_name: convoMeta.shop_name,
              },
              ...prev,
            ];
          }
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            buyer_id: convoMeta.buyer_id ?? next[idx].buyer_id,
            seller_id: convoMeta.seller_id ?? next[idx].seller_id,
            is_self_chat: convoMeta.is_self_chat ?? next[idx].is_self_chat,
            shop_name: convoMeta.shop_name ?? next[idx].shop_name,
            product_id: convoMeta.product_id ?? next[idx].product_id,
            is_superseded_duplicate: convoMeta.is_superseded_duplicate ?? next[idx].is_superseded_duplicate,
            has_pending_report: convoMeta.has_pending_report ?? next[idx].has_pending_report,
          };
          return next;
        });
      }
      if (body.data?.chat_guard) setChatGuard(normalizeChatGuard(body.data.chat_guard));
      setUserReported(Boolean(convoMeta?.user_has_reported));
      prevMessageCountRef.current = 0;
      scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      const pinHeader = Boolean(convoMeta?.is_self_chat === false);
      if (!pinHeader) {
        setHighlightProductCard(true);
        window.setTimeout(() => setHighlightProductCard(false), CHAT_PRODUCT_OPEN_HIGHLIGHT_MS);
      }
    };
    void loadThread();

    const channel = api
      .channel(`seller-thread-${selected}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${selected}` }, async (payload) => {
        const msg = payload.new as ChatMsg;
        const enriched = await enrichMessages([msg]);
        setMessages(prev => mergeMessages(prev, enriched));
      })
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [selected, enrichMessages]);

  useEffect(() => {
    if (threadMessages.length > prevMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = threadMessages.length;
  }, [threadMessages.length]);

  useEffect(() => {
    setContactBlockedWarning(false);
  }, [newMsg]);

  useEffect(() => {
    setUserReported(false);
  }, [selected]);

  const convoDisplayName = (c: ConvoItem) =>
    resolveSelfShopThread(c) ? ownShopLabel(c) : c.buyer_name;

  const sendWithMentionProducts = async (rawText: string, products: ChatMentionProduct[]) => {
    if (!selected || products.length === 0) return false;
    setSending(true);
    const lastProduct = products[products.length - 1];
    const preview = rawText.trim()
      ? rawText.trim()
      : products.length === 1
        ? `Shared: ${lastProduct.name}`
        : `Shared ${products.length} products`;
    const ok = await sendTextAndProductShares<ChatMsg>({
      conversationId: selected,
      senderId: sellerId,
      senderRole: "seller",
      rawText,
      products,
      chatGuard,
      onContactBlocked: () => setContactBlockedWarning(true),
      onChatGuardUpdate: setChatGuard,
      onOptimistic: (message) => setMessages((prev) => mergeMessages(prev, message)),
      onConfirmed: (tempId, message) =>
        setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== tempId), message)),
      onRollback: (tempId) => setMessages((prev) => prev.filter((m) => m.id !== tempId)),
      onError: (message) => toast.error(message),
    });
    if (ok) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selected
            ? {
                ...c,
                last_message: preview,
                last_sender_id: sellerId,
                last_sender_role: "seller",
                last_message_at: new Date().toISOString(),
              }
            : c
        )
      );
    }
    setSending(false);
    return ok;
  };

  const { isRestricted: chatSendRestricted, clock: restrictionClock } = useLiveChatRestriction(
    chatGuard.restrictedUntil
  );
  const canSendMessage = Boolean(newMsg.trim() || pendingMentionProducts.length > 0) && !chatSendRestricted;

  const openReportFromMention = useCallback((text: string) => {
    setNewMsg(stripAllMentionTags(text));
    if (userReported) {
      toast.message("You have already reported this conversation");
      return;
    }
    setReportOpen(true);
  }, [userReported]);

  const sendReply = async () => {
    if (!canSendMessage || !selected || sending) return;
    const text = newMsg.trim();
    const products = [...pendingMentionProducts];

    if (containsReportMention(text)) {
      openReportFromMention(text);
      return;
    }

    if (containsProductMention(text) && products.length === 0) {
      setMentionDraft(text);
      setMentionPickerOpen(true);
      return;
    }

    if (products.length > 0) {
      setNewMsg("");
      setPendingMentionProducts([]);
      setMentionDraft("");
      const ok = await sendWithMentionProducts(text, products);
      if (!ok) {
        setNewMsg(text);
        setPendingMentionProducts(products);
      }
      return;
    }

    setNewMsg("");
    setSending(true);
    const ok = await sendMarketplaceMessage<ChatMsg>({
      conversationId: selected,
      senderId: sellerId,
      senderRole: "seller",
      messageType: "text",
      textBody: text,
      chatGuard,
      onContactBlocked: () => setContactBlockedWarning(true),
      onChatGuardUpdate: setChatGuard,
      onOptimistic: (message) => setMessages((prev) => mergeMessages(prev, message)),
      onConfirmed: (tempId, message) =>
        setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== tempId), message)),
      onRollback: (tempId) => {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setNewMsg(text);
      },
      onError: (message) => {
        if (message.includes("GREENBondhu") || message.includes("restricted")) {
          setContactBlockedWarning(true);
          return;
        }
        toast.error(message);
      },
    });
    setSending(false);
    if (ok) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selected
            ? { ...c, last_message: text, last_sender_id: sellerId, last_sender_role: "seller", last_message_at: new Date().toISOString() }
            : c
        )
      );
    }
    if (!ok) setNewMsg(text);
  };

  const handleMentionProductSelect = (product: ChatMentionProduct) => {
    setPendingMentionProducts((prev) =>
      prev.some((p) => p.id === product.id) ? prev : [...prev, product]
    );
    setNewMsg((prev) => stripProductMention(prev));
    setMentionDraft("");
  };

  const handleRemoveMentionProduct = (productId: string) => {
    setPendingMentionProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleMentionTagCompleted = useCallback((tagId: ChatMentionTagId, text: string) => {
    if (tagId === "product" && !mentionPickerOpen) {
      setMentionDraft(text);
      setMentionPickerOpen(true);
      return;
    }
    if (tagId === "report") {
      openReportFromMention(text);
    }
  }, [mentionPickerOpen, openReportFromMention]);

  const handleShareProduct = async (product: any) => {
    if (!selected) return;
    const preview = `Shared: ${product.name}`;
    const ok = await sendMarketplaceMessage<ChatMsg>({
      conversationId: selected,
      senderId: sellerId,
      senderRole: "seller",
      messageType: "product_share",
      sharedProductId: product.id,
      sharedProduct: product,
      productName: product.name,
      onOptimistic: (message) => setMessages((prev) => mergeMessages(prev, message)),
      onConfirmed: (tempId, message) =>
        setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== tempId), message)),
      onRollback: (tempId) => setMessages((prev) => prev.filter((m) => m.id !== tempId)),
      onError: (message) => toast.error(message),
    });
    if (ok) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selected
            ? { ...c, last_message: preview, last_sender_id: sellerId, last_sender_role: "seller", last_message_at: new Date().toISOString() }
            : c
        )
      );
      setShareOpen(false);
      toast.success("Product shared");
    }
  };
  useEffect(() => {
    if (!shareOpen) return;
    api.from("products").select("id, name, price, image, category, stock")
      .eq("seller_id", sellerId).ilike("name", `%${shareSearch}%`).limit(20)
      .then(({ data }) => setShareProducts(data || []));
  }, [shareOpen, shareSearch, sellerId]);

  const selectedInboxRow = useMemo(
    () => (selected ? conversations.find((c) => c.id === selected) : undefined),
    [conversations, selected]
  );
  const canDeleteConversation = useCallback(
    (row: { is_superseded_duplicate?: boolean; has_pending_report?: boolean } | undefined) =>
      Boolean(
        row?.is_superseded_duplicate && !row?.has_pending_report
      ),
    []
  );

  const canDeleteSelected = Boolean(
    selected && activeConvo && !resolveSelfShopThread(activeConvo) && canDeleteConversation({
      is_superseded_duplicate: threadConvo?.is_superseded_duplicate ?? selectedInboxRow?.is_superseded_duplicate,
      has_pending_report: threadConvo?.has_pending_report ?? selectedInboxRow?.has_pending_report,
    })
  );

  const handleDeleteConversationById = async (conversationId: string) => {
    if (!window.confirm("Remove this old duplicate chat? Messages in this thread will be deleted.")) return;
    try {
      await deleteMarketplaceConversation(conversationId);
      toast.success("Duplicate chat removed");
      if (selected === conversationId) {
        setSelected(null);
        setThreadConvo(null);
        setMessages([]);
      }
      await loadConversations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete chat");
    }
  };

  const handleDeleteDuplicate = async () => {
    if (!selected || !canDeleteSelected) return;
    await handleDeleteConversationById(selected);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  if (loading) return <p className="text-center text-muted-foreground py-8">Loading messages...</p>;
  if (loadError && !selected) {
    return (
      <div className="text-center py-12 px-4 space-y-2">
        <MessageCircle className="h-10 w-10 mx-auto text-destructive/50" />
        <p className="text-sm text-destructive font-medium">Could not load messages</p>
        <p className="text-xs text-muted-foreground">{loadError}</p>
      </div>
    );
  }
  if (conversations.length === 0 && !selected) {
    return (
      <div className="text-center py-12 space-y-2">
        <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground">No messages yet</p>
      </div>
    );
  }

  if (selected) {
    const conv = activeConvo;
    const selfChat = resolveSelfShopThread(conv);
    return (
      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
        <div className="flex items-center gap-3 p-3 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelected(null);
              setThreadConvo(null);
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{conv ? convoDisplayName(conv) : ""}</p>
          </div>
          {canDeleteSelected && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              title="Delete duplicate chat"
              onClick={() => void handleDeleteDuplicate()}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            title={userReported ? "Already reported" : "Report conversation"}
            disabled={userReported}
            onClick={() => setReportOpen(true)}
          >
            <Flag className={`h-4 w-4 ${userReported ? "text-muted-foreground" : "text-destructive"}`} />
          </Button>
        </div>
        {userReported && <ChatReportStatusBanner />}
        <Button
          variant="outline"
          className="mx-3 mb-3 w-[calc(100%-1.5rem)] justify-center text-sm"
          asChild
        >
          <Link to={shopPath(sellerId)}>
            <Store className="h-4 w-4 mr-2" />
            Visit my shop
          </Link>
        </Button>
        <div className="relative">
          <ScrollArea ref={scrollAreaRef} className="h-[350px] p-3">
          <div className="space-y-2">
            {threadDateGroups.map((group) => (
              <div key={group.dateKey} className="space-y-2">
                <ChatThreadDateDivider dateKey={group.dateKey} />
                {group.messages.map((m) => {
              if (isAdminSupportMessage(m)) {
                return (
                  <ChatAdminSupportBubble
                    key={m.id}
                    messageId={m.id}
                    textBody={m.text_body}
                    createdAt={m.created_at}
                  />
                );
              }

              const isMe = isSellerSideMessage(m, sellerId, selfChat);
              const label = messageSenderLabel(conv, sellerId, m);
              const isAnchor = isAnchorProductShareMessage(m, conv?.product_id, messages);
              if (m.message_type === "product_share" && m.shared_product) {
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className="space-y-0.5 max-w-[80%]">
                      <p
                        className={`text-[10px] px-1 ${isMe ? "text-right" : "text-left"}`}
                        style={{ color: isMe ? ICON_COLORS.marketplace : ICON_COLORS.farm }}
                      >
                        {label}
                      </p>
                      <button onClick={() => navigate(`/marketplace/${m.shared_product.id}`)}
                        className={`w-full rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-all ${isMe ? "bg-primary/5" : "bg-muted/50"} ${isAnchor && highlightProductCard ? "ring-2 ring-offset-1" : ""}`}
                        style={isAnchor && highlightProductCard ? { borderColor: ICON_COLORS.marketplace } : undefined}>
                        <div className="flex items-center gap-3 p-2.5">
                          <img src={m.shared_product.image} alt="" className="h-12 w-12 rounded-lg object-cover bg-accent shrink-0" />
                          <div className="text-left min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{m.shared_product.name}</p>
                            <p className="text-sm font-bold" style={{ color: ICON_COLORS.health }}>৳{m.shared_product.price}</p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </button>
                      {isMe && (
                        <p className={`text-[10px] px-1 flex items-center justify-end gap-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          <ChatMessageReceipt status={getOutboundReceiptStatus(m, "seller")} />
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
              return (
                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className="space-y-0.5 max-w-[75%]">
                    <p
                      className={`text-[10px] px-1 ${isMe ? "text-right" : "text-left"}`}
                      style={{ color: isMe ? ICON_COLORS.marketplace : ICON_COLORS.farm }}
                    >
                      {label}
                    </p>
                    <div className={`rounded-2xl px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                      <ChatMessageTranslate
                        messageId={m.id}
                        textBody={m.text_body}
                        onPrimaryBubble={isMe}
                      />
                      <p className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {isMe && (
                          <ChatMessageReceipt status={getOutboundReceiptStatus(m, "seller")} onPrimaryBubble />
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
          <ChatScrollToBottomButton visible={showScrollDown} onClick={scrollToBottom} />
        </div>
        <div className="border-t overflow-visible">
          <ChatProductMentionChipRow
            products={pendingMentionProducts}
            onRemove={handleRemoveMentionProduct}
          />
          {chatSendRestricted ? (
            <ChatContactBlockedBanner
              variant="restricted"
              restrictedUntil={chatGuard.restrictedUntil}
              countdownClock={restrictionClock}
            />
          ) : null}
          {contactBlockedWarning && !chatSendRestricted ? (
            <ChatContactBlockedBanner variant="blocked" />
          ) : null}
          <div className="flex gap-2 p-3">
          <Button variant="ghost" size="icon" onClick={() => setShareOpen(true)} className="shrink-0" title="Share Product">
            <Share2 className="h-4 w-4" style={{ color: ICON_COLORS.marketplace }} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMentionPickerOpen(true)} className="shrink-0" title="Attach product">
            <Package className="h-4 w-4" style={{ color: ICON_COLORS.marketplace }} />
          </Button>
          <ChatMentionComposerInput
            value={newMsg}
            onChange={setNewMsg}
            onMentionTagCompleted={handleMentionTagCompleted}
            mentionTags={mentionTags}
            placeholder="Type reply… type @ for product or report"
            onKeyDown={(e) => e.key === "Enter" && void sendReply()}
            disabled={sending || chatSendRestricted}
          />
          <Button size="icon" onClick={() => void sendReply()} disabled={!canSendMessage || sending} style={{ backgroundColor: ICON_COLORS.marketplace }} className="text-white shrink-0"><Send className="h-4 w-4" /></Button>
          </div>
        </div>

        <ChatProductMentionPicker
          open={mentionPickerOpen}
          onOpenChange={setMentionPickerOpen}
          conversationId={selected}
          attachedProductIds={pendingMentionProducts.map((p) => p.id)}
          onSelect={handleMentionProductSelect}
          onCancel={() => toast.message("Select products to attach, then tap Done")}
        />

        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base"><Share2 className="h-5 w-5" style={{ color: ICON_COLORS.marketplace }} />Share Product</DialogTitle>
              <DialogDescription>Search your products and pick one to send in this conversation.</DialogDescription>
            </DialogHeader>
            <Input placeholder="Search your products..." value={shareSearch} onChange={(e) => setShareSearch(e.target.value)} />
            <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
              <div className="space-y-2">
                {shareProducts.map((p) => (
                  <button key={p.id} onClick={() => handleShareProduct(p)} className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left border">
                    <img src={p.image} alt={p.name} className="h-12 w-12 rounded-md object-cover bg-accent" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold" style={{ color: ICON_COLORS.health }}>৳{p.price}</span>
                        <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                      </div>
                    </div>
                  </button>
                ))}
                {shareProducts.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No products found</p>}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {selected && (
          <ChatConversationReportDialog
            open={reportOpen}
            onOpenChange={setReportOpen}
            conversationId={selected}
            onSubmitted={() => setUserReported(true)}
          />
        )}
      </Card>
    );
  }

  return (
    <Card className="shadow-card overflow-hidden">
      <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
      <CardContent className="p-0">
        {conversations.map((c, i) => {
          const unread = Boolean(c.has_unread);
          const rowCanDelete = canDeleteConversation(c);
          return (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center gap-1 border-b last:border-b-0"
          >
          <button
            type="button"
            onClick={() => {
              setConversations((prev) =>
                prev.map((row) => (row.id === c.id ? { ...row, has_unread: false } : row))
              );
              setSelected(c.id);
            }}
            className="flex-1 flex items-center gap-3 p-3.5 hover:bg-muted/40 transition-colors text-left min-w-0"
          >
            <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold" style={{ color: ICON_COLORS.marketplace }}>
              {convoDisplayName(c).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {unread && (
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: ICON_COLORS.marketplace }}
                      aria-hidden
                    />
                  )}
                  <p className={`text-sm truncate ${unread ? "font-bold text-foreground" : "font-semibold text-foreground"}`}>
                    {convoDisplayName(c)}
                  </p>
                  {c.is_superseded_duplicate && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Duplicate
                    </Badge>
                  )}
                </div>
                <span className={`text-[11px] shrink-0 ${unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {timeAgo(c.last_message_at)}
                </span>
              </div>
              <p className={`text-xs truncate mt-0.5 ${unread ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                {formatLastMessagePreview(c, sellerId)}
              </p>
            </div>
          </button>
          {rowCanDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 mr-2 text-destructive hover:text-destructive"
              title="Delete duplicate chat"
              onClick={(e) => {
                e.stopPropagation();
                void handleDeleteConversationById(c.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
