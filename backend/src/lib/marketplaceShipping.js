import { laneForProductCategory } from "./marketplaceLanes.js";

/** Mirrors frontend marketplaceTheme.ts — keep in sync. */
export const DEFAULT_DELIVERY_DHAKA = 80;
export const DEFAULT_DELIVERY_OUTSIDE = 120;

const DHAKA_METRO_DISTRICTS = new Set(["dhaka", "gazipur", "narayanganj", "narsingdi"]);

/**
 * @param {{ division?: string, district?: string, city?: string }} [address]
 */
export function isDhakaMetro(address) {
  if (!address?.division) return true;
  const division = String(address.division).trim().toLowerCase();
  const district = String(address.district || address.city || "").trim().toLowerCase();
  return division === "dhaka" && DHAKA_METRO_DISTRICTS.has(district);
}

/**
 * @param {{ free_delivery?: boolean, delivery_charge_dhaka?: number | null, delivery_charge_outside?: number | null }} product
 * @param {{ division?: string, district?: string, city?: string }} [address]
 */
export function productDeliveryCharge(product, address) {
  if (Boolean(product.free_delivery)) return 0;
  const dhaka =
    product.delivery_charge_dhaka != null && Number.isFinite(Number(product.delivery_charge_dhaka))
      ? Number(product.delivery_charge_dhaka)
      : DEFAULT_DELIVERY_DHAKA;
  const outside =
    product.delivery_charge_outside != null && Number.isFinite(Number(product.delivery_charge_outside))
      ? Number(product.delivery_charge_outside)
      : DEFAULT_DELIVERY_OUTSIDE;
  const charge = isDhakaMetro(address) ? dhaka : outside;
  return Math.max(0, charge);
}

/**
 * @param {{ category?: string }} product
 */
function laneKey(product) {
  return laneForProductCategory(product.category) || "other";
}

/**
 * @param {Array<{ category?: string, free_delivery?: boolean, delivery_charge_dhaka?: number | null, delivery_charge_outside?: number | null }>} products
 * @param {{ division?: string, district?: string, city?: string }} [address]
 */
export function computeShippingBreakdown(products, address) {
  if (!Array.isArray(products) || products.length === 0) {
    return { total: 0, lanes: [] };
  }

  /** @type {Map<string, { fee: number, productCount: number }>} */
  const laneBuckets = new Map();

  for (const product of products) {
    const lane = laneKey(product);
    const charge = productDeliveryCharge(product, address);
    const existing = laneBuckets.get(lane) || { fee: 0, productCount: 0 };
    existing.productCount += 1;
    existing.fee = Math.max(existing.fee, charge);
    laneBuckets.set(lane, existing);
  }

  const lanes = [...laneBuckets.entries()]
    .map(([lane, { fee, productCount }]) => ({ lane, fee, productCount }))
    .sort((a, b) => a.lane.localeCompare(b.lane));

  const total = lanes.reduce((sum, lane) => sum + lane.fee, 0);
  return { total, lanes };
}

/**
 * @param {Array<{ category?: string, free_delivery?: boolean, delivery_charge_dhaka?: number | null, delivery_charge_outside?: number | null }>} products
 * @param {{ division?: string, district?: string, city?: string }} [address]
 */
export function computeShippingFee(products, address) {
  return computeShippingBreakdown(products, address).total;
}
