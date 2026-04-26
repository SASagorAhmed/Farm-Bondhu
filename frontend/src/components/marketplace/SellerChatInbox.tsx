import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/api/client";
import { MessageCircle, Send, ArrowLeft, ExternalLink, Share2, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { motion } from "framer-motion";

interface ConvoItem {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  last_message: string;
  last_message_at: string;
  buyer_name: string;
  product_name?: string;
  product_image?: string;
  product_price?: number;
}

interface ChatMsg {
  id: string;
  sender_id: string;
  message_type: string;
  text_body: string | null;
  shared_product_id: string | null;
  created_at: string;
  shared_product?: any;
}

export default function SellerChatInbox({ sellerId }: { sellerId: string }) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConvoItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareProducts, setShareProducts] = useState<any[]>([]);
  const [shareSearch, setShareSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    setLoading(true);
    setLoadError(null);
    const { data: convos, error } = await api
      .from("conversations")
      .select("*")
      .eq("seller_id", sellerId)
      .order("last_message_at", { ascending: false });

    if (error) {
      setConversations([]);
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    if (!convos || convos.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const buyerIds = [...new Set(convos.map(c => c.buyer_id))];
    const productIds = [...new Set(convos.filter(c => c.product_id).map(c => c.product_id!))];

    const [{ data: profiles }, { data: products }] = await Promise.all([
      api.from("profiles").select("id, name").in("id", buyerIds),
      productIds.length > 0
        ? api.from("products").select("id, name, image, price").in("id", productIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map((profiles || []).map(p => [p.id, p.name]));
    const productMap = new Map((products || []).map(p => [p.id, p]));

    setConversations(convos.map(c => {
      const product = c.product_id ? productMap.get(c.product_id) : null;
      return {
        id: c.id,
        buyer_id: c.buyer_id,
        seller_id: c.seller_id,
        product_id: c.product_id,
        last_message: c.last_message || "New conversation",
        last_message_at: c.last_message_at,
        buyer_name: profileMap.get(c.buyer_id) || "Buyer",
        product_name: product?.name,
        product_image: product?.image,
        product_price: product?.price,
      };
    }));
    setLoading(false);
  };

  useEffect(() => {
    if (!sellerId) return;
    loadConversations();
    const channel = api
      .channel(`seller-inbox-${sellerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `seller_id=eq.${sellerId}` }, () => loadConversations())
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [sellerId]);

  // Load thread
  useEffect(() => {
    if (!selected) return;
    const loadThread = async () => {
      const { data: msgs } = await api
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", selected)
        .order("created_at", { ascending: true });
      const enriched = await enrichMessages(msgs || []);
      setMessages(enriched);
    };
    loadThread();

    const channel = api
      .channel(`seller-thread-${selected}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${selected}` }, async (payload) => {
        const enriched = await enrichMessages([payload.new as any]);
        setMessages(prev => [...prev, ...enriched]);
      })
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [selected]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const enrichMessages = async (msgs: any[]): Promise<ChatMsg[]> => {
    const productIds = [...new Set(msgs.filter(m => m.shared_product_id).map(m => m.shared_product_id))];
    let productMap = new Map();
    if (productIds.length > 0) {
      const { data } = await api.from("products").select("id, name, price, image, stock").in("id", productIds);
      if (data) productMap = new Map(data.map(p => [p.id, p]));
    }
    return msgs.map(m => ({ ...m, shared_product: m.shared_product_id ? productMap.get(m.shared_product_id) || null : null }));
  };

  const sendReply = async () => {
    if (!newMsg.trim() || !selected) return;
    const { error } = await api.from("chat_messages").insert({
      conversation_id: selected,
      sender_id: sellerId,
      message_type: "text",
      text_body: newMsg.trim(),
    });
    if (error) return toast.error(error.message);
    await api.from("conversations").update({
      last_message: newMsg.trim(),
      last_message_at: new Date().toISOString(),
    }).eq("id", selected);
    setNewMsg("");
  };

  const handleShareProduct = async (product: any) => {
    if (!selected) return;
    await api.from("chat_messages").insert({
      conversation_id: selected,
      sender_id: sellerId,
      message_type: "product_share",
      shared_product_id: product.id,
    });
    await api.from("conversations").update({
      last_message: `Shared: ${product.name}`,
      last_message_at: new Date().toISOString(),
    }).eq("id", selected);
    setShareOpen(false);
    toast.success("Product shared");
  };

  useEffect(() => {
    if (!shareOpen) return;
    api.from("products").select("id, name, price, image, category, stock")
      .eq("seller_id", sellerId).ilike("name", `%${shareSearch}%`).limit(20)
      .then(({ data }) => setShareProducts(data || []));
  }, [shareOpen, shareSearch, sellerId]);

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
    const conv = conversations.find(c => c.id === selected);
    return (
      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
        <div className="flex items-center gap-3 p-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{conv?.buyer_name}</p>
            {conv?.product_name && (
              <button onClick={() => navigate(`/marketplace/${conv.product_id}`)} className="text-xs truncate flex items-center gap-1 hover:underline" style={{ color: ICON_COLORS.marketplace }}>
                {conv.product_name} <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[350px] p-3">
          <div className="space-y-2">
            {messages.map(m => {
              const isMe = m.sender_id === sellerId;
              if (m.message_type === "product_share" && m.shared_product) {
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <button onClick={() => navigate(`/marketplace/${m.shared_product.id}`)}
                      className={`max-w-[80%] rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow ${isMe ? "bg-primary/5" : "bg-muted/50"}`}>
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
                );
              }
              return (
                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                    {m.text_body}
                    <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        <div className="flex gap-2 p-3 border-t">
          <Button variant="ghost" size="icon" onClick={() => setShareOpen(true)} className="shrink-0" title="Share Product">
            <Share2 className="h-4 w-4" style={{ color: ICON_COLORS.marketplace }} />
          </Button>
          <Input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type reply..." onKeyDown={e => e.key === "Enter" && sendReply()} className="flex-1" />
          <Button size="icon" onClick={sendReply} disabled={!newMsg.trim()} style={{ backgroundColor: ICON_COLORS.marketplace }} className="text-white shrink-0"><Send className="h-4 w-4" /></Button>
        </div>

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
      </Card>
    );
  }

  return (
    <Card className="shadow-card overflow-hidden">
      <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
      <CardContent className="p-0">
        {conversations.map((c, i) => (
          <motion.button
            key={c.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => setSelected(c.id)}
            className="w-full flex items-center gap-3 p-3.5 hover:bg-muted/40 transition-colors border-b last:border-b-0 text-left"
          >
            {c.product_image ? (
              <img src={c.product_image} alt="" className="h-11 w-11 rounded-lg object-cover bg-accent shrink-0" />
            ) : (
              <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MessageCircle className="h-5 w-5" style={{ color: ICON_COLORS.marketplace }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm text-foreground truncate">{c.buyer_name}</p>
                <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(c.last_message_at)}</span>
              </div>
              {c.product_name && (
                <p className="text-xs truncate" style={{ color: ICON_COLORS.marketplace }}>
                  {c.product_name} {c.product_price ? `• ৳${c.product_price}` : ""}
                </p>
              )}
              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message}</p>
            </div>
          </motion.button>
        ))}
      </CardContent>
    </Card>
  );
}
