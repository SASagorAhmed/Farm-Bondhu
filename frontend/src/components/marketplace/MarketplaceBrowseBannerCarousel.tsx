import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { fetchMarketplaceBanners } from "@/lib/marketplaceBannersApi";

interface Props {
  onNavigate: (href: string) => void;
}

function isExternalUrl(href: string) {
  return /^https?:\/\//i.test(href);
}

export default function MarketplaceBrowseBannerCarousel({ onNavigate }: Props) {
  const { data: banners = [] } = useQuery({
    queryKey: queryKeys().marketplaceBanners(),
    staleTime: moduleCachePolicy.marketplace.staleTime,
    gcTime: moduleCachePolicy.marketplace.gcTime,
    queryFn: fetchMarketplaceBanners,
  });

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [banners.length]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const sec = banners[index]?.display_seconds ?? 5;
    const t = setTimeout(next, sec * 1000);
    return () => clearTimeout(t);
  }, [index, banners, next]);

  if (banners.length === 0) return null;

  const banner = banners[index];

  const handleClick = () => {
    if (!banner.link_url) return;
    if (isExternalUrl(banner.link_url)) {
      window.open(banner.link_url, "_blank", "noopener,noreferrer");
      return;
    }
    onNavigate(banner.link_url);
  };

  const slide = (
    <div
      className={`relative w-full aspect-[3/1] rounded-2xl overflow-hidden shadow-card bg-muted/30 ${
        banner.link_url ? "cursor-pointer" : ""
      }`}
      onClick={banner.link_url ? handleClick : undefined}
      role={banner.link_url ? "button" : undefined}
      tabIndex={banner.link_url ? 0 : undefined}
      onKeyDown={
        banner.link_url
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      <img
        src={banner.image_url}
        alt={banner.alt_text || "Marketplace promotion"}
        className="w-full h-full object-cover"
      />
    </div>
  );

  if (banners.length === 1) {
    return slide;
  }

  return (
    <div className="relative">
      {slide}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/30 text-white h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          setIndex((i) => (i - 1 + banners.length) % banners.length);
        }}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/30 text-white h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {banners.map((b, i) => (
          <button
            key={b.id}
            type="button"
            aria-label={`Banner ${i + 1}`}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === index ? 20 : 6,
              backgroundColor: i === index ? "#fff" : "rgba(255,255,255,0.5)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIndex(i);
            }}
          />
        ))}
      </div>
    </div>
  );
}
