import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { API_BASE, api, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Send, Share2, Package, ExternalLink, Flag, Store, Trash2 } from "lucide-react";
import { shopPath } from "@/lib/marketplaceShopApi";
import { deleteMarketplaceConversation, openMarketplaceChat } from "@/lib/marketplaceChatApi";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { MARKETPLACE_THEME, marketplaceGradient } from "@/lib/marketplaceTheme";
import { MARKETPLACE_SELLER_FALLBACK } from "@/lib/marketplaceProduct";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy } from "@/lib/queryClient";
import { mergeMessages, sendMarketplaceMessage, sendTextAndProductShares, normalizeChatGuard, type MarketplaceChatGuardState } from "@/lib/marketplaceChatSend";
import { containsProductMention, containsReportMention, stripProductMention, stripAllMentionTags, getChatMentionTags, type ChatMentionTagId } from "@/lib/marketplaceChatMentions";
import ChatProductMentionPicker, { ChatProductMentionChipRow } from "@/components/marketplace/ChatProductMentionPicker";
import ChatMentionComposerInput from "@/components/marketplace/ChatMentionComposerInput";
import ChatContactBlockedBanner from "@/components/marketplace/ChatContactBlockedBanner";
import { useLiveChatRestriction } from "@/lib/useLiveChatRestriction";
import type { ChatMentionProduct } from "@/lib/marketplaceChatMentions";
import { useChatThreadPoll } from "@/lib/marketplaceChatRealtime";
import {
  isAdminSupportMessage,
  isBuyerSideMessage,
  isBuyerShopThread,
  isMarketplaceShopBuyerChat,
  isSameParticipant,
  isSellerShopThread,
  resolveSelfShopThread,
} from "@/lib/marketplaceChatRoles";
import { setChatAlertAck } from "@/lib/marketplaceChatAlertAck";
import {
  CHAT_PRODUCT_OPEN_HIGHLIGHT_MS,
  CHAT_PRODUCT_RESURFACE_IDLE_MS,
  chronologicalThreadMessages,
  isAnchorProductShareMessage,
  orderedThreadMessages,
  partitionAnchorProductMessages,
  type ChatProductReference,
} from "@/lib/marketplaceChatProduct";
import { getOutboundReceiptStatus } from "@/lib/marketplaceChatReceipts";
import { useConversationReceipts } from "@/lib/useConversationReceipts";
import { useMarketplaceChatFocus } from "@/contexts/MarketplaceChatFocusContext";
import ChatMessageReceipt from "@/components/marketplace/ChatMessageReceipt";
import ChatMessageTranslate from "@/components/marketplace/ChatMessageTranslate";
import ChatProductReferenceCard from "@/components/marketplace/ChatProductReferenceCard";
import ChatScrollToBottomButton from "@/components/marketplace/ChatScrollToBottomButton";
import ChatThreadDateDivider from "@/components/marketplace/ChatThreadDateDivider";
import { groupMessagesByDate } from "@/lib/marketplaceChatDates";
import { useChatScrollToBottom } from "@/lib/useChatScrollToBottom";
import { patchInboxUnread } from "@/lib/marketplaceChatUnread";
import ChatConversationReportDialog from "@/components/marketplace/ChatConversationReportDialog";
import ChatReportStatusBanner from "@/components/marketplace/ChatReportStatusBanner";
import ChatAdminSupportBubble from "@/components/marketplace/ChatAdminSupportBubble";

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_role?: string | null;
  message_type: string;
  text_body: string | null;
  shared_product_id: string | null;
  created_at: string;
  shared_product?: {
    id: string;
    name: string;
    price: number;
    image: string;
    seller_name: string;
    location: string;
    stock: number;
  } | null;
}

