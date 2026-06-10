import { ChevronLeft, ChevronRight, Edit, MoreVertical, Pin, PinOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarketplaceProduct } from "@/lib/marketplaceProduct";
import MarketplaceProductCard from "@/components/marketplace/MarketplaceProductCard";
import { cn } from "@/lib/utils";

function listingStatusLabel(status?: string | null) {
  if (status === "pending_review") return "Pending review";
  if (status === "rejected") return "Rejected";
  if (status === "draft") return "Draft";
  return null;
}

interface Props {
  product: MarketplaceProduct;
  editMode?: boolean;
  isPinned?: boolean;
  pinDisabled?: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
  onEditProduct?: () => void;
  onDeleteProduct?: () => void;
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
  onEditProduct,
  onDeleteProduct,
  onMoveLeft,
  onMoveRight,
  canMoveLeft = false,
  canMoveRight = false,
  onOpen,
  onAddToCart,
  onBuyNow,
  className,
}: Props) {
  const hasProductActions = Boolean(onEditProduct || onDeleteProduct);
  const statusLabel = editMode ? listingStatusLabel(product.listing_status) : null;
  const isApprovedListing = !product.listing_status || product.listing_status === "approved";
  const pinBlocked = !isApprovedListing;
  const pinButtonDisabled = pinDisabled || pinBlocked;

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
          {statusLabel && (
            <Badge
              variant={product.listing_status === "rejected" ? "destructive" : "secondary"}
              className="absolute left-3 top-3 z-10 shadow-md"
            >
              {statusLabel}
            </Badge>
          )}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 items-end">
            {hasProductActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 shadow-md"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Product actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
                  {onEditProduct && (
                    <DropdownMenuItem
                      className="gap-2"
                      onSelect={(e) => {
                        e.preventDefault();
                        onEditProduct();
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit product
                    </DropdownMenuItem>
                  )}
                  {onDeleteProduct && (
                    <DropdownMenuItem
                      className="gap-2 text-destructive focus:text-destructive"
                      onSelect={(e) => {
                        e.preventDefault();
                        onDeleteProduct();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete product
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
                disabled={pinButtonDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (pinButtonDisabled) return;
                  onPin?.();
                }}
                title={pinBlocked ? "Only approved products can be pinned" : undefined}
              >
                <Pin className="h-3.5 w-3.5" /> {pinBlocked ? "Review" : "Pin"}
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
