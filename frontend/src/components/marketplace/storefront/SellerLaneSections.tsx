import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  marketplaceFilterTabsListClass,
  marketplaceFilterTabsListStyle,
  marketplaceFilterTabsTriggerClass,
} from "@/components/marketplace/marketplaceCalloutStyles";
import type { MarketplaceLane } from "@/lib/marketplaceCategories";
import { MarketplaceProduct } from "@/lib/marketplaceProduct";
import { laneLabel } from "@/lib/marketplaceLaneLabels";
import { groupProductsByLane, type StorefrontLaneGroup } from "@/lib/storefrontUtils";
import SellerStorefrontProductTile from "./SellerStorefrontProductTile";

type ShopLaneFilter = "all" | Exclude<MarketplaceLane, "all"> | "other";

interface Props {
  products: MarketplaceProduct[];
  /** When set, always show tabs for every lane (including empty lanes). */
  fixedLanes?: readonly Exclude<MarketplaceLane, "all">[];
  editMode?: boolean;
  pinDisabled?: boolean;
  pinnedIds: Set<string>;
  onPin: (product: MarketplaceProduct) => void;
  onUnpin: (product: MarketplaceProduct) => void;
  onEditProduct?: (product: MarketplaceProduct) => void;
  onDeleteProduct?: (product: MarketplaceProduct) => void;
  onOpen: (product: MarketplaceProduct) => void;
  onAddToCart: (product: MarketplaceProduct) => void;
  onBuyNow: (product: MarketplaceProduct) => void;
}

function laneTabValue(group: StorefrontLaneGroup): ShopLaneFilter {
  return group.lane === "other" ? "other" : group.lane;
}

function ProductGrid({
  items,
  editMode,
  pinDisabled,
  pinnedIds,
  onPin,
  onUnpin,
  onEditProduct,
  onDeleteProduct,
  onOpen,
  onAddToCart,
  onBuyNow,
}: {
  items: MarketplaceProduct[];
  editMode?: boolean;
  pinDisabled?: boolean;
  pinnedIds: Set<string>;
  onPin: (product: MarketplaceProduct) => void;
  onUnpin: (product: MarketplaceProduct) => void;
  onEditProduct?: (product: MarketplaceProduct) => void;
  onDeleteProduct?: (product: MarketplaceProduct) => void;
  onOpen: (product: MarketplaceProduct) => void;
  onAddToCart: (product: MarketplaceProduct) => void;
  onBuyNow: (product: MarketplaceProduct) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((p) => (
        <SellerStorefrontProductTile
          key={p.id}
          product={p}
          editMode={editMode}
          isPinned={pinnedIds.has(p.id)}
          pinDisabled={pinDisabled && !pinnedIds.has(p.id)}
          onPin={() => onPin(p)}
          onUnpin={() => onUnpin(p)}
          onEditProduct={onEditProduct ? () => onEditProduct(p) : undefined}
          onDeleteProduct={onDeleteProduct ? () => onDeleteProduct(p) : undefined}
          onOpen={() => onOpen(p)}
          onAddToCart={() => onAddToCart(p)}
          onBuyNow={() => onBuyNow(p)}
        />
      ))}
    </div>
  );
}

function LaneSectionBody({
  items,
  gridProps,
}: {
  items: MarketplaceProduct[];
  gridProps: {
    editMode?: boolean;
    pinDisabled?: boolean;
    pinnedIds: Set<string>;
    onPin: (product: MarketplaceProduct) => void;
    onUnpin: (product: MarketplaceProduct) => void;
    onEditProduct?: (product: MarketplaceProduct) => void;
    onDeleteProduct?: (product: MarketplaceProduct) => void;
    onOpen: (product: MarketplaceProduct) => void;
    onAddToCart: (product: MarketplaceProduct) => void;
    onBuyNow: (product: MarketplaceProduct) => void;
  };
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
        No products in this section.
      </div>
    );
  }
  return <ProductGrid items={items} {...gridProps} />;
}

