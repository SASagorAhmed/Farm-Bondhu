import { MarketplaceProduct } from "@/lib/marketplaceProduct";
import SellerStorefrontProductTile from "./SellerStorefrontProductTile";

interface Props {
  products: MarketplaceProduct[];
  editMode?: boolean;
  pinDisabled?: boolean;
  onPin: (product: MarketplaceProduct) => void;
  onUnpin: (product: MarketplaceProduct) => void;
  onMovePinned?: (product: MarketplaceProduct, direction: "left" | "right") => void;
  onEditProduct?: (product: MarketplaceProduct) => void;
  onDeleteProduct?: (product: MarketplaceProduct) => void;
  onOpen: (product: MarketplaceProduct) => void;
  onAddToCart: (product: MarketplaceProduct) => void;
  onBuyNow: (product: MarketplaceProduct) => void;
}

export default function SellerPinnedProducts({
  products,
  editMode = false,
  pinDisabled = false,
  onPin,
  onUnpin,
  onMovePinned,
  onEditProduct,
  onDeleteProduct,
  onOpen,
  onAddToCart,
  onBuyNow,
}: Props) {
  if (products.length === 0 && !editMode) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-display font-semibold text-foreground">Featured picks</h2>
        {editMode && (
          <p className="text-xs text-muted-foreground">
            Pin products from any lane section below — they appear here and stay in their lane (max 8).
          </p>
        )}
      </div>
      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No pinned products yet. Pin your best sellers to feature them here and in their lane section.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin">
          {products.map((p, index) => (
            <div key={p.id} className="w-[220px] md:w-[240px] shrink-0 snap-start">
              <SellerStorefrontProductTile
                product={p}
                editMode={editMode}
                isPinned
                onUnpin={() => onUnpin(p)}
                onMoveLeft={onMovePinned ? () => onMovePinned(p, "left") : undefined}
                onMoveRight={onMovePinned ? () => onMovePinned(p, "right") : undefined}
                canMoveLeft={editMode && index > 0}
                canMoveRight={editMode && index < products.length - 1}
                onEditProduct={onEditProduct ? () => onEditProduct(p) : undefined}
                onDeleteProduct={onDeleteProduct ? () => onDeleteProduct(p) : undefined}
                onOpen={() => onOpen(p)}
                onAddToCart={() => onAddToCart(p)}
                onBuyNow={() => onBuyNow(p)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
