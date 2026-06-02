import { useCallback, useEffect, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Check, Package, Search, X } from "lucide-react";

import { API_BASE, readSession } from "@/api/client";

import { ICON_COLORS } from "@/lib/iconColors";

import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";

import type { ChatMentionProduct } from "@/lib/marketplaceChatMentions";



interface ChatProductMentionPickerProps {

  open: boolean;

  onOpenChange: (open: boolean) => void;

  conversationId: string;

  attachedProductIds?: string[];

  onSelect: (product: ChatMentionProduct) => void;

  onCancel?: () => void;

}



export function ChatProductMentionChip({

  product,

  onClear,

}: {

  product: ChatMentionProduct;

  onClear: () => void;

}) {

  return (

    <Badge variant="secondary" className="gap-2 py-1 pl-1 pr-1 max-w-full">

      <img src={product.image} alt="" className="h-6 w-6 rounded object-cover bg-accent shrink-0" />

      <span className="truncate text-xs max-w-[140px]">{product.name}</span>

      <button type="button" onClick={onClear} className="shrink-0 rounded-full p-0.5 hover:bg-muted" aria-label="Remove product">

        <X className="h-3 w-3" />

      </button>

    </Badge>

  );

}



export function ChatProductMentionChipRow({

  products,

  onRemove,

}: {

  products: ChatMentionProduct[];

  onRemove: (productId: string) => void;

}) {

  if (products.length === 0) return null;

  return (

    <div className="flex flex-wrap gap-2 px-3 pt-2">

      {products.map((product) => (

        <ChatProductMentionChip

          key={product.id}

          product={product}

          onClear={() => onRemove(product.id)}

        />

      ))}

    </div>

  );

}



export default function ChatProductMentionPicker({

  open,

  onOpenChange,

  conversationId,

  attachedProductIds = [],

  onSelect,

  onCancel,

}: ChatProductMentionPickerProps) {

  const [search, setSearch] = useState("");

  const [products, setProducts] = useState<ChatMentionProduct[]>([]);

  const [loading, setLoading] = useState(false);

  const attachedSet = new Set(attachedProductIds);



  const loadProducts = useCallback(async () => {

    if (!conversationId) return;

    setLoading(true);

    try {

      const token = readSession()?.access_token;

      const q = encodeURIComponent(search.trim());

      const res = await fetch(

        `${API_BASE}/v1/marketplace/chat/conversations/${conversationId}/shop-products?q=${q}&limit=30`,

        { headers: token ? { Authorization: `Bearer ${token}` } : {} }

      );

      const body = (await res.json().catch(() => ({}))) as { data?: ChatMentionProduct[] };

      setProducts(res.ok ? body.data || [] : []);

    } finally {

      setLoading(false);

    }

  }, [conversationId, search]);



  useEffect(() => {

    if (open) void loadProducts();

  }, [open, loadProducts]);



  useEffect(() => {

    if (!open) setSearch("");

  }, [open]);



  const handleClose = (next: boolean) => {

    if (!next) onCancel?.();

    onOpenChange(next);

  };



  return (

    <Dialog open={open} onOpenChange={handleClose}>

      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">

        <DialogHeader>

          <DialogTitle className="flex items-center gap-2 text-base">

            <Package className="h-5 w-5" style={{ color: MARKETPLACE_THEME.primary }} />

            Attach products

          </DialogTitle>

          <DialogDescription>

            Tap products to attach them to your message. Tap Done when finished.

          </DialogDescription>

        </DialogHeader>

        <div className="relative">

          <Search className="absolute left-3 top-1/2 -h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input

            value={search}

            onChange={(e) => setSearch(e.target.value)}

            placeholder="Search shop products..."

            className="pl-9"

          />

        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">

          {loading && <p className="text-sm text-muted-foreground text-center py-6">Loading products...</p>}

          {!loading && products.map((p) => {

            const attached = attachedSet.has(p.id);

            return (

              <button

                key={p.id}

                type="button"

                onClick={() => onSelect(p)}

                className={`flex items-center gap-3 w-full p-2 rounded-lg border transition-colors text-left ${

                  attached ? "bg-primary/5 border-primary/30" : "hover:bg-accent/50"

                }`}

              >

                <img src={p.image} alt={p.name} className="h-12 w-12 rounded-lg object-cover bg-accent shrink-0" />

                <div className="flex-1 min-w-0">

                  <p className="text-sm font-medium truncate">{p.name}</p>

                  <p className="text-sm font-bold" style={{ color: ICON_COLORS.health }}>৳{p.price}</p>

                  <p className="text-xs text-muted-foreground">

                    {(p.stock ?? 0) > 0 ? "In stock" : "Out of stock"}

                  </p>

                </div>

                {attached && (

                  <Check className="h-5 w-5 shrink-0" style={{ color: MARKETPLACE_THEME.primary }} />

                )}

              </button>

            );

          })}

          {!loading && products.length === 0 && (

            <p className="text-center text-sm text-muted-foreground py-6">No products found in this shop</p>

          )}

        </div>

        <div className="flex gap-2">

          <Button variant="outline" className="flex-1" onClick={() => handleClose(false)}>

            Cancel

          </Button>

          <Button

            className="flex-1 text-white"

            style={{ backgroundColor: MARKETPLACE_THEME.primary }}

            onClick={() => onOpenChange(false)}

          >

            Done{attachedProductIds.length > 0 ? ` (${attachedProductIds.length})` : ""}

          </Button>

        </div>

      </DialogContent>

    </Dialog>

  );

}


