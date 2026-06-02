import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketplaceProduct } from "@/lib/marketplaceProduct";
import { StorefrontCategoryGroup } from "@/lib/storefrontUtils";
import SellerStorefrontProductTile from "./SellerStorefrontProductTile";

interface Props {
  groups: StorefrontCategoryGroup[];
  filteredProducts: MarketplaceProduct[];
  activeCategory: string;
  onCategoryChange: (slug: string) => void;
  editMode?: boolean;
  pinDisabled?: boolean;
  pinnedIds: Set<string>;
  onPin: (product: MarketplaceProduct) => void;
  onUnpin: (product: MarketplaceProduct) => void;
  onOpen: (product: MarketplaceProduct) => void;
  onAddToCart: (product: MarketplaceProduct) => void;
  onBuyNow: (product: MarketplaceProduct) => void;
}

export default function SellerCategorySections({
  groups,
  filteredProducts,
  activeCategory,
  onCategoryChange,
  editMode = false,
  pinDisabled = false,
  pinnedIds,
  onPin,
  onUnpin,
  onOpen,
  onAddToCart,
  onBuyNow,
}: Props) {
  const totalCount = groups.reduce((s, g) => s + g.products.length, 0);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-display font-semibold text-foreground">All products</h2>
        <span className="text-xs text-muted-foreground">{filteredProducts.length} shown</span>
      </div>

      {groups.length > 1 && (
        <Tabs value={activeCategory} onValueChange={onCategoryChange}>
          <TabsList className="flex flex-wrap h-auto gap-1 max-w-full">
            <TabsTrigger value="all">All ({totalCount})</TabsTrigger>
            {groups.map((g) => (
              <TabsTrigger key={g.slug} value={g.slug}>
                {g.label} ({g.products.length})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {filteredProducts.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
          No products match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((p) => (
            <SellerStorefrontProductTile
              key={p.id}
              product={p}
              editMode={editMode}
              isPinned={pinnedIds.has(p.id)}
              pinDisabled={pinDisabled && !pinnedIds.has(p.id)}
              onPin={() => onPin(p)}
              onUnpin={() => onUnpin(p)}
              onOpen={() => onOpen(p)}
              onAddToCart={() => onAddToCart(p)}
              onBuyNow={() => onBuyNow(p)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
