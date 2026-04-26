import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, Search, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";

interface ConvoItem {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  last_message: string;
  last_message_at: string;
  other_name: string;
  shop_name?: string;
  product_name?: string;
  product_image?: string;
  product_price?: number;
}

export default function BuyerInbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConvoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadConversations = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);

    const { data: convos, error } = await api
      .from("conversations")
      .select("*")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
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

    const otherIds = [...new Set(convos.map(c => c.buyer_id === user.id ? c.seller_id : c.buyer_id))];
    const productIds = [...new Set(convos.filter(c => c.product_id).map(c => c.product_id!))];
    const sellerIds = [...new Set(convos.map(c => c.seller_id))];

    const [{ data: profiles }, { data: products }, { data: shops }] = await Promise.all([
      api.from("profiles").select("id, name").in("id", otherIds),
      productIds.length > 0
        ? api.from("products").select("id, name, image, price").in("id", productIds)
        : Promise.resolve({ data: [] }),
      api.from("shops").select("user_id, shop_name").in("user_id", sellerIds),
    ]);

    const profileMap = new Map((profiles || []).map(p => [p.id, p.name]));
    const productMap = new Map((products || []).map(p => [p.id, p]));
    const shopMap = new Map((shops || []).map(s => [s.user_id, s.shop_name]));

    const items: ConvoItem[] = convos.map(c => {
      const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
      const product = c.product_id ? productMap.get(c.product_id) : null;
      return {
        id: c.id,
        buyer_id: c.buyer_id,
        seller_id: c.seller_id,
        product_id: c.product_id,
        last_message: c.last_message || "Started a conversation",
        last_message_at: c.last_message_at,
        other_name: profileMap.get(otherId) || "User",
        shop_name: shopMap.get(c.seller_id),
        product_name: product?.name,
        product_image: product?.image,
        product_price: product?.price,
      };
    });

    setConversations(items);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      setLoadError(null);
      return;
    }
    loadConversations();

    const channel = api
      .channel(`inbox-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => loadConversations())
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [user]);

  const filtered = conversations.filter(c =>
    !search || c.other_name.toLowerCase().includes(search.toLowerCase()) ||
    c.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.shop_name?.toLowerCase().includes(search.toLowerCase())
  );

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Messages</h1>
          <p className="text-sm text-muted-foreground">
            {loadError
              ? "Could not load messages"
              : conversations.length === 0
                ? "No messages yet"
                : `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </motion.div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
        <CardContent className="p-0">
          {loading && <p className="text-center text-muted-foreground py-12">Loading...</p>}
          {!loading && loadError && (
            <div className="text-center py-12 px-4 space-y-2">
              <MessageCircle className="h-10 w-10 mx-auto text-destructive/50" />
              <p className="text-sm text-destructive font-medium">Something went wrong</p>
              <p className="text-xs text-muted-foreground">{loadError}</p>
            </div>
          )}
          {!loading && !loadError && filtered.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground">Start a chat from a product page when you are ready</p>
            </div>
          )}
          {filtered.map((c, i) => (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/marketplace/chat/${c.id}`)}
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
                  <p className="font-semibold text-sm text-foreground truncate">{c.shop_name || c.other_name}</p>
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
    </div>
  );
}
