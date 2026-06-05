import { MarketplaceProduct } from "@/lib/marketplaceProduct";
import {
  getCategoryLabel,
  getLaneForProductCategory,
  resolveCategorySlug,
  type MarketplaceLane,
} from "@/lib/marketplaceCategories";
import { SELLER_ONBOARDING_LANES } from "@/lib/marketplaceLaneLabels";

const SHOP_LANE_ORDER = SELLER_ONBOARDING_LANES.map((entry) => ({
  lane: entry.lane,
  label: entry.label,
}));

function sortStorefrontProducts(items: MarketplaceProduct[]): MarketplaceProduct[] {
  return [...items].sort((a, b) => (a.shop_sort_order ?? 0) - (b.shop_sort_order ?? 0));
}

export type StorefrontCategoryGroup = {
  slug: string;
  label: string;
  products: MarketplaceProduct[];
};

export type StorefrontLaneGroup = {
  lane: Exclude<MarketplaceLane, "all"> | "other";
  label: string;
  products: MarketplaceProduct[];
};

export type GroupProductsByLaneOptions = {
  /** When set, always include these lanes (with empty product lists when none match). */
  fixedLanes?: readonly Exclude<MarketplaceLane, "all">[];
};

export function groupProductsByLane(
  products: MarketplaceProduct[],
  options?: GroupProductsByLaneOptions,
): StorefrontLaneGroup[] {
  const byLane = new Map<Exclude<MarketplaceLane, "all">, MarketplaceProduct[]>();
  const unassigned: MarketplaceProduct[] = [];

  for (const p of products) {
    const lane = getLaneForProductCategory(p.category);
    if (lane === "all") {
      unassigned.push(p);
      continue;
    }
    const list = byLane.get(lane) || [];
    list.push(p);
    byLane.set(lane, list);
  }

  const laneOrder = options?.fixedLanes?.length
    ? options.fixedLanes.map((lane) => {
        const known = SHOP_LANE_ORDER.find((entry) => entry.lane === lane);
        return known ?? { lane, label: lane };
      })
    : SHOP_LANE_ORDER;

  const groups: StorefrontLaneGroup[] = [];
  for (const { lane, label } of laneOrder) {
    const items = byLane.get(lane) || [];
    groups.push({ lane, label, products: sortStorefrontProducts(items) });
  }
  if (unassigned.length > 0) {
    groups.push({
      lane: "other",
      label: "Other products",
      products: sortStorefrontProducts(unassigned),
    });
  }
  return groups;
}

export function getPinnedProducts(products: MarketplaceProduct[]): MarketplaceProduct[] {
  return products
    .filter((p) => p.shop_pin_order != null && p.shop_pin_order >= 1)
    .sort((a, b) => (a.shop_pin_order ?? 99) - (b.shop_pin_order ?? 99));
}

export function groupProductsByCategory(products: MarketplaceProduct[]): StorefrontCategoryGroup[] {
  const map = new Map<string, MarketplaceProduct[]>();
  for (const p of products) {
    const slug = resolveCategorySlug(p.category) || p.category || "other";
    const list = map.get(slug) || [];
    list.push(p);
    map.set(slug, list);
  }
  return [...map.entries()]
    .map(([slug, items]) => ({
      slug,
      label: getCategoryLabel(slug),
      products: sortStorefrontProducts(items),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function filterStorefrontProducts(
  products: MarketplaceProduct[],
  options: { search?: string; category?: string }
): MarketplaceProduct[] {
  const q = options.search?.trim().toLowerCase();
  return products.filter((p) => {
    if (options.category && options.category !== "all") {
      const slug = resolveCategorySlug(p.category) || p.category;
      if (slug !== options.category && p.category !== options.category) return false;
    }
    if (q && !p.name.toLowerCase().includes(q)) return false;
    return true;
  });
}
