import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, API_BASE, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, MessageCircle, Send, ArrowLeft, ExternalLink, Share2, Search, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { motion } from "framer-motion";
import { withApiTiming } from "@/lib/perfMetrics";

interface AdminConvoItem {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  last_message: string;
  last_message_at: string;
  buyer_name: string;
  seller_name: string;
  product_name?: string;
  product_image?: string;
  product_price?: number;
  product_category?: string;
}

interface ChatMsg {
  id: string;
  sender_id: string;
  message_type: string;
  text_body: string | null;
  shared_product_id: string | null;
  created_at: string;
  shared_product?: any;
  sender_name?: string;
}

export default function AdminChatInbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<AdminConvoItem[]>([]);
  const [filtered, setFiltered] = useState<AdminConvoItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareProducts, setShareProducts] = useState<any[]>([]);
  const [shareSearch, setShareSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    setLoading(true);
    const token = readSession()?.access_token;
    const res = await withApiTiming("/v1/marketplace/chat/admin/bootstrap", () =>
      fetch(`${API_BASE}/v1/marketplace/chat/admin/bootstrap`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    );
    const body = await res.json().catch(() => ({}));
    const convos = (body as { data?: AdminConvoItem[] }).data;

    if (!res.ok || !convos || convos.length === 0) {
      setConversations([]);
      setFiltered([]);
      setLoading(false);
      return;
    }
    const mapped = convos;
    setConversations(mapped);
    setFiltered(mapped);
    setLoading(false);
  };

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(conversations); return; }
    const q = search.toLowerCase();
    setFiltered(conversations.filter(c =>
      c.buyer_name.toLowerCase().includes(q) ||
      c.seller_name.toLowerCase().includes(q) ||
      (c.product_name && c.product_name.toLowerCase().includes(q))
    ));
  }, [search, conversations]);

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
      .channel(`admin-thread-${selected}`)
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
  };

  const sendReply = async () => {
    if (!newMsg.trim() || !selected || !user) return;
    const { error } = await api.from("chat_messages").insert({
      conversation_id: selected,
      sender_id: user.id,
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
    if (!selected || !user) return;
    await api.from("chat_messages").insert({
      conversation_id: selected,
      sender_id: user.id,
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
      .ilike("name", `%${shareSearch}%`).limit(20)
      .then(({ data }) => setShareProducts(data || []));
  }, [shareOpen, shareSearch]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  // Thread view
  if (selected) {
    const conv = conversations.find(c => c.id === selected);
    return (
      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, ${ICON_COLORS.marketplace})` }} />
        <div className="flex items-center gap-3 p-3 border-b bg-muted/30">
          <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-foreground truncate">
                {conv?.buyer_name} <span className="text-muted-foreground font-normal">↔</span> {conv?.seller_name}
              </p>
              <Badge className="text-[10px] shrink-0" style={{ backgroundColor: ICON_COLORS.admin, color: "white" }}>
                <ShieldCheck className="h-3 w-3 mr-0.5" />Admin View
              </Badge>
            </div>
            {conv?.product_name && (
              <button onClick={() => navigate(`/admin/marketplace?product=${conv.product_id}`)} className="text-xs truncate flex items-center gap-1 hover:underline" style={{ color: ICON_COLORS.marketplace }}>
                {conv.product_name} {conv.product_category && <Badge variant="outline" className="text-[9px] px-1 py-0">{conv.product_category}</Badge>}
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[350px] p-3">
          <div className="space-y-2">
            {messages.map(m => {
              const isAdmin = m.sender_id === user?.id;
              const isSellerMsg = m.sender_id === conv?.seller_id;

              if (m.message_type === "product_share" && m.shared_product) {
                return (
                  <div key={m.id} className={`flex ${isAdmin ? "justify-end" : isSellerMsg ? "justify-end" : "justify-start"}`}>
                    <div className="space-y-0.5">
                      <p className={`text-[10px] px-1 ${isAdmin ? "text-right" : isSellerMsg ? "text-right" : "text-left"}`} style={{ color: isAdmin ? ICON_COLORS.admin : ICON_COLORS.marketplace }}>
                        {isAdmin ? "Platform Support" : m.sender_name}
                      </p>
                      <button onClick={() => navigate(`/admin/marketplace?product=${m.shared_product.id}`)}
                        className="max-w-[80%] rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow bg-muted/50">
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
                <div key={m.id} className={`flex ${isAdmin ? "justify-end" : isSellerMsg ? "justify-end" : "justify-start"}`}>
                  <div className="space-y-0.5 max-w-[75%]">
                    <p className={`text-[10px] px-1 ${isAdmin ? "text-right" : isSellerMsg ? "text-right" : "text-left"}`} style={{ color: isAdmin ? ICON_COLORS.admin : isSellerMsg ? ICON_COLORS.marketplace : ICON_COLORS.farm }}>
                      {isAdmin ? "Platform Support" : m.sender_name}
                    </p>
                    <div className={`rounded-2xl px-3 py-2 text-sm ${
                      isAdmin
                        ? "rounded-br-md text-white"
                        : isSellerMsg
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                    }`} style={isAdmin ? { backgroundColor: ICON_COLORS.admin } : undefined}>
                      {m.text_body}
                      <p className={`text-[10px] mt-1 ${isAdmin ? "text-white/60" : isSellerMsg ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="flex gap-2 p-3 border-t bg-muted/20">
          <Button variant="ghost" size="icon" onClick={() => setShareOpen(true)} className="shrink-0" title="Share Product">
            <Share2 className="h-4 w-4" style={{ color: ICON_COLORS.admin }} />
          </Button>
          <Input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Reply as Platform Support..." onKeyDown={e => e.key === "Enter" && sendReply()} className="flex-1" />
          <Button size="icon" onClick={sendReply} disabled={!newMsg.trim()} style={{ backgroundColor: ICON_COLORS.admin }} className="text-white shrink-0"><Send className="h-4 w-4" /></Button>
        </div>

        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base"><Share2 className="h-5 w-5" style={{ color: ICON_COLORS.admin }} />Share Product (Admin)</DialogTitle>
              <DialogDescription>Search all products and select one to share in this support thread.</DialogDescription>
            </DialogHeader>
            <Input placeholder="Search all products..." value={shareSearch} onChange={(e) => setShareSearch(e.target.value)} />
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

  // Inbox list view
  return (
    <Card className="shadow-card overflow-hidden">
      <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, ${ICON_COLORS.marketplace})` }} />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" style={{ color: ICON_COLORS.admin }} />
            Platform Conversations
            <Badge variant="outline" className="ml-1 text-xs">{filtered.length}</Badge>
          </CardTitle>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by buyer, seller, or product..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading conversations...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">{search ? "No matching conversations" : "No platform conversations yet"}</p>
          </div>
        ) : (
          filtered.map((c, i) => (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => setSelected(c.id)}
              className="w-full flex items-center gap-3 p-3.5 hover:bg-muted/40 transition-colors border-b last:border-b-0 text-left"
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
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate">{c.buyer_name}</span>
                    <span className="text-muted-foreground text-xs">↔</span>
                    <span className="text-sm font-medium truncate" style={{ color: ICON_COLORS.marketplace }}>{c.seller_name}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(c.last_message_at)}</span>
                </div>
                {c.product_name && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs truncate" style={{ color: ICON_COLORS.marketplace }}>
                      {c.product_name}
                    </p>
                    {c.product_category && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{c.product_category}</Badge>
                    )}
                    {c.product_price && (
                      <span className="text-[10px] font-semibold shrink-0" style={{ color: ICON_COLORS.health }}>৳{c.product_price}</span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message}</p>
              </div>
            </motion.button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
