import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, API_BASE, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, MessageCircle, Send, ExternalLink, Search, Users, Flag } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { motion } from "framer-motion";
import { withApiTiming } from "@/lib/perfMetrics";
import { mergeMessages, sendMarketplaceMessage } from "@/lib/marketplaceChatSend";
import { useChatThreadPoll } from "@/lib/marketplaceChatRealtime";
import { getOutboundReceiptStatus } from "@/lib/marketplaceChatReceipts";
import { useConversationReceipts } from "@/lib/useConversationReceipts";
import ChatMessageReceipt from "@/components/marketplace/ChatMessageReceipt";
import ChatMessageTranslate from "@/components/marketplace/ChatMessageTranslate";
import ChatProductReferenceCard from "@/components/marketplace/ChatProductReferenceCard";
import ChatScrollToBottomButton from "@/components/marketplace/ChatScrollToBottomButton";
import ChatThreadDateDivider from "@/components/marketplace/ChatThreadDateDivider";
import { groupMessagesByDate } from "@/lib/marketplaceChatDates";
import { useChatScrollToBottom } from "@/lib/useChatScrollToBottom";
import {
  CHAT_PRODUCT_OPEN_HIGHLIGHT_MS,
  isAnchorProductShareMessage,
  orderedThreadMessages,
  productReferenceFromInboxFields,
} from "@/lib/marketplaceChatProduct";
import { resolveSupportConversation } from "@/lib/platformSupportApi";
import { messageRole, isAdminSupportMessage, ADMIN_SUPPORT_MESSAGE_LABEL } from "@/lib/marketplaceChatRoles";

interface AdminConvoItem {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  last_message: string;
  last_message_at: string;
  buyer_name: string;
  seller_name: string;
  shop_name?: string;
  seller_phone?: string | null;
  has_report?: boolean;
  has_pending_report?: boolean;
  report_count?: number;
  latest_report_at?: string | null;
  latest_report_reason?: string | null;
  support_topic?: string | null;
  support_status?: string | null;
  product_name?: string;
  product_image?: string;
  product_price?: number;
  product_category?: string;
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
  sender_name?: string;
}

export type AdminChatInboxScope = "reported" | "farmbondhu" | "platform_support";