export default function SellerLaneSections({
  products,
  fixedLanes,
  editMode = false,
  pinDisabled = false,
  pinnedIds,
  onPin,
  onUnpin,
  onEditProduct,
  onDeleteProduct,
  onOpen,
  onAddToCart,
  onBuyNow,
}: Props) {
  const laneGroups = useMemo(
    () => groupProductsByLane(products, fixedLanes?.length ? { fixedLanes } : undefined),
    [products, fixedLanes],
  );
  const mainLaneGroups = useMemo(
    () => laneGroups.filter((g) => g.lane !== "other"),
    [laneGroups]
  );
  const otherGroup = useMemo(
    () => laneGroups.find((g) => g.lane === "other"),
    [laneGroups]
  );
  const [activeLane, setActiveLane] = useState<ShopLaneFilter>("all");

  const totalCount = products.length;
  const activeGroup = useMemo(
    () => (activeLane === "all" ? null : laneGroups.find((g) => laneTabValue(g) === activeLane)),
    [activeLane, laneGroups]
  );

  const sectionsForAllView = useMemo(() => {
    const base = fixedLanes?.length
      ? mainLaneGroups
      : mainLaneGroups.filter((g) => g.products.length > 0);
    return otherGroup ? [...base, otherGroup] : base;
  }, [mainLaneGroups, otherGroup, fixedLanes]);

  const gridProps = {
    editMode,
    pinDisabled,
    pinnedIds,
    onPin,
    onUnpin,
    onEditProduct,
    onDeleteProduct,
    onOpen,
    onAddToCart,
    onBuyNow,
  };

  const showFixedLaneStructure = Boolean(fixedLanes?.length);
  const laneTabs = showFixedLaneStructure
    ? fixedLanes!.map((lane) => {
        const group = mainLaneGroups.find((g) => g.lane === lane);
        return {
          lane,
          label: group?.label ?? laneLabel(lane),
          count: group?.products.length ?? 0,
        };
      })
    : mainLaneGroups
        .filter((g) => g.products.length > 0)
        .map((g) => ({ lane: g.lane, label: g.label, count: g.products.length }));

  if (products.length === 0 && !showFixedLaneStructure) {
    return (
      <div className="rounded-xl border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
        No products match your filters.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-display font-semibold text-foreground">All products</h2>
        <span className="text-xs text-muted-foreground">{totalCount} shown</span>
      </div>

      <Tabs value={activeLane} onValueChange={(v) => setActiveLane(v as ShopLaneFilter)}>
        <TabsList
          className={`${marketplaceFilterTabsListClass} flex-wrap h-auto max-w-full`}
          style={marketplaceFilterTabsListStyle}
        >
          <TabsTrigger value="all" className={marketplaceFilterTabsTriggerClass}>
            All ({totalCount})
          </TabsTrigger>
          {laneTabs.map((tab) => (
            <TabsTrigger
              key={tab.lane}
              value={tab.lane}
              className={marketplaceFilterTabsTriggerClass}
            >
              {tab.label} ({tab.count})
            </TabsTrigger>
          ))}
          {otherGroup && (
            <TabsTrigger value="other" className={marketplaceFilterTabsTriggerClass}>
              {otherGroup.label} ({otherGroup.products.length})
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {activeLane === "all" ? (
        <div className="space-y-8">
          {sectionsForAllView.map((group) => {
            const sectionId =
              group.lane === "other" ? "shop-lane-other" : `shop-lane-${group.lane}`;
            return (
              <div key={sectionId} id={sectionId} className="space-y-3 scroll-mt-24">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-foreground">{group.label}</h3>
                  <span className="text-xs text-muted-foreground">
                    {group.products.length} product{group.products.length === 1 ? "" : "s"}
                  </span>
                </div>
                <LaneSectionBody items={group.products} gridProps={gridProps} />
              </div>
            );
          })}
        </div>
      ) : activeGroup ? (
        <LaneSectionBody items={activeGroup.products} gridProps={gridProps} />
      ) : (
        <div className="rounded-xl border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
          No products in this section.
        </div>
      )}
    </section>
  );
}
