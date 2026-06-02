export type PriceTier = "retail" | "wholesale";
export type WholesaleRule = "quantity" | "order_value" | "quantity_and_value";

export interface WholesaleProductFields {
  price: number;
  wholesale_price?: number | null;
  wholesale_min_qty?: number | null;
  wholesale_min_order_bdt?: number | null;
  wholesale_rule?: WholesaleRule | string | null;
}

export function cartLineKey(productId: string, priceTier: PriceTier): string {
  return `${productId}:${priceTier}`;
}

export function normalizeWholesaleRule(rule: unknown): WholesaleRule {
  const r = String(rule || "quantity").trim();
  if (r === "order_value" || r === "quantity_and_value") return r;
  return "quantity";
}

export function wholesaleThresholdStatus(product: WholesaleProductFields, qty: number) {
  const retailPrice = Number(product.price);
  const rule = normalizeWholesaleRule(product.wholesale_rule);
  const minQty = product.wholesale_min_qty != null ? Number(product.wholesale_min_qty) : null;
  const minOrderBdt = product.wholesale_min_order_bdt != null ? Number(product.wholesale_min_order_bdt) : null;
  const lineRetailValue = qty * retailPrice;

  let qtyMet = true;
  let valueMet = true;
  const hints: string[] = [];

  if (rule === "quantity" || rule === "quantity_and_value") {
    qtyMet = minQty != null && qty >= minQty;
    if (!qtyMet && minQty != null) {
      hints.push(`Add ${Math.max(0, minQty - qty)} more unit(s) for wholesale price`);
    }
  }

  if (rule === "order_value" || rule === "quantity_and_value") {
    valueMet = minOrderBdt != null && lineRetailValue >= minOrderBdt;
    if (!valueMet && minOrderBdt != null) {
      const need = Math.max(0, Math.ceil(minOrderBdt - lineRetailValue));
      hints.push(`Add ৳${need} more on this line for wholesale price`);
    }
  }

  return {
    rule,
    thresholdMet: qtyMet && valueMet,
    thresholdHint: hints.length ? hints.join("; ") : null,
  };
}

export function resolveLinePrice(
  product: WholesaleProductFields,
  qty: number,
  requestedTier: PriceTier = "retail",
) {
  const retailPrice = Number(product.price);
  const wholesalePrice = product.wholesale_price != null ? Number(product.wholesale_price) : null;
  const hasWholesale =
    wholesalePrice != null &&
    Number.isFinite(wholesalePrice) &&
    wholesalePrice > 0 &&
    wholesalePrice < retailPrice;

  const threshold = wholesaleThresholdStatus(product, qty);

  if (!hasWholesale) {
    return {
      unitPrice: retailPrice,
      priceTier: "retail" as PriceTier,
      retailUnitPrice: retailPrice,
      thresholdMet: false,
      thresholdHint: null as string | null,
      wholesaleRule: threshold.rule,
    };
  }

  if (threshold.thresholdMet) {
    return {
      unitPrice: wholesalePrice,
      priceTier: "wholesale" as PriceTier,
      retailUnitPrice: retailPrice,
      thresholdMet: true,
      thresholdHint: null as string | null,
      wholesaleRule: threshold.rule,
    };
  }

  if (requestedTier === "wholesale") {
    return {
      unitPrice: retailPrice,
      priceTier: "retail" as PriceTier,
      retailUnitPrice: retailPrice,
      thresholdMet: false,
      thresholdHint: threshold.thresholdHint,
      wholesaleRule: threshold.rule,
    };
  }

  return {
    unitPrice: retailPrice,
    priceTier: "retail" as PriceTier,
    retailUnitPrice: retailPrice,
    thresholdMet: false,
    thresholdHint: null as string | null,
    wholesaleRule: threshold.rule,
  };
}

export function suggestedWholesaleQty(product: WholesaleProductFields): number {
  const retailPrice = Number(product.price);
  const rule = normalizeWholesaleRule(product.wholesale_rule);
  const minQty = product.wholesale_min_qty != null ? Number(product.wholesale_min_qty) : 1;
  const minOrderBdt = product.wholesale_min_order_bdt != null ? Number(product.wholesale_min_order_bdt) : null;

  let qty = Math.max(1, minQty);
  if ((rule === "order_value" || rule === "quantity_and_value") && minOrderBdt != null && retailPrice > 0) {
    const valueQty = Math.ceil(minOrderBdt / retailPrice);
    qty = Math.max(qty, valueQty);
  }
  return qty;
}

export function wholesaleRuleLabel(rule: WholesaleRule): string {
  switch (rule) {
    case "order_value":
      return "Min order value";
    case "quantity_and_value":
      return "Qty + value";
    default:
      return "Min quantity";
  }
}

export interface OrderPreviewLine {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  priceTier: PriceTier;
  retailUnitPrice: number;
  wholesaleRule?: string;
  thresholdHint?: string | null;
  image?: string;
  unit?: string;
  freeDelivery?: boolean;
}

export interface ShippingLaneBreakdown {
  lane: string;
  fee: number;
  productCount?: number;
}

export interface OrderPreviewQuote {
  ok: boolean;
  errors?: string[];
  warnings?: string[];
  pricedLines?: OrderPreviewLine[];
  subtotal?: number;
  shippingFee?: number;
  shippingBreakdown?: { total: number; lanes: ShippingLaneBreakdown[] };
  total?: number;
}

export function previewDisplayPrice(line: OrderPreviewLine): number {
  return line.unitPrice;
}