export default function AdminChatInbox({ scope = "reported" }: { scope?: AdminChatInboxScope }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<AdminConvoItem[]>([]);
  const [filtered, setFiltered] = useState<AdminConvoItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [highlightProductCard, setHighlightProductCard] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const selectedConvo = useMemo(
    () => (selected ? conversations.find((c) => c.id === selected) : undefined),
    [conversations, selected]
  );
  const threadMessages = useMemo(
    () => orderedThreadMessages(messages, selectedConvo?.product_id),
    [messages, selectedConvo?.product_id]
  );
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
    setLoading(true);
    const token = readSession()?.access_token;
    const query =
      scope === "farmbondhu"
        ? "?scope=farmbondhu"
        : scope === "platform_support"
          ? "?scope=platform_support"
          : "?scope=reported";
    const res = await withApiTiming("/v1/marketplace/chat/admin/bootstrap", () =>
      fetch(`${API_BASE}/v1/marketplace/chat/admin/bootstrap${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error("Failed to load conversations");
      setConversations([]);
      setFiltered([]);
      setLoading(false);
      return;
    }
    const convos = (body as { data?: AdminConvoItem[] }).data || [];
    setConversations(convos);
    setFiltered(convos);
    setLoading(false);
  }, [scope]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  const selectConversation = useCallback(
    (conversationId: string) => {
      setSelected(conversationId);
      const next = new URLSearchParams(searchParams);
      next.set("conversation", conversationId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    const conversationId = searchParams.get("conversation");
    if (conversationId && conversations.some((c) => c.id === conversationId)) {
      setSelected(conversationId);
    } else if (conversationId && !loading) {
      setSelected(null);
      toast.error("Conversation not available — it may not have a report yet");
    }
  }, [searchParams, conversations, loading]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(conversations); return; }
    const q = search.toLowerCase();
    setFiltered(conversations.filter(c =>
      c.buyer_name.toLowerCase().includes(q) ||
      c.seller_name.toLowerCase().includes(q) ||
      (c.shop_name && c.shop_name.toLowerCase().includes(q)) ||
      (c.seller_phone && c.seller_phone.toLowerCase().includes(q)) ||
      (c.product_name && c.product_name.toLowerCase().includes(q))
    ));
  }, [search, conversations]);

  const enrichMessages = useCallback(async (msgs: any[]): Promise<ChatMsg[]> => {
    const productIds = [...new Set(msgs.filter(m => m.shared_product_id).map(m => m.shared_product_id))];
    const senderIds = [...new Set(msgs.map(m => m.sender_id))];
    const [productRes, profileRes] = await Promise.all([
      productIds.length > 0
        ? api.from("products").select("id, name, price, image, stock").in("id", productIds)
        : Promise.resolve({ data: [] }),
      senderIds.length > 0
        ? api.from("profiles").select("id, name").in("id", senderIds)
        : Promise.resolve({ data: [] }),
    ]);
    const productMap = new Map((productRes.data || []).map(p => [p.id, p]));
    const profileMap = new Map((profileRes.data || []).map(p => [p.id, p.name]));

    return msgs.map(m => ({
      ...m,
      shared_product: m.shared_product_id ? productMap.get(m.shared_product_id) || null : null,
      sender_name: profileMap.get(m.sender_id) || "Unknown",
    }));
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

  // Load thread (bootstrap ensures anchor product_share)
  useEffect(() => {
    if (!selected) return;
    const loadThread = async () => {
      const token = readSession()?.access_token;
      const res = await fetch(`${API_BASE}/v1/marketplace/chat/conversations/${selected}/bootstrap`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        toast.error("Could not load conversation");
        return;
      }
      const body = (await res.json()) as { data?: { messages?: ChatMsg[] } };
      const raw = body.data?.messages || [];
      const enriched = await enrichMessages(raw);
      setMessages(enriched);
      prevMessageCountRef.current = 0;
      scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      setHighlightProductCard(true);
      window.setTimeout(() => setHighlightProductCard(false), CHAT_PRODUCT_OPEN_HIGHLIGHT_MS);
    };
    void loadThread();

    const channel = api
      .channel(`admin-thread-${selected}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${selected}` }, async (payload) => {
        const enriched = await enrichMessages([payload.new as any]);
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

  const sendReply = async () => {
    if (!newMsg.trim() || !selected || !user) return;
    const text = newMsg.trim();
    setNewMsg("");
    const senderRole = scope === "reported" ? "admin" : "seller";
    const senderLabel = scope === "reported" ? ADMIN_SUPPORT_MESSAGE_LABEL : "Platform Support";
    const ok = await sendMarketplaceMessage<ChatMsg>({
      conversationId: selected,
      senderId: user.id,
      senderRole,
      messageType: "text",
      textBody: text,
      onOptimistic: (message) => setMessages((prev) => mergeMessages(prev, { ...message, sender_name: senderLabel })),
      onConfirmed: (tempId, message) =>
        setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== tempId), { ...message, sender_name: senderLabel })),
      onRollback: (tempId) => {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setNewMsg(text);
      },
      onError: (message) => toast.error(message),
    });
    if (!ok) setNewMsg(text);
  };

  const handleResolve = async () => {
    if (!selected || scope !== "platform_support") return;
    try {
      await resolveSupportConversation(selected);
      setConversations((prev) =>
        prev.map((c) => (c.id === selected ? { ...c, support_status: "resolved" } : c))
      );
      toast.success("Marked as resolved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resolve");
    }
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

  const conv = selected ? conversations.find((c) => c.id === selected) : undefined;
  const threadProduct = scope === "platform_support" ? null : conv ? productReferenceFromInboxFields(conv) : null;
  const isPlatformSupport = scope === "platform_support";
  const isMarketplaceScope = scope === "reported";
  const canAdminReply = isPlatformSupport || (isMarketplaceScope ? Boolean(conv?.has_pending_report) : true);
  const sellerAdminLine = conv
    ? [conv.shop_name, conv.seller_name, conv.seller_phone || "—"].filter(Boolean).join(" · ")
    : "";

  const listTitle =
    scope === "platform_support"
      ? "Customer Support"
      : scope === "reported"
        ? "Reported conversations"
        : "FarmBondhu conversations";

  const emptyListMessage =
    search
      ? "No matching conversations"
      : scope === "platform_support"
        ? "No customer support chats yet"
        : scope === "reported"
          ? "No reported marketplace conversations"
          : "No FarmBondhu conversations yet";

  return (
    <div className="grid lg:grid-cols-[minmax(280px,360px)_1fr] gap-4 min-h-[520px]">
      <Card className="shadow-card overflow-hidden flex flex-col min-h-[400px] lg:min-h-[520px]">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, ${ICON_COLORS.marketplace})` }} />
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" style={{ color: ICON_COLORS.admin }} />
            {listTitle}
            <Badge variant="outline" className="ml-1 text-xs">{filtered.length}</Badge>
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={scope === "platform_support" ? "Search by buyer..." : "Search by buyer, seller, or product..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-[min(420px,50vh)] lg:h-[calc(520px-8rem)]">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading conversations...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 space-y-3 px-4">
                <Users className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">{emptyListMessage}</p>
                {scope === "reported" && !search && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/marketplace/reports">View Chat Reports</Link>
                  </Button>
                )}
              </div>
            ) : (
              filtered.map((c, i) => (
                <motion.button
                  key={c.id}
                  type="button"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => selectConversation(c.id)}
                  className={`w-full flex items-center gap-3 p-3.5 hover:bg-muted/40 transition-colors border-b last:border-b-0 text-left ${
                    selected === c.id ? "bg-muted/60 ring-1 ring-inset ring-primary/20" : ""
                  }`}
                >
                  {c.product_image ? (
                    <img src={c.product_image} alt="" className="h-12 w-12 rounded-lg object-cover bg-accent shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${ICON_COLORS.admin}1A` }}>
                      <MessageCircle className="h-5 w-5" style={{ color: ICON_COLORS.admin }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">{c.buyer_name}</span>
                        {isMarketplaceScope && c.has_report && (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">
                            <Flag className="h-3 w-3 mr-0.5" />Reported
                          </Badge>
                        )}
                        {scope === "farmbondhu" && (
                          <>
                            <span className="text-muted-foreground text-xs">↔</span>
                            <span className="text-sm font-medium truncate" style={{ color: ICON_COLORS.marketplace }}>{c.seller_name}</span>
                          </>
                        )}
                        {scope === "platform_support" && c.support_topic && (
                          <Badge variant="outline" className="text-[9px] capitalize">{c.support_topic}</Badge>
                        )}
                        {scope === "platform_support" && c.support_status === "resolved" && (
                          <Badge variant="outline" className="text-[9px]">Resolved</Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(c.last_message_at)}</span>
                    </div>
                    {isMarketplaceScope && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        Seller: {[c.shop_name, c.seller_name, c.seller_phone || "—"].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {c.product_name && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs truncate" style={{ color: ICON_COLORS.marketplace }}>
                          {c.product_name}
                        </p>
                        {c.product_category && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{c.product_category}</Badge>
                        )}
                        {c.product_price != null && (
                          <span className="text-[10px] font-semibold shrink-0" style={{ color: ICON_COLORS.health }}>৳{c.product_price}</span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message}</p>
                  </div>
                </motion.button>
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="min-h-[400px] lg:min-h-[520px]">
        {!selected ? (
          <Card className="shadow-card h-full flex items-center justify-center">
            <CardContent className="py-16 text-center space-y-2">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">
                {scope === "reported"
                  ? "Select a reported conversation to review messages"
                  : "Select a conversation from the list"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card overflow-hidden h-full flex flex-col">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, ${ICON_COLORS.marketplace})` }} />
            <div className="flex items-center gap-3 p-3 border-b bg-muted/30 shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-foreground truncate">
                {isPlatformSupport
                  ? conv?.buyer_name
                  : (
                    <>
                      {conv?.buyer_name}
                      {isMarketplaceScope && sellerAdminLine && (
                        <span className="text-muted-foreground font-normal text-xs block sm:inline sm:ml-2">
                          Seller: {sellerAdminLine}
                        </span>
                      )}
                      {!isMarketplaceScope && (
                        <>
                          <span className="text-muted-foreground font-normal"> ↔ </span>
                          {conv?.seller_name}
                        </>
                      )}
                    </>
                  )}
              </p>
              {isMarketplaceScope && conv?.has_report && (
                <Badge variant="destructive" className="text-[10px] shrink-0">
                  <Flag className="h-3 w-3 mr-0.5" />Reported
                </Badge>
              )}
              {isPlatformSupport && conv?.support_topic && (
                <Badge variant="outline" className="text-[10px] capitalize">{conv.support_topic}</Badge>
              )}
              {isPlatformSupport && conv?.support_status === "resolved" && (
                <Badge variant="outline" className="text-[10px]">Resolved</Badge>
              )}
              <Badge className="text-[10px] shrink-0" style={{ backgroundColor: ICON_COLORS.admin, color: "white" }}>
                <ShieldCheck className="h-3 w-3 mr-0.5" />Admin View
              </Badge>
            </div>
                {isMarketplaceScope && conv?.latest_report_reason && (
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">
                    Latest report: {conv.latest_report_reason}
                    {conv.latest_report_at ? ` · ${new Date(conv.latest_report_at).toLocaleString()}` : ""}
                  </p>
                )}
              </div>
              {isPlatformSupport && conv?.support_status !== "resolved" && (
                <Button size="sm" variant="outline" onClick={handleResolve}>
                  Mark resolved
                </Button>
              )}
            </div>
        {threadProduct && (
          <ChatProductReferenceCard
            product={threadProduct}
            variant="compact"
            highlight={highlightProductCard}
            onClick={() => navigate(`/admin/marketplace?product=${threadProduct.id}`)}
          />
        )}

        <div className="relative flex-1 min-h-0">
          <ScrollArea ref={scrollAreaRef} className="h-[min(320px,40vh)] lg:h-[calc(520px-12rem)] p-3">
          <div className="space-y-2">
            {threadDateGroups.map((group) => (
              <div key={group.dateKey} className="space-y-2">
                <ChatThreadDateDivider dateKey={group.dateKey} />
                {group.messages.map((m) => {
              const isAdminMsg = isAdminSupportMessage(m);
              const isAdminSender = m.sender_id === user?.id && !isAdminMsg;
              const isSellerById = m.sender_id === conv?.seller_id;
              const isSupportSide = isPlatformSupport
                ? messageRole(m) === "seller"
                : isAdminMsg || isAdminSender || isSellerById;
              const isAnchor = isAnchorProductShareMessage(m, conv?.product_id, messages);
              const senderLabel = isAdminMsg
                ? ADMIN_SUPPORT_MESSAGE_LABEL
                : isSupportSide
                  ? "Platform Support"
                  : isPlatformSupport
                    ? conv?.buyer_name || m.sender_name
                    : m.sender_name;

              if (m.message_type === "product_share" && m.shared_product) {
                if (isPlatformSupport && isAnchor) return null;
                return (
                  <div key={m.id} className={`flex ${isSupportSide ? "justify-end" : "justify-start"}`}>
                    <div className="space-y-0.5">
                      <p className={`text-[10px] px-1 ${isSupportSide ? "text-right" : "text-left"}`} style={{ color: isSupportSide ? ICON_COLORS.admin : ICON_COLORS.farm }}>
                        {senderLabel}
                      </p>
                      <button onClick={() => navigate(`/admin/marketplace?product=${m.shared_product.id}`)}
                        className={`max-w-[80%] rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-all bg-muted/50 ${isAnchor && highlightProductCard ? "ring-2 ring-offset-1" : ""}`}
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
                    </div>
                  </div>
                );
              }

              return (
                <div key={m.id} className={`flex ${isSupportSide ? "justify-end" : "justify-start"}`}>
                  <div className="space-y-0.5 max-w-[75%]">
                    <p className={`text-[10px] px-1 ${isSupportSide ? "text-right" : "text-left"}`} style={{ color: isSupportSide ? ICON_COLORS.admin : ICON_COLORS.farm }}>
                      {senderLabel}
                    </p>
                    <div className={`rounded-2xl px-3 py-2 text-sm ${
                      isSupportSide
                        ? "rounded-br-md text-white"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`} style={isSupportSide ? { backgroundColor: ICON_COLORS.admin } : undefined}>
                      <ChatMessageTranslate
                        messageId={m.id}
                        textBody={m.text_body}
                        onPrimaryBubble={isSupportSide}
                      />
                      <p className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${isSupportSide ? "text-white/60" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {isSupportSide && (
                          <ChatMessageReceipt
                            status={getOutboundReceiptStatus(m, "seller")}
                            onPrimaryBubble={isSupportSide}
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
        </div>

        <div className="flex flex-col gap-2 p-3 border-t bg-muted/20">
          {isMarketplaceScope && !canAdminReply && (
            <p className="text-xs text-muted-foreground text-center px-2">
              View only — a buyer or seller must report this conversation before you can reply.
            </p>
          )}
          {canAdminReply && (
            <div className="flex gap-2">
              <Input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                placeholder={isMarketplaceScope ? "Reply as Platform Support from admin..." : "Reply as Platform Support..."}
                onKeyDown={e => e.key === "Enter" && sendReply()}
                className="flex-1"
              />
              <Button size="icon" onClick={sendReply} disabled={!newMsg.trim()} style={{ backgroundColor: ICON_COLORS.admin }} className="text-white shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
          </Card>
        )}
      </div>
    </div>
  );
}
