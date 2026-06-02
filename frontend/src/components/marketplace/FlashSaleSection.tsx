import { useState, useEffect } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import { isFlashSaleActive, MarketplaceProduct } from "@/lib/marketplaceProduct";
import MarketplaceProductCard from "./MarketplaceProductCard";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function useCountdown(target?: string) {
  const [left, setLeft] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const end = target ? new Date(target).getTime() : endOfToday();
    const tick = () => {
      const diff = Math.max(0, end - Date.now());
      setLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);

  return left;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

interface Props {
  products: MarketplaceProduct[];
  onNavigate: (path: string) => void;
  onAddToCart: (product: MarketplaceProduct) => void;
  onBuyNow: (product: MarketplaceProduct) => void;
  /** Hide header link when already on the browse page */
  showViewAll?: boolean;
  maxItems?: number;
}

export default function FlashSaleSection({
  products,
  onNavigate,
  onAddToCart,
  onBuyNow,
  showViewAll = true,
  maxItems = 8,
}: Props) {
  const flashProducts = products.filter((p) => isFlashSaleActive(p)).slice(0, maxItems);
  const countdown = useCountdown(flashProducts[0]?.flash_sale_end);

  if (flashProducts.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border/60 overflow-hidden bg-gradient-to-br from-orange-50/80 to-red-50/40 dark:from-orange-950/20 dark:to-red-950/10">
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={{ background: MARKETPLACE_THEME.primary }}
      >
        <div className="flex items-center gap-2 text-white">
          <Zap className="h-5 w-5 fill-white" />
          <span className="font-bold text-lg">Flash Sale</span>
        </div>
        <div className="flex items-center gap-2 text-white font-mono text-sm font-bold">
          <span className="bg-black/25 px-2 py-1 rounded">{pad(countdown.h)}</span>
          <span>:</span>
          <span className="bg-black/25 px-2 py-1 rounded">{pad(countdown.m)}</span>
          <span>:</span>
          <span className="bg-black/25 px-2 py-1 rounded">{pad(countdown.s)}</span>
        </div>
        {showViewAll && (
          <Button
            variant="secondary"
            size="sm"
            className="text-xs"
            onClick={() => onNavigate("/marketplace?lane=all")}
          >
            View All
          </Button>
        )}
      </div>
      <div className="flex gap-3 p-4 overflow-x-auto pb-5 snap-x snap-mandatory">
        {flashProducts.map((p) => (
          <div key={p.id} className="min-w-[260px] max-w-[280px] snap-start shrink-0">
            <MarketplaceProductCard
              product={p}
              showPharmacyBadge
              onOpen={() => onNavigate(`/marketplace/${p.id}`)}
              onAddToCart={() => onAddToCart(p)}
              onBuyNow={() => onBuyNow(p)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
