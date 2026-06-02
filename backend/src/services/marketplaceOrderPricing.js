import sql from "../db.js";
import { buildUserBundle } from "./userBundle.js";
import { computeShippingBreakdown } from "../lib/marketplaceShipping.js";
import { normalizeDeliveryAddress } from "../lib/orderValidate.js";

export const WHOLESALE_RULES = new Set(["quantity", "order_value", "quantity_and_value"]);

export class OrderPricingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {unknown} rule
 */
export function normalizeWholesaleRule(rule) {
  const r = String(rule || "quantity").trim();
  if (WHOLESALE_RULES.has(r)) return r;
  if (r === "both") return "quantity_and_value";
  return "quantity";
}

/**
 * @param {Record<string, unknown>} product
 * @param {number} qty
 */
export function wholesaleThresholdStatus(product, qty) {
  const retailPrice = Number(product.price);
  const rule = normalizeWholesaleRule(product.wholesale_rule);
  const minQty = product.wholesale_min_qty != null ? Number(product.wholesale_min_qty) : null;
  const minOrderBdt = product.wholesale_min_order_bdt != null ? Number(product.wholesale_min_order_bdt) : null;
  const lineRetailValue = qty * retailPrice;

  let qtyMet = true;
  let valueMet = true;
  const hints = [];

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

/**
 * @param {Record<string, unknown>} product
 * @param {number} qty
 * @param {"retail"|"wholesale"} [requestedTier]
 */
export function resolveLinePrice(product, qty, requestedTier = "retail") {
  const retailPrice = Number(product.price);
  const wholesalePrice = product.wholesale_price != null ? Number(product.wholesale_price) : null;
  const hasWholesale =
    wholesalePrice != null &&
    Number.isFinite(wholesalePrice) &&
    wholesalePrice > 0 &&
    wholesalePrice < retailPrice;

  const tier = requestedTier === "wholesale" ? "wholesale" : "retail";
  const threshold = wholesaleThresholdStatus(product, qty);

  if (!hasWholesale) {
    return {
      unitPrice: retailPrice,
      priceTier: "retail",
      retailUnitPrice: retailPrice,
      thresholdMet: false,
      thresholdHint: null,
      wholesaleRule: threshold.rule,
    };
  }

  if (threshold.thresholdMet) {
    return {
      unitPrice: wholesalePrice,
      priceTier: "wholesale",
      retailUnitPrice: retailPrice,
      thresholdMet: true,
      thresholdHint: null,
      wholesaleRule: threshold.rule,
    };
  }

  if (tier === "wholesale") {
    return {
      unitPrice: retailPrice,
      priceTier: "retail",
      retailUnitPrice: retailPrice,
      thresholdMet: false,
      thresholdHint: threshold.thresholdHint,
      wholesaleRule: threshold.rule,
    };
  }

  return {
    unitPrice: retailPrice,
    priceTier: "retail",
    retailUnitPrice: retailPrice,
    thresholdMet: false,
    thresholdHint: null,
    wholesaleRule: threshold.rule,
  };
}

/**
 * @param {string} userId
 */
export async function buyerHasBulkBuyCapability(userId) {
  const bundle = await buildUserBundle(userId);
  return Boolean(bundle?.capabilities?.includes("can_bulk_buy"));
}

/**
 * @param {string} userId
 */
export async function buyerCanPurchaseInMarketplace(userId) {
  const bundle = await buildUserBundle(userId);
  if (!bundle) return false;
  return bundle.capabilities.includes("can_buy") || bundle.capabilities.includes("can_bulk_buy");
}

/**
 * @param {Array<{ productId: string, qty: number, priceTier?: string }>} cartLines
 */
function normalizeCartLines(cartLines) {
  if (!Array.isArray(cartLines) || cartLines.length === 0) {
    throw new OrderPricingError("items must be a non-empty array");
  }
  return cartLines.map((line, idx) => {
    const productId = String(line?.productId || line?.product_id || "").trim();
    const qty = Number(line?.qty ?? line?.quantity);
    const priceTier = line?.priceTier === "wholesale" || line?.price_tier === "wholesale" ? "wholesale" : "retail";
    if (!productId) throw new OrderPricingError(`items[${idx}].productId is required`);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      throw new OrderPricingError(`items[${idx}].qty must be a positive integer`);
    }
    return { productId, qty, priceTier };
  });
}

/**
 * @param {string} buyerId
 * @param {string} sellerId
 * @param {Array<{ productId: string, qty: number, priceTier?: string }>} cartLines
 * @param {unknown} [deliveryAddress]
 */
