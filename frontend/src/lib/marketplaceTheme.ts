/** Cartup-inspired marketplace brand tokens (buyer marketplace only). */
import { getLaneForProductCategory } from "@/lib/marketplaceCategories";

export const MARKETPLACE_THEME = {
  primary: "#E91E8C",
  primaryDark: "#DB2777",
  primaryLight: "#F472B6",
  accent: "#DC2626",
  headerBg: "#FFFFFF",
  trustIcon: "#16A34A",
  gradientStart: "#E91E8C",
  gradientEnd: "#DB2777",
  /** Neutral for Access Center — no purple in buyer UI */
  accessCenter: "#64748B",
} as const;

export function marketplaceGradient(): string {
  return `linear-gradient(to right, ${MARKETPLACE_THEME.gradientStart}, ${MARKETPLACE_THEME.gradientEnd})`;
}

export function marketplaceStarStyle(filled: boolean): { color?: string; fill: string } {
  return filled
    ? { color: MARKETPLACE_THEME.primary, fill: MARKETPLACE_THEME.primary }
    : { fill: "transparent" };
}

export const marketplaceProductTabClass =
  "rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-[#E91E8C] data-[state=active]:text-[#E91E8C]";

export function formatBdt(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

/** Mirrors backend marketplaceShipping.js — keep in sync. */
export const DEFAULT_DELIVERY_DHAKA = 80;
export const DEFAULT_DELIVERY_OUTSIDE = 120;

const DHAKA_METRO_DISTRICTS = new Set(["dhaka", "gazipur", "narayanganj", "narsingdi"]);

export interface DeliveryProductFields {
  freeDelivery?: boolean;
  category?: string;
  deliveryChargeDhaka?: number | null;
  deliveryChargeOutside?: number | null;
}

export function isDhakaMetro(address?: { division?: string; district?: string; city?: string }): boolean {
  if (!address?.division) return true;
  const division = address.division.trim().toLowerCase();
  const district = (address.district || address.city || "").trim().toLowerCase();
  return division === "dhaka" && DHAKA_METRO_DISTRICTS.has(district);
}

export function productDeliveryCharge(
  product: DeliveryProductFields,
  address?: { division?: string; district?: string; city?: string },
): number {
  if (product.freeDelivery) return 0;
  const dhaka =
    product.deliveryChargeDhaka != null && Number.isFinite(product.deliveryChargeDhaka)
      ? product.deliveryChargeDhaka
      : DEFAULT_DELIVERY_DHAKA;
  const outside =
    product.deliveryChargeOutside != null && Number.isFinite(product.deliveryChargeOutside)
      ? product.deliveryChargeOutside
      : DEFAULT_DELIVERY_OUTSIDE;
  return Math.max(0, isDhakaMetro(address) ? dhaka : outside);
}

function laneKey(category?: string): string {
  const lane = getLaneForProductCategory(category);
  return lane === "all" ? "other" : lane;
}

export interface ShippingLaneBreakdown {
  lane: string;
  fee: number;
  productCount?: number;
}

export interface ShippingBreakdown {
  total: number;
  lanes: ShippingLaneBreakdown[];
}

export function computeShippingBreakdown(
  products: DeliveryProductFields[],
  address?: { division?: string; district?: string; city?: string },
): ShippingBreakdown {
  if (!products.length) return { total: 0, lanes: [] };

  const laneBuckets = new Map<string, { fee: number; productCount: number }>();

  for (const product of products) {
    const lane = laneKey(product.category);
    const charge = productDeliveryCharge(product, address);
    const existing = laneBuckets.get(lane) || { fee: 0, productCount: 0 };
    existing.productCount += 1;
    existing.fee = Math.max(existing.fee, charge);
    laneBuckets.set(lane, existing);
  }

  const lanes = [...laneBuckets.entries()]
    .map(([lane, { fee, productCount }]) => ({ lane, fee, productCount }))
    .sort((a, b) => a.lane.localeCompare(b.lane));

  return { total: lanes.reduce((sum, lane) => sum + lane.fee, 0), lanes };
}

export function computeShippingFee(
  items: { product: DeliveryProductFields }[],
  address?: { division?: string; district?: string; city?: string },
): number {
  return computeShippingBreakdown(
    items.map((i) => i.product),
    address,
  ).total;
}

export interface ShopShippingGroup {
  sellerId: string;
  sellerName: string;
  breakdown: ShippingBreakdown;
}

/** Sum shipping per seller shop, then total. */
export function computeCartShippingByShop(
  items: { product: DeliveryProductFields & { sellerId?: string; seller?: string } }[],
  address?: { division?: string; district?: string; city?: string },
): { shops: ShopShippingGroup[]; total: number } {
  const bySeller = new Map<string, { sellerName: string; products: DeliveryProductFields[] }>();

  for (const item of items) {
    const sellerId = item.product.sellerId || "unknown";
    const existing = bySeller.get(sellerId) || {
      sellerName: item.product.seller || "Seller",
      products: [],
    };
    existing.products.push(item.product);
    bySeller.set(sellerId, existing);
  }

  const shops: ShopShippingGroup[] = [];
  let total = 0;
  for (const [sellerId, { sellerName, products }] of bySeller) {
    const breakdown = computeShippingBreakdown(products, address);
    shops.push({ sellerId, sellerName, breakdown });
    total += breakdown.total;
  }

  return { shops, total };
}

export function countDistinctLanes(products: DeliveryProductFields[]): number {
  const lanes = new Set(products.map((p) => laneKey(p.category)));
  return lanes.size;
}
