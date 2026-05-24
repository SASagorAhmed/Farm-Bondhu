/** Cartup-inspired marketplace brand tokens (buyer marketplace only). */
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

export function formatBdt(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

/** Flat ৳60 unless any line item has free delivery (matches Checkout). */
export function computeShippingFee(items: { product: { freeDelivery?: boolean } }[]): number {
  return items.some((i) => i.product.freeDelivery) ? 0 : 60;
}
