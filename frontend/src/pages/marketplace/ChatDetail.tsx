import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { API_BASE, api, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Send, Share2, MapPin, Star, Package, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { moduleCachePolicy } from "@/lib/queryClient";

interface ChatMessage {
  id: string;
  sender_id: string;
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
}

export default function ChatDetail() {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [convo, setConvo] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [resolvedConversationId, setResolvedConversationId] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareProducts, setShareProducts] = useState<any[]>([]);
  const [shareSearch, setShareSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

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

        // Check existing
        const { data: existing } = await api
          .from("conversations")
          .select("id")
          .eq("buyer_id", user.id)
          .eq("seller_id", sellerId)
          .eq("product_id", productId)
          .maybeSingle();

        if (existing) {
          setResolvedConversationId(existing.id);
          navigate(`/marketplace/chat/${existing.id}`, { replace: true });
        } else {
          const { data: created, error } = await api
            .from("conversations")
            .insert({ buyer_id: user.id, seller_id: sellerId, product_id: productId })
            .select("id")
            .single();
          if (error || !created) { toast.error("Could not start conversation"); navigate("/marketplace/inbox"); return; }
          setResolvedConversationId(created.id);
          navigate(`/marketplace/chat/${created.id}`, { replace: true });

          // Insert system message with product reference
          await api.from("chat_messages").insert({
            conversation_id: created.id,
            sender_id: user.id,
            message_type: "product_share",
            shared_product_id: productId,
          });
        }
    };

    resolveConversation();
  }, [conversationId, navigate, searchParams, user]);

  const { data: bootstrapData, isLoading: isBootstrapLoading } = useQuery({
    queryKey: ["chat-bootstrap", resolvedConversationId, user?.id],
    enabled: Boolean(resolvedConversationId && user?.id),
    staleTime: moduleCachePolicy.marketplace.staleTime,
    gcTime: moduleCachePolicy.marketplace.gcTime,
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
        data?: { conversation?: ConversationInfo; messages?: ChatMessage[] };
      };
      return body.data || { conversation: null, messages: [] };
    },
  });

  useEffect(() => {
    if (!resolvedConversationId) return;
    if (!bootstrapData?.conversation) return;
    setConvo(bootstrapData.conversation);
    setMessages(bootstrapData.messages || []);
  }, [bootstrapData, resolvedConversationId]);

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
        const msg = payload.new as any;
        const enriched = await enrichMessages([msg]);
        setMessages(prev => [...prev, ...enriched]);
      })
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [convo?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const enrichMessages = async (msgs: any[]): Promise<ChatMessage[]> => {
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
  };

  const handleSend = async () => {
    if (!newMsg.trim() || !convo || sending) return;
    setSending(true);
    const { error } = await api.from("chat_messages").insert({
      conversation_id: convo.id,
      sender_id: user!.id,
      message_type: "text",
      text_body: newMsg.trim(),
    });
    if (!error) {
      await api.from("conversations").update({
        last_message: newMsg.trim(),
        last_message_at: new Date().toISOString(),
      }).eq("id", convo.id);
      setNewMsg("");
    } else {
      toast.error("Failed to send");
    }
    setSending(false);
  };

  const handleShareProduct = async (product: any) => {
    if (!convo) return;
    await api.from("chat_messages").insert({
      conversation_id: convo.id,
      sender_id: user!.id,
      message_type: "product_share",
      shared_product_id: product.id,
    });
    await api.from("conversations").update({
      last_message: `Shared: ${product.name}`,
      last_message_at: new Date().toISOString(),
    }).eq("id", convo.id);
    setShareOpen(false);
    toast.success("Product shared");
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

  if (isBootstrapLoading && !convo) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }
  if (!convo) return <div className="flex items-center justify-center h-64 text-muted-foreground">Conversation unavailable.</div>;

  const isBuyer = user?.id === convo.buyer_id;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-b-none border-b-0 overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
          <div className="flex items-center gap-3 p-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(isBuyer ? "/marketplace/inbox" : "/seller/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: ICON_COLORS.marketplace }}>
              {convo.other_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{convo.shop_name || convo.other_name}</p>
              <p className="text-xs text-muted-foreground truncate">{isBuyer ? "Seller" : "Buyer"} • {convo.other_name}</p>
            </div>
          </div>

          {/* Product Reference Card */}
          {convo.product && (
            <button
              onClick={() => navigate(`/marketplace/${convo.product!.id}`)}
              className="flex items-center gap-3 mx-3 mb-3 p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors text-left w-[calc(100%-1.5rem)]"
            >
              <img src={convo.product.image} alt={convo.product.name} className="h-12 w-12 rounded-md object-cover bg-accent" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{convo.product.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold" style={{ color: ICON_COLORS.health }}>৳{convo.product.price}</span>
                  <span className="flex items-center gap-0.5"><Star className="h-3 w-3" style={{ color: ICON_COLORS.finance, fill: ICON_COLORS.finance }} />{convo.product.rating}</span>
                  <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{convo.product.location}</span>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          )}
        </Card>
      </motion.div>

      {/* Messages */}
      <Card className="flex-1 rounded-none border-y-0 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">Start the conversation!</p>
                {convo.product && (
                  <p className="text-xs text-muted-foreground mt-1">Ask about: {convo.product.name}</p>
                )}
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.sender_id === user?.id;

              if (msg.message_type === "product_share" && msg.shared_product) {
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <button
                      onClick={() => navigate(`/marketplace/${msg.shared_product!.id}`)}
                      className={`max-w-[85%] rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow ${isMe ? "bg-primary/5" : "bg-muted/50"}`}
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
                      <div className="px-3 pb-1.5">
                        <p className="text-[10px] text-muted-foreground text-right">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </button>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.text_body}</p>
                    <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </Card>

      {/* Input */}
      <Card className="rounded-t-none border-t overflow-hidden">
        <form className="flex items-center gap-2 p-3" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setShareOpen(true)} title="Share Product">
            <Share2 className="h-4 w-4" style={{ color: ICON_COLORS.marketplace }} />
          </Button>
          <Input
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={sending || !newMsg.trim()} style={{ backgroundColor: ICON_COLORS.marketplace }} className="text-white shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>

      {/* Share Product Picker */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Share2 className="h-5 w-5" style={{ color: ICON_COLORS.marketplace }} />
              Share Product
            </DialogTitle>
            <DialogDescription>Search products and tap one to share with the buyer.</DialogDescription>
          </DialogHeader>
          <Input
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
    </div>
  );
}