interface ConversationInfo {
  id: string;
  buyer_id: string;
  seller_id: string;
  is_self_chat?: boolean;
  product_id: string | null;
  product?: {
    id: string;
    name: string;
    price: number;
    image: string;
    seller_name: string;
    location: string;
    rating: number;
    stock: number;
    category: string;
  } | null;
  other_name: string;
  shop_name?: string;
  last_message_at?: string | null;
  user_has_reported?: boolean;
  has_pending_report?: boolean;
  is_canonical?: boolean;
  is_superseded_duplicate?: boolean;
  has_conversation_report?: boolean;
}

interface SupersededDuplicateRow {
  id: string;
  last_message_at?: string;
  has_pending_report?: boolean;
}

export default function ChatDetail() {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setActiveConversationId, setActiveViewerRole } = useMarketplaceChatFocus();
  const queryClient = useQueryClient();
  const [convo, setConvo] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [resolvedConversationId, setResolvedConversationId] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareProducts, setShareProducts] = useState<any[]>([]);
  const [shareSearch, setShareSearch] = useState("");
  const [resolvedProduct, setResolvedProduct] = useState<ChatProductReference | null>(null);
  const [highlightProductCard, setHighlightProductCard] = useState(false);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionDraft, setMentionDraft] = useState("");
  const [pendingMentionProducts, setPendingMentionProducts] = useState<ChatMentionProduct[]>([]);
  const [contactBlockedWarning, setContactBlockedWarning] = useState(false);
  const [chatGuard, setChatGuard] = useState<MarketplaceChatGuardState>({});
  const [reportOpen, setReportOpen] = useState(false);
  const [userReported, setUserReported] = useState(false);
  const [supersededDuplicates, setSupersededDuplicates] = useState<SupersededDuplicateRow[]>([]);
  const isSelfChatConvo = convo ? resolveSelfShopThread(convo) : false;
  const mentionTags = useMemo(
    () => getChatMentionTags({ allowReport: !isSelfChatConvo }),
    [isSelfChatConvo]
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const scrollToBottomAfterShareRef = useRef(false);

  // Resolve conversation id (create only when route is `/new`)
  useEffect(() => {
    if (!user) return;

    const resolveConversation = async () => {
      if (conversationId !== "new") {
        setResolvedConversationId(conversationId || null);
        return;
      }

        const sellerId = searchParams.get("seller");
        const productId = searchParams.get("product");
        if (!sellerId || !productId) { navigate("/marketplace/inbox"); return; }

        try {
          const result = await openMarketplaceChat(sellerId, productId);
          if (result.productShareAdded) {
            scrollToBottomAfterShareRef.current = true;
          }
          setResolvedConversationId(result.conversationId);
          queryClient.invalidateQueries({ queryKey: ["buyer-inbox", user.id] });
          navigate(`/marketplace/chat/${result.conversationId}`, { replace: true });
        } catch {
          toast.error("Could not start conversation");
          navigate("/marketplace/inbox");
        }
    };

    resolveConversation();
  }, [conversationId, navigate, queryClient, searchParams, user]);

  const { data: bootstrapData, isLoading: isBootstrapLoading, isFetching: isBootstrapRefreshing } = useQuery({
    queryKey: ["chat-bootstrap", resolvedConversationId, user?.id],
    enabled: Boolean(resolvedConversationId && user?.id),
    staleTime: moduleCachePolicy.marketplace.staleTime,
    gcTime: moduleCachePolicy.marketplace.gcTime,
    refetchOnMount: "always",
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const token = readSession()?.access_token;
      const bootstrapRes = await fetch(
        `${API_BASE}/v1/marketplace/chat/conversations/${resolvedConversationId}/bootstrap`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!bootstrapRes.ok) throw new Error(`Conversation bootstrap failed (${bootstrapRes.status})`);
      const body = (await bootstrapRes.json()) as {
        data?: {
          redirect_conversation_id?: string;
          conversation?: ConversationInfo;
          messages?: ChatMessage[];
          chat_guard?: MarketplaceChatGuardState;
          superseded_duplicates?: SupersededDuplicateRow[];
        };
      };
      const data = body.data || {};
      if (data.redirect_conversation_id) {
        return { redirectConversationId: data.redirect_conversation_id };
      }
      return {
        conversation: data.conversation ?? null,
        messages: data.messages || [],
        chat_guard: data.chat_guard,
        superseded_duplicates: data.superseded_duplicates || [],
      };
    },
  });

  useEffect(() => {
    const redirectId = bootstrapData?.redirectConversationId;
    if (!redirectId || redirectId === resolvedConversationId) return;
    setResolvedConversationId(redirectId);
    navigate(`/marketplace/chat/${redirectId}`, { replace: true });
  }, [bootstrapData?.redirectConversationId, navigate, resolvedConversationId]);

  useEffect(() => {
    if (!bootstrapData?.conversation) return;
    setConvo(bootstrapData.conversation);
    setMessages(bootstrapData.messages || []);
    if (bootstrapData.chat_guard) setChatGuard(normalizeChatGuard(bootstrapData.chat_guard));
    setUserReported(Boolean(bootstrapData.conversation.user_has_reported));
    setSupersededDuplicates(bootstrapData.superseded_duplicates || []);
  }, [bootstrapData, resolvedConversationId]);

  useEffect(() => {
    setContactBlockedWarning(false);
  }, [newMsg]);

  const marketplaceShopBuyerChat = isMarketplaceShopBuyerChat(convo, user?.id);
  const buyerShopThread = isBuyerShopThread(convo, user?.id);
  const sellerShopThread = isSellerShopThread(convo, user?.id);
  const shopThreadUi = buyerShopThread || sellerShopThread;
  const chatViewerRole = isSameParticipant(user?.id, convo?.seller_id) ? "seller" : "buyer";

  useEffect(() => {
    if (!resolvedConversationId || !bootstrapData?.conversation) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    prevMessageCountRef.current = 0;
    if (shopThreadUi) return;
    setHighlightProductCard(true);
    const timer = window.setTimeout(() => setHighlightProductCard(false), CHAT_PRODUCT_OPEN_HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [resolvedConversationId, bootstrapData?.conversation?.id, shopThreadUi]);

  useEffect(() => {
    if (!convo?.product_id) {
      setResolvedProduct(null);
      return;
    }
    if (convo.product) {
      setResolvedProduct(convo.product);
      return;
    }
    let cancelled = false;
    void api
      .from("products")
      .select("id, name, price, image, seller_name, location, rating, stock, category")
      .eq("id", convo.product_id)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setResolvedProduct(data as ChatProductReference);
      });
    return () => {
      cancelled = true;
    };
  }, [convo?.product_id, convo?.product]);

  const { rest: restMessages } = useMemo(
    () => partitionAnchorProductMessages(messages, convo?.product_id),
    [messages, convo?.product_id]
  );

  const threadMessages = useMemo(() => {
    if (marketplaceShopBuyerChat) return chronologicalThreadMessages(messages);
    return orderedThreadMessages(messages, convo?.product_id);
  }, [messages, convo?.product_id, marketplaceShopBuyerChat]);

  const threadDateGroups = useMemo(
    () => groupMessagesByDate(threadMessages),
    [threadMessages]
  );

  const { showScrollDown, scrollToBottom } = useChatScrollToBottom({
    scrollAreaRef,
    bottomRef,
    messageCount: threadMessages.length,
    enabled: Boolean(convo),
  });

  useEffect(() => {
    if (!scrollToBottomAfterShareRef.current || threadMessages.length === 0) return;
    scrollToBottomAfterShareRef.current = false;
    scrollToBottom();
  }, [threadMessages.length, scrollToBottom]);

  const enrichMessages = useCallback(async (msgs: any[]): Promise<ChatMessage[]> => {
    const productIds = [...new Set(msgs.filter(m => m.shared_product_id).map(m => m.shared_product_id))];
    let productMap = new Map();
    if (productIds.length > 0) {
      const { data } = await api.from("products").select("id, name, price, image, seller_name, location, stock").in("id", productIds);
      if (data) productMap = new Map(data.map(p => [p.id, p]));
    }
    return msgs.map(m => ({
      ...m,
      shared_product: m.shared_product_id ? productMap.get(m.shared_product_id) || null : null,
    }));
  }, []);

  const handlePolledMessages = useCallback(async (raw: unknown[]) => {
    const enriched = await enrichMessages(raw as any[]);
    setMessages((prev) => mergeMessages(prev, enriched));
  }, [enrichMessages]);

  useChatThreadPoll(convo?.id, Boolean(convo?.id), handlePolledMessages);

  useConversationReceipts({
    conversationId: convo?.id,
    viewerRole: chatViewerRole,
    enabled: Boolean(convo?.id),
    messageCount: messages.length,
    onLocalUpdate: setMessages,
  });

  useEffect(() => {
    if (convo?.id) {
      setActiveConversationId(convo.id);
      setActiveViewerRole(chatViewerRole);
    }
    return () => {
      setActiveConversationId(null);
      setActiveViewerRole(null);
    };
  }, [convo?.id, chatViewerRole, setActiveConversationId, setActiveViewerRole]);

  useEffect(() => {
    if (convo?.id && user?.id) {
      patchInboxUnread(queryClient, user.id, convo.id, false);
    }
  }, [convo?.id, queryClient, user?.id]);

  useEffect(() => {
    if (!convo?.id || !user?.id) return;
    const at =
      convo.last_message_at ||
      messages[messages.length - 1]?.created_at;
    if (at) setChatAlertAck(user.id, convo.id, at);
  }, [convo?.id, convo?.last_message_at, user?.id, messages]);

  // Realtime subscription
  useEffect(() => {
    if (!convo?.id) return;
    const channel = api
      .channel(`chat-detail-${convo.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${convo.id}`,
      }, async (payload) => {
        const msg = payload.new as ChatMessage;
        const enriched = await enrichMessages([msg]);
        setMessages(prev => mergeMessages(prev, enriched));
      })
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [convo?.id, enrichMessages]);

  useEffect(() => {
    if (threadMessages.length > prevMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = threadMessages.length;
  }, [threadMessages.length]);

  const resurfaceProductCard = useCallback(() => {
    setHighlightProductCard(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => setHighlightProductCard(false), CHAT_PRODUCT_OPEN_HIGHLIGHT_MS);
  }, []);

  const sendWithMentionProducts = async (rawText: string, products: ChatMentionProduct[]) => {
    if (!convo || !user || products.length === 0) return false;
    setSending(true);
    const ok = await sendTextAndProductShares<ChatMessage>({
      conversationId: convo.id,
      senderId: user.id,
      senderRole: "buyer",
      rawText,
      products,
      chatGuard,
      onContactBlocked: () => setContactBlockedWarning(true),
      onChatGuardUpdate: setChatGuard,
      onOptimistic: (message) => setMessages((prev) => mergeMessages(prev, message)),
      onConfirmed: (tempId, message) =>
        setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== tempId), message)),
      onRollback: (tempId) => setMessages((prev) => prev.filter((m) => m.id !== tempId)),
      onError: () => toast.error("Failed to send"),
    });
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

  const handleSend = async () => {
    if (!canSendMessage || !convo || !user || sending) return;
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

    const lastReal = [...restMessages].reverse().find((m) => !String(m.id).startsWith("local-"));
    const idleMs = lastReal?.created_at
      ? Date.now() - new Date(lastReal.created_at).getTime()
      : CHAT_PRODUCT_RESURFACE_IDLE_MS + 1;

    if (products.length > 0) {
      setSending(true);
      setNewMsg("");
      setPendingMentionProducts([]);
      setMentionDraft("");
      const ok = await sendWithMentionProducts(text, products);
      if (!ok) {
        setNewMsg(text);
        setPendingMentionProducts(products);
      } else if (idleMs >= CHAT_PRODUCT_RESURFACE_IDLE_MS) {
        resurfaceProductCard();
      }
      return;
    }

    setSending(true);
    setNewMsg("");
    const ok = await sendMarketplaceMessage<ChatMessage>({
      conversationId: convo.id,
      senderId: user.id,
      senderRole: "buyer",
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
        toast.error("Failed to send");
      },
    });
    if (ok && idleMs >= CHAT_PRODUCT_RESURFACE_IDLE_MS) resurfaceProductCard();
    setSending(false);
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
    if (!convo || !user) return;
    const ok = await sendMarketplaceMessage<ChatMessage>({
      conversationId: convo.id,
      senderId: user.id,
      senderRole: "buyer",
      messageType: "product_share",
      sharedProductId: product.id,
      sharedProduct: product,
      productName: product.name,
      onOptimistic: (message) => setMessages((prev) => mergeMessages(prev, message)),
      onConfirmed: (tempId, message) =>
        setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== tempId), message)),
      onRollback: (tempId) => setMessages((prev) => prev.filter((m) => m.id !== tempId)),
      onError: () => toast.error("Failed to share product"),
    });
    if (ok) {
      setShareOpen(false);
      toast.success("Product shared");
    }
  };

  const loadShareProducts = async () => {
    const token = readSession()?.access_token;
    const q = encodeURIComponent(shareSearch || "");
    const res = await fetch(`${API_BASE}/v1/marketplace/chat/share-products?q=${q}&limit=20`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const body = (await res.json().catch(() => ({}))) as { data?: any[] };
    setShareProducts(res.ok ? body.data || [] : []);
  };

  useEffect(() => {
    if (shareOpen) loadShareProducts();
  }, [shareOpen, shareSearch]);

  const canDeleteDuplicate = Boolean(
    marketplaceShopBuyerChat &&
      convo?.is_superseded_duplicate &&
      !convo?.has_pending_report &&
      convo?.id
  );

  const handleDeleteConversation = async (conversationId: string, options?: { stayOnThread?: boolean }) => {
    if (!window.confirm("Remove this old duplicate chat? Messages in this thread will be deleted.")) return;
    try {
      await deleteMarketplaceConversation(conversationId);
      toast.success("Duplicate chat removed");
      queryClient.invalidateQueries({ queryKey: ["buyer-inbox", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["chat-bootstrap", resolvedConversationId, user?.id] });
      if (options?.stayOnThread) {
        setSupersededDuplicates((prev) => prev.filter((d) => d.id !== conversationId));
      } else {
        navigate("/marketplace/inbox", { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete chat");
    }
  };

  const handleDeleteDuplicate = async () => {
    if (!convo?.id || !canDeleteDuplicate) return;
    await handleDeleteConversation(convo.id);
  };

  if (isBootstrapLoading && !convo) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }
  if (!convo) return <div className="flex items-center justify-center h-64 text-muted-foreground">Conversation unavailable.</div>;

  const isBuyer = isSameParticipant(user?.id, convo.buyer_id);
  const isSelfChat = resolveSelfShopThread(convo);
  const shopLabel =
    isSelfChat && convo.shop_name === "FarmBondhu Support"
      ? null
      : convo.shop_name;
  const headerTitle = isSelfChat
    ? (shopLabel || "Your shop")
    : isBuyer
      ? (shopLabel || MARKETPLACE_SELLER_FALLBACK)
      : (convo.other_name || MARKETPLACE_SELLER_FALLBACK);
  const isSupportChat = isSelfChat && convo.shop_name === "FarmBondhu Support";
  const headerSubtitle = isSelfChat
    ? "Your own shop"
    : buyerShopThread
      ? "Message this shop"
      : isBuyer
        ? resolvedProduct
          ? `Ask about: ${resolvedProduct.name}`
          : "Seller"
        : `Buyer • ${convo.other_name || "User"}`;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-b-none border-b-0 overflow-hidden">
          <div className="h-1" style={{ background: marketplaceGradient() }} />
          <div className="flex items-center gap-3 p-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                navigate(
                  isSelfChat || !isBuyer
                    ? "/seller/dashboard?tab=messages"
                    : "/marketplace/inbox"
                )
              }
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: MARKETPLACE_THEME.primary }}>
              {headerTitle.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{headerTitle}</p>
              <p className="text-xs text-muted-foreground truncate">{headerSubtitle}</p>
              {isBootstrapRefreshing && <p className="text-[10px] text-muted-foreground">Refreshing...</p>}
            </div>
            {canDeleteDuplicate && (
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
            {!isSelfChat && (
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
            )}
          </div>

          {(userReported || convo.user_has_reported) && <ChatReportStatusBanner />}

          {buyerShopThread && convo.seller_id && (
            <Button
              variant="outline"
              className="mx-3 mb-3 w-[calc(100%-1.5rem)] justify-center text-sm"
              asChild
            >
              <Link to={shopPath(convo.seller_id)}>
                <Store className="h-4 w-4 mr-2" />
                Visit shop
              </Link>
            </Button>
          )}

          {sellerShopThread && convo.seller_id && (
            <Button
              variant="outline"
              className="mx-3 mb-3 w-[calc(100%-1.5rem)] justify-center text-sm"
              asChild
            >
              <Link to={shopPath(convo.seller_id)}>
                <Store className="h-4 w-4 mr-2" />
                Visit my shop
              </Link>
            </Button>
          )}

          {marketplaceShopBuyerChat && supersededDuplicates.length > 0 && (
            <div className="mx-3 mb-3 rounded-lg border bg-muted/20 p-2.5 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Older duplicate chats</p>
              {supersededDuplicates.map((dup) => (
                <div
                  key={dup.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-background/80 px-2 py-1.5"
                >
                  <span className="text-xs text-muted-foreground truncate">
                    {dup.last_message_at
                      ? new Date(dup.last_message_at).toLocaleDateString()
                      : "Older thread"}
                  </span>
                  {dup.has_pending_report ? (
                    <span className="text-[10px] text-muted-foreground shrink-0">Report pending</span>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive shrink-0"
                      onClick={() => void handleDeleteConversation(dup.id, { stayOnThread: true })}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {resolvedProduct && !shopThreadUi && (
            <ChatProductReferenceCard
              product={resolvedProduct}
              highlight={highlightProductCard}
              onClick={() => navigate(`/marketplace/${resolvedProduct.id}`)}
            />
          )}
        </Card>
      </motion.div>

      {/* Messages */}
      <Card className="flex-1 relative rounded-none border-y-0 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full p-4">
          <div className="space-y-3">
            {threadMessages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">Start the conversation!</p>
                {resolvedProduct && !shopThreadUi && (
                  <p className="text-xs text-muted-foreground mt-1">Ask about: {resolvedProduct.name}</p>
                )}
              </div>
            )}
            {threadDateGroups.map((group) => (
              <div key={group.dateKey} className="space-y-3">
                <ChatThreadDateDivider dateKey={group.dateKey} />
                {group.messages.map((msg) => {
              if (isAdminSupportMessage(msg)) {
                return (
                  <ChatAdminSupportBubble
                    key={msg.id}
                    messageId={msg.id}
                    textBody={msg.text_body}
                    createdAt={msg.created_at}
                  />
                );
              }

              const isMe = isBuyerSideMessage(msg, user?.id, isSelfChat);
              const isAnchor = isAnchorProductShareMessage(msg, convo?.product_id, messages);

              if (msg.message_type === "product_share" && msg.shared_product) {
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className="space-y-0.5 max-w-[85%]">
                      <button
                      onClick={() => navigate(`/marketplace/${msg.shared_product!.id}`)}
                      className={`max-w-[85%] rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-all ${isMe ? "bg-primary/5" : "bg-muted/50"} ${isAnchor && highlightProductCard ? "ring-2 ring-offset-1" : ""}`}
                      style={isAnchor && highlightProductCard ? { borderColor: MARKETPLACE_THEME.primary, ringColor: MARKETPLACE_THEME.primary } : undefined}
                    >
                      <div className="flex items-center gap-3 p-3">
                        <img src={msg.shared_product.image} alt={msg.shared_product.name} className="h-14 w-14 rounded-lg object-cover bg-accent shrink-0" />
                        <div className="text-left min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{msg.shared_product.name}</p>
                          <p className="text-sm font-bold" style={{ color: ICON_COLORS.health }}>৳{msg.shared_product.price}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Package className="h-3 w-3" />
                            <span>{msg.shared_product.stock > 0 ? "In Stock" : "Out of Stock"}</span>
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                      <div className="px-3 pb-1.5 flex items-center justify-end gap-1">
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {isMe && (
                          <ChatMessageReceipt
                            status={getOutboundReceiptStatus(msg, msg.sender_role === "seller" ? "seller" : "buyer")}
                          />
                        )}
                      </div>
                    </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className="space-y-0.5 max-w-[75%]">
                    <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                      isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"
                    }`}>
                    <ChatMessageTranslate
                      messageId={msg.id}
                      textBody={msg.text_body}
                      onPrimaryBubble={isMe}
                    />
                    <p className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {isMe && (
                        <ChatMessageReceipt
                          status={getOutboundReceiptStatus(msg, msg.sender_role === "seller" ? "seller" : "buyer")}
                          onPrimaryBubble
                        />
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
      </Card>

      {/* Input */}
      <Card className="rounded-t-none border-t overflow-visible">
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
        <form className="flex items-center gap-2 p-3" onSubmit={(e) => { e.preventDefault(); void handleSend(); }}>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setShareOpen(true)} title="Share Product">
            <Share2 className="h-4 w-4" style={{ color: MARKETPLACE_THEME.primary }} />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setMentionPickerOpen(true)} title="Attach product">
            <Package className="h-4 w-4" style={{ color: MARKETPLACE_THEME.primary }} />
          </Button>
          <ChatMentionComposerInput
            id="chatMessageInput"
            name="chatMessageInput"
            value={newMsg}
            onChange={setNewMsg}
            onMentionTagCompleted={handleMentionTagCompleted}
            mentionTags={mentionTags}
            placeholder="Type a message… type @ for product or report"
            disabled={sending || chatSendRestricted}
          />
          <Button type="submit" size="icon" disabled={sending || !canSendMessage} style={{ backgroundColor: MARKETPLACE_THEME.primary }} className="text-white shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>

      {/* Share Product Picker */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Share2 className="h-5 w-5" style={{ color: MARKETPLACE_THEME.primary }} />
              Share Product
            </DialogTitle>
            <DialogDescription>Search products and tap one to share with the buyer.</DialogDescription>
          </DialogHeader>
          <Input
            id="shareProductSearch"
            name="shareProductSearch"
            placeholder="Search products..."
            value={shareSearch}
            onChange={(e) => setShareSearch(e.target.value)}
          />
          <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
            <div className="space-y-2">
              {shareProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleShareProduct(p)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left border"
                >
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

      <ChatProductMentionPicker
        open={mentionPickerOpen}
        onOpenChange={setMentionPickerOpen}
        conversationId={convo.id}
        attachedProductIds={pendingMentionProducts.map((p) => p.id)}
        onSelect={handleMentionProductSelect}
        onCancel={() => toast.message("Select products to attach, then tap Done")}
      />

      {resolvedConversationId && (
        <ChatConversationReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          conversationId={resolvedConversationId}
          onSubmitted={() => setUserReported(true)}
        />
      )}
    </div>
  );
}
