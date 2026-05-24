import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MARKETPLACE_THEME, marketplaceGradient } from "@/lib/marketplaceTheme";

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  gradient: string;
}

const DEFAULT_BANNERS: HeroBanner[] = [
  {
    id: "farm",
    title: "Farm Supplies Delivered",
    subtitle: "Feed, equipment & livestock — best prices every day",
    cta: "Shop Farm",
    href: "/marketplace?lane=farm",
    gradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  },
  {
    id: "pharmacy",
    title: "Pharmacy & Animal Health",
    subtitle: "Medicine, vaccines & supplements from verified sellers",
    cta: "Shop Pharmacy",
    href: "/marketplace?lane=pharmacy",
    gradient: "linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)",
  },
  {
    id: "flash",
    title: "Flash Deals",
    subtitle: "Limited-time discounts on top farm products",
    cta: "View Deals",
    href: "/marketplace?sort=price_asc",
    gradient: marketplaceGradient(),
  },
];

interface Props {
  banners?: HeroBanner[];
  onNavigate: (href: string) => void;
}

export default function MarketplaceHeroCarousel({ banners = DEFAULT_BANNERS, onNavigate }: Props) {
  const [index, setIndex] = useState(0);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [next]);

  const banner = banners[index];

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-card">
      <div
        className="min-h-[160px] md:min-h-[200px] p-6 md:p-10 flex flex-col justify-center transition-all duration-500"
        style={{ background: banner.gradient }}
      >
        <p className="text-white/90 text-sm font-medium mb-1">FarmBondhu Marketplace</p>
        <h2 className="text-2xl md:text-3xl font-display font-bold text-white max-w-lg">{banner.title}</h2>
        <p className="text-white/85 mt-2 max-w-md text-sm md:text-base">{banner.subtitle}</p>
        <Button
          className="mt-4 w-fit text-white border-white/30 hover:bg-white/20"
          variant="outline"
          onClick={() => onNavigate(banner.href)}
        >
          {banner.cta}
        </Button>
      </div>
      {banners.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/30 text-white h-8 w-8"
            onClick={() => setIndex((i) => (i - 1 + banners.length) % banners.length)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/30 text-white h-8 w-8"
            onClick={next}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Slide ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? 20 : 6,
                  backgroundColor: i === index ? "#fff" : "rgba(255,255,255,0.5)",
                }}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export { DEFAULT_BANNERS };
