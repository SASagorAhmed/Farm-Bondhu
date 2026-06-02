import { ChevronLeft, ChevronRight, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketplaceProduct } from "@/lib/marketplaceProduct";
import MarketplaceProductCard from "@/components/marketplace/MarketplaceProductCard";
import { cn } from "@/lib/utils";

interface Props {
  product: MarketplaceProduct;
  editMode?: boolean;
  isPinned?: boolean;
  pinDisabled?: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onOpen: () => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
  className?: string;
}

export default function SellerStorefrontProductTile({
  product,
  editMode = false,
  isPinned = false,
  pinDisabled = false,
  onPin,
  onUnpin,
  onMoveLeft,
  onMoveRight,
  canMoveLeft = false,
  canMoveRight = false,
  onOpen,
  onAddToCart,
  onBuyNow,
  className,
}: Props) {
  return (
    <div className={cn("relative group/tile", className)}>
      <MarketplaceProductCard
        product={product}
        displayOnly={editMode}
        onOpen={onOpen}
        onAddToCart={onAddToCart}
        onBuyNow={onBuyNow}
      />
      {editMode && (
        <>
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 items-end">
            {isPinned && (
              <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 shadow">
                #{product.shop_pin_order}
              </span>
            )}
            {isPinned ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 gap-1 shadow-md"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnpin?.();
                }}
              >
                <PinOff className="h-3.5 w-3.5" /> Unpin
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 gap-1 shadow-md"
                disabled={pinDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onPin?.();
                }}
              >
                <Pin className="h-3.5 w-3.5" /> Pin
              </Button>
            )}
          </div>
          {isPinned && (canMoveLeft || canMoveRight) && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-7 w-7 shadow-md"
                disabled={!canMoveLeft}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveLeft?.();
                }}
                aria-label="Move featured left"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-7 w-7 shadow-md"
                disabled={!canMoveRight}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveRight?.();
                }}
                aria-label="Move featured right"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