export async function buildOrderQuote(buyerId, sellerId, cartLines, deliveryAddress) {
  const lines = normalizeCartLines(cartLines);

  const productIds = [...new Set(lines.map((l) => l.productId))];
  const products = await sql`
    select *
    from products
    where id = any(${productIds})
  `;
  const productMap = new Map(products.map((p) => [p.id, p]));

  const pricedLines = [];
  const warnings = [];
  const errors = [];
  let subtotal = 0;

  for (const line of lines) {
    const product = productMap.get(line.productId);
    if (!product) {
      errors.push(`Product not found: ${line.productId}`);
      continue;
    }
    if (String(product.seller_id) !== String(sellerId)) {
      errors.push(`${product.name} does not belong to this seller`);
      continue;
    }

    const stock = Number(product.stock ?? 0);
    if (stock < line.qty) {
      errors.push(`Insufficient stock for ${product.name} (available: ${stock})`);
    }

    const resolved = resolveLinePrice(product, line.qty, line.priceTier);
    if (line.priceTier === "wholesale" && resolved.priceTier === "retail" && resolved.thresholdHint) {
      warnings.push(`${product.name}: ${resolved.thresholdHint}`);
    }

    const lineTotal = resolved.unitPrice * line.qty;
    subtotal += lineTotal;

    pricedLines.push({
      productId: product.id,
      name: product.name,
      qty: line.qty,
      unitPrice: resolved.unitPrice,
      lineTotal,
      priceTier: resolved.priceTier,
      retailUnitPrice: resolved.retailUnitPrice,
      wholesaleRule: resolved.wholesaleRule,
      thresholdHint: resolved.thresholdHint,
      image: product.image || "",
      unit: product.unit || "piece",
      freeDelivery: Boolean(product.free_delivery),
    });
  }

  if (errors.length) {
    return { ok: false, errors, warnings, pricedLines, subtotal: 0, shippingFee: 0, shippingBreakdown: { total: 0, lanes: [] }, total: 0 };
  }

  let addressValue = null;
  if (deliveryAddress) {
    const address = normalizeDeliveryAddress(deliveryAddress);
    if (!address.ok) {
      throw new OrderPricingError(address.error);
    }
    addressValue = address.value;
  }

  const shippingProducts = pricedLines.map((line) => {
    const product = productMap.get(line.productId);
    return {
      category: product?.category,
      free_delivery: line.freeDelivery,
      delivery_charge_dhaka: product?.delivery_charge_dhaka,
      delivery_charge_outside: product?.delivery_charge_outside,
    };
  });

  const shippingBreakdown = computeShippingBreakdown(
    shippingProducts,
    addressValue
      ? { division: addressValue.division, district: addressValue.district || addressValue.city }
      : undefined,
  );
  const shippingFee = shippingBreakdown.total;

  const total = subtotal + shippingFee;

  return {
    ok: true,
    errors: [],
    warnings,
    pricedLines,
    subtotal,
    shippingFee,
    shippingBreakdown,
    total,
    deliveryAddress: addressValue,
  };
}

/**
 * @param {import("postgres").TransactionSql} tx
 * @param {Array<{ productId: string, name: string, qty: number }>} pricedLines
 */
export async function deductStockForOrderLines(tx, pricedLines) {
  for (const line of pricedLines) {
    const [updated] = await tx`
      update products
      set stock = stock - ${line.qty}, updated_at = now()
      where id = ${line.productId} and stock >= ${line.qty}
      returning id, stock
    `;
    if (!updated) {
      throw new OrderPricingError(`Insufficient stock for ${line.name}`, 409);
    }
  }
}

/**
 * @param {string} buyerId
 * @param {Record<string, unknown>} orderInput
 */
export async function placeMarketplaceOrder(buyerId, orderInput) {
  const sellerId = String(orderInput.seller_id || "");
  if (!sellerId) throw new OrderPricingError("seller_id is required");

  const quote = await buildOrderQuote(
    buyerId,
    sellerId,
    /** @type {any[]} */ (orderInput.items),
    orderInput.delivery_address,
  );

  if (!quote.ok) {
    throw new OrderPricingError(quote.errors.join("; "));
  }

  const paymentMethod = typeof orderInput.payment_method === "string" ? orderInput.payment_method : "cash_on_delivery";
  const buyerName = typeof orderInput.buyer_name === "string" ? orderInput.buyer_name.trim() || null : null;
  const sellerName = typeof orderInput.seller_name === "string" ? orderInput.seller_name.trim() || null : null;
  const note =
    typeof orderInput.estimated_delivery_note === "string" && orderInput.estimated_delivery_note.trim()
      ? orderInput.estimated_delivery_note.trim()
      : "3-5 business days";

  const orderItems = quote.pricedLines.map((l) => ({
    productId: l.productId,
    name: l.name,
    qty: l.qty,
    unitPrice: l.unitPrice,
    price: l.unitPrice,
    lineTotal: l.lineTotal,
    priceTier: l.priceTier,
    retailUnitPrice: l.retailUnitPrice,
    wholesaleRule: l.wholesaleRule,
    image: l.image,
  }));

  const timeline = [{ status: "pending", timestamp: new Date().toISOString(), note: "Order placed successfully" }];

  const created = await sql.begin(async (tx) => {
    await deductStockForOrderLines(tx, quote.pricedLines);

    const [order] = await tx`
      insert into orders ${tx({
        buyer_id: buyerId,
        seller_id: sellerId,
        buyer_name: buyerName,
        seller_name: sellerName,
        items: orderItems,
        total: quote.total,
        shipping_fee: quote.shippingFee,
        delivery_address: quote.deliveryAddress,
        payment_method: paymentMethod,
        payment_status: paymentMethod === "cash_on_delivery" ? "unpaid" : "paid",
        timeline,
        estimated_delivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        estimated_delivery_note: note,
        status: "pending",
        date: new Date().toISOString().slice(0, 10),
        stock_restored: false,
      })}
      returning *
    `;
    return order;
  });

  return { order: created, quote };
}

/**
 * Restock products when an order is cancelled or returned (idempotent).
 * @param {Record<string, unknown>} order
 */
export async function restockOrderIfNeeded(order) {
  if (!order?.id || order.stock_restored) return false;
  const status = String(order.status || "");
  if (!["cancelled", "returned", "refunded"].includes(status)) return false;

  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return false;

  await sql.begin(async (tx) => {
    for (const item of items) {
      const productId = item?.productId || item?.product_id;
      const qty = Number(item?.qty ?? item?.quantity);
      if (!productId || !Number.isFinite(qty) || qty <= 0) continue;
      await tx`
        update products
        set stock = coalesce(stock, 0) + ${qty}, updated_at = now()
        where id = ${productId}
      `;
    }
    await tx`
      update orders
      set stock_restored = true, updated_at = now()
      where id = ${order.id} and not stock_restored
    `;
  });

  return true;
}
