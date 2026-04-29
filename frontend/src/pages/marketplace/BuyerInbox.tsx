import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { API_BASE, api, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, Search, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy } from "@/lib/queryClient";

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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const loadConversations = async (): Promise<ConvoItem[]> => {
    if (!user) return [];
    const token = readSession()?.access_token;
    const res = await fetch(`${API_BASE}/v1/marketplace/chat/inbox`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const body = (await res.json().catch(() => ({}))) as { data?: ConvoItem[]; error?: string };
    if (!res.ok) throw new Error(body.error || `Failed to load inbox (${res.status})`);
    return body.data || [];
  };

  const { data: conversations = [], isLoading, isFetching, error } = useQuery({
    queryKey: ["buyer-inbox", user?.id],
    enabled: Boolean(user?.id),
    queryFn: loadConversations,
    staleTime: moduleCachePolicy.marketplace.staleTime,
    gcTime: moduleCachePolicy.marketplace.gcTime,
    placeholderData: (prev) => prev,
  });

  const loadError = error instanceof Error ? error.message : null;

  useEffect(() => {
    if (!user) return;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = api
      .channel(`inbox-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, (payload) => {
        const eventType = payload.eventType;
        const row = (eventType === "DELETE" ? payload.old : payload.new) as Partial<ConvoItem> & {
          buyer_id?: string;
          seller_id?: string;
        };
        const isMine = row.buyer_id === user.id || row.seller_id === user.id;
        if (isMine && row.id) {
          queryClient.setQueryData<ConvoItem[]>(["buyer-inbox", user.id], (prev) => {
            if (!prev) return prev;
            const list = [...prev];
            const idx = list.findIndex((c) => c.id === row.id);
            if (eventType === "DELETE") {
              if (idx >= 0) list.splice(idx, 1);
              return list;
            }
            if (idx >= 0) {
              list[idx] = {
                ...list[idx],
                last_message: row.last_message || list[idx].last_message,
                last_message_at: row.last_message_at || list[idx].last_message_at,
              };
            } else {
              list.unshift({
                id: String(row.id),
                buyer_id: String(row.buyer_id || ""),
                seller_id: String(row.seller_id || ""),
                product_id: row.product_id || null,
                last_message: row.last_message || "Started a conversation",
                last_message_at: row.last_message_at || new Date().toISOString(),
                other_name: "User",
              });
            }
            return list.sort((a, b) => String(b.last_message_at || "").localeCompare(String(a.last_message_at || "")));
          });
        }
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["buyer-inbox", user.id] });
        }, 250);
      })
      .subscribe();
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      api.removeChannel(channel);
    };
  }, [queryClient, user]);

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
          {isFetching && conversations.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">Refreshing...</p>
          )}
        </div>
      </motion.div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="buyerInboxSearch"
          name="buyerInboxSearch"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
        <CardContent className="p-0">
          {isLoading && !conversations.length && <p className="text-center text-muted-foreground py-12">Loading...</p>}
          {!isLoading && loadError && (
            <div className="text-center py-12 px-4 space-y-2">
              <MessageCircle className="h-10 w-10 mx-auto text-destructive/50" />
              <p className="text-sm text-destructive font-medium">Something went wrong</p>
              <p className="text-xs text-muted-foreground">{loadError}</p>
            </div>
          )}
          {!isLoading && !loadError && filtered.length === 0 && (
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
