import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_BASE, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Send, Headphones } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { moduleCachePolicy } from "@/lib/queryClient";
import {
  mergeMessages,
  sendMarketplaceMessage,
  normalizeChatGuard,
  type MarketplaceChatGuardState,
} from "@/lib/marketplaceChatSend";
import ChatContactBlockedBanner from "@/components/marketplace/ChatContactBlockedBanner";
import { useLiveChatRestriction } from "@/lib/useLiveChatRestriction";
import { useChatThreadPoll } from "@/lib/marketplaceChatRealtime";
import { messageRole } from "@/lib/marketplaceChatRoles";
import { orderedThreadMessages } from "@/lib/marketplaceChatProduct";
import { getOutboundReceiptStatus } from "@/lib/marketplaceChatReceipts";
import { useConversationReceipts } from "@/lib/useConversationReceipts";
import ChatMessageReceipt from "@/components/marketplace/ChatMessageReceipt";
import ChatMessageTranslate from "@/components/marketplace/ChatMessageTranslate";
import ChatScrollToBottomButton from "@/components/marketplace/ChatScrollToBottomButton";
import ChatThreadDateDivider from "@/components/marketplace/ChatThreadDateDivider";
import { groupMessagesByDate } from "@/lib/marketplaceChatDates";
import { useChatScrollToBottom } from "@/lib/useChatScrollToBottom";
import { useLanguage } from "@/contexts/LanguageContext";
import { getWorkspaceAccent, getWorkspaceSupportBase } from "@/lib/workspaceAccent";

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_role?: string | null;
  message_type: string;
  text_body: string | null;
  created_at: string;
  buyer_delivered_at?: string | null;
  buyer_read_at?: string | null;
  seller_delivered_at?: string | null;
  seller_read_at?: string | null;
}

interface ConversationInfo {
  id: string;
  buyer_id: string;
  seller_id: string;
  support_topic?: string | null;
  support_status?: string | null;
  shop_name?: string | null;
  other_name?: string;
}

export default function SupportChatThread() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const accent = getWorkspaceAccent(location.pathname);
  const supportBase = getWorkspaceSupportBase(location.pathname);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [convo, setConvo] = useState<ConversationInfo | null>(null);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [contactBlockedWarning, setContactBlockedWarning] = useState(false);
  const [chatGuard, setChatGuard] = useState<MarketplaceChatGuardState>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const { data: bootstrapData, isLoading } = useQuery({
    queryKey: ["support-chat-bootstrap", conversationId, user?.id],
    enabled: Boolean(conversationId && user?.id),
    staleTime: moduleCachePolicy.marketplace.staleTime,
    gcTime: moduleCachePolicy.marketplace.gcTime,
    refetchOnMount: "always",
    queryFn: async () => {
      const token = readSession()?.access_token;
      const res = await fetch(`${API_BASE}/v1/marketplace/chat/support/conversations/${conversationId}/bootstrap`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load conversation");
      const body = (await res.json()) as {
        data?: { conversation?: ConversationInfo; messages?: ChatMessage[]; chat_guard?: MarketplaceChatGuardState };
      };
      return body.data || { conversation: null, messages: [] };
    },
  });

  useEffect(() => {
    if (!bootstrapData?.conversation) return;
    setConvo(bootstrapData.conversation);
    setMessages(bootstrapData.messages || []);
    if (bootstrapData.chat_guard) setChatGuard(normalizeChatGuard(bootstrapData.chat_guard));
  }, [bootstrapData, conversationId]);

  const threadMessages = useMemo(
    () => orderedThreadMessages(messages.filter((m) => m.message_type === "text"), null),
    [messages]
  );
  const threadDateGroups = useMemo(() => groupMessagesByDate(threadMessages), [threadMessages]);

  const { showScrollDown, scrollToBottom } = useChatScrollToBottom({
    scrollAreaRef,
    bottomRef,
    messageCount: threadMessages.length,
    enabled: Boolean(convo),
  });

  const handlePolledMessages = useCallback((raw: unknown[]) => {
    setMessages((prev) => mergeMessages(prev, raw as ChatMessage[]));
  }, []);

  useChatThreadPoll(convo?.id, Boolean(convo?.id), handlePolledMessages);

  useConversationReceipts({
    conversationId: convo?.id,
    viewerRole: "buyer",
    enabled: Boolean(convo?.id),
    messageCount: messages.length,
    onLocalUpdate: setMessages,
  });

  useEffect(() => {
    if (threadMessages.length > prevMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = threadMessages.length;
  }, [threadMessages.length]);

  const { isRestricted: chatSendRestricted } = useLiveChatRestriction(chatGuard.restrictedUntil);
  const isResolved = convo?.support_status === "resolved";
  const canSend = Boolean(newMsg.trim()) && !chatSendRestricted && !isResolved;

  const handleSend = async () => {
    if (!canSend || !convo || !user || sending) return;
    const text = newMsg.trim();
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
      onError: () => toast.error(t("support.sendFailed")),
    });
    if (!ok) setNewMsg(text);
    setSending(false);
  };

  if (isLoading && !convo) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">{t("support.loading")}</div>;
  }
  if (!convo) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">{t("support.unavailable")}</div>;
  }

  const topicLabel =
    convo.support_topic === "complaint" ? t("support.complaint") : t("support.needHelp");

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-b-none border-b-0 overflow-hidden">
          <div className="h-1" style={{ backgroundColor: accent }} />
          <div className="flex items-center gap-3 p-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(supportBase)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: accent }}
            >
              <Headphones className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">
                {convo.shop_name || "FarmBondhu Support"}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] capitalize">
                  {topicLabel}
                </Badge>
                {isResolved && (
                  <Badge className="text-[10px]" style={{ backgroundColor: `${accent}20`, color: accent }}>
                    {t("support.resolved")}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <Card className="flex-1 relative rounded-none border-y-0 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full p-4">
          <div className="space-y-3">
            {threadMessages.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-12">{t("support.startConversation")}</p>
            )}
            {threadDateGroups.map((group) => (
              <div key={group.dateKey} className="space-y-3">
                <ChatThreadDateDivider dateKey={group.dateKey} />
                {group.messages.map((msg) => {
                  const isMe = messageRole(msg) === "buyer";
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className="space-y-0.5 max-w-[75%]">
                        {!isMe && (
                          <p className="text-[10px] px-1" style={{ color: accent }}>
                            {convo.shop_name || "Support"}
                          </p>
                        )}
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm ${
                            isMe ? "text-white rounded-br-md" : "bg-muted text-foreground rounded-bl-md"
                          }`}
                          style={isMe ? { backgroundColor: accent } : undefined}
                        >
                          <ChatMessageTranslate messageId={msg.id} textBody={msg.text_body} onPrimaryBubble={isMe} />
                        </div>
                        <div className={`flex items-center gap-1 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {isMe && (
                            <ChatMessageReceipt status={getOutboundReceiptStatus(msg, "buyer")} />
                          )}
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

      <Card className="rounded-t-none border-t-0 p-3 space-y-2">
        {contactBlockedWarning && <ChatContactBlockedBanner />}
        {isResolved ? (
          <p className="text-sm text-muted-foreground text-center py-2">{t("support.resolvedHint")}</p>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder={t("support.messagePlaceholder")}
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={chatSendRestricted}
            />
            <Button
              size="icon"
              disabled={!canSend || sending}
              onClick={handleSend}
              style={{ backgroundColor: accent }}
              className="text-white shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
