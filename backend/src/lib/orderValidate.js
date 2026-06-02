const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BD_PHONE_RE = /^01\d{9}$/;

/**
 * @param {unknown} body
 * @returns {{ ok: true, sellerId: string, items: Array<{ productId: string, qty: number, priceTier: "retail"|"wholesale" }>, deliveryAddress?: unknown, paymentMethod?: string, buyerName?: string, sellerName?: string, estimatedDeliveryNote?: string } | { ok: false, error: string }}
 */
export function validateOrderCartInput(body) {
  const b = body && typeof body === "object" ? body : {};

  if (!isUuid(b.seller_id)) {
    return { ok: false, error: "seller_id must be a valid UUID" };
  }

  if (!Array.isArray(b.items) || b.items.length === 0) {
    return { ok: false, error: "items must be a non-empty array" };
  }

  const items = [];
  for (let i = 0; i < b.items.length; i++) {
    const line = b.items[i];
    if (!line || typeof line !== "object") {
      return { ok: false, error: `items[${i}] must be an object` };
    }
    const productId = line.productId || line.product_id;
    if (!isUuid(productId)) {
      return { ok: false, error: `items[${i}].productId must be a valid UUID` };
    }
    const qty = Number(line.qty ?? line.quantity);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      return { ok: false, error: `items[${i}].qty must be a positive integer` };
    }
    const tierRaw = line.priceTier ?? line.price_tier ?? "retail";
    const priceTier = tierRaw === "wholesale" ? "wholesale" : "retail";
    items.push({ productId: String(productId), qty, priceTier });
  }

  return {
    ok: true,
    sellerId: String(b.seller_id),
    items,
    deliveryAddress: b.delivery_address,
    paymentMethod: typeof b.payment_method === "string" ? b.payment_method : undefined,
    buyerName: typeof b.buyer_name === "string" ? b.buyer_name : undefined,
    sellerName: typeof b.seller_name === "string" ? b.seller_name : undefined,
    estimatedDeliveryNote: typeof b.estimated_delivery_note === "string" ? b.estimated_delivery_note : undefined,
  };
}

/**
 * @param {unknown} value
 */
export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, row: Record<string, unknown> } | { ok: false, error: string }}
 */
export function validateOrderInsert(body) {
  const b = body && typeof body === "object" ? body : {};

  if (!isUuid(b.seller_id)) {
    return { ok: false, error: "seller_id must be a valid UUID" };
  }

  if (!Array.isArray(b.items) || b.items.length === 0) {
    return { ok: false, error: "items must be a non-empty array" };
  }

  const total = Number(b.total);
  const shippingFee = Number(b.shipping_fee);
  if (!Number.isFinite(total) || total < 0) {
    return { ok: false, error: "total must be a valid number" };
  }
  if (!Number.isFinite(shippingFee) || shippingFee < 0) {
    return { ok: false, error: "shipping_fee must be a valid number" };
  }

  const address = normalizeDeliveryAddress(b.delivery_address);
  if (!address.ok) return address;

  const note =
    typeof b.estimated_delivery_note === "string" && b.estimated_delivery_note.trim()
      ? b.estimated_delivery_note.trim()
      : "3-5 business days";

  const row = {
    seller_id: b.seller_id,
    buyer_name: typeof b.buyer_name === "string" ? b.buyer_name.trim() || null : null,
    seller_name: typeof b.seller_name === "string" ? b.seller_name.trim() || null : null,
    items: b.items,
    total,
    shipping_fee: shippingFee,
    delivery_address: address.value,
    payment_method: typeof b.payment_method === "string" ? b.payment_method : "cash_on_delivery",
    payment_status: typeof b.payment_status === "string" ? b.payment_status : "unpaid",
    timeline: Array.isArray(b.timeline) ? b.timeline : [{ status: "pending", timestamp: new Date().toISOString(), note: "Order placed successfully" }],
    estimated_delivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    estimated_delivery_note: note,
    status: typeof b.status === "string" ? b.status : "pending",
    date: b.date || new Date().toISOString().slice(0, 10),
  };

  if (b.return_reason !== undefined) row.return_reason = b.return_reason;
  if (b.return_note !== undefined) row.return_note = b.return_note;
  if (b.tracking_id !== undefined) row.tracking_id = b.tracking_id;

  return { ok: true, row };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: Record<string, unknown> } | { ok: false, error: string }}
 */
export function normalizeDeliveryAddress(raw) {
  let addr = raw;
  if (typeof addr === "string") {
    const trimmed = addr.trim();
    if (!trimmed) return { ok: false, error: "delivery_address is required" };
    try {
      addr = JSON.parse(trimmed);
    } catch {
      addr = { address: trimmed };
    }
  }

  if (!addr || typeof addr !== "object" || Array.isArray(addr)) {
    return { ok: false, error: "delivery_address must be an object" };
  }

  const a = /** @type {Record<string, unknown>} */ (addr);
  const recipientName = String(a.recipientName || a.recipient_name || "").trim();
  const phone = String(a.phone || "").trim();
  const street = String(a.address || a.full_address || "").trim();
  const division = String(a.division || "").trim();
  const district = String(a.district || a.city || "").trim();

  if (!recipientName) return { ok: false, error: "delivery_address.recipientName is required" };
  if (!BD_PHONE_RE.test(phone)) return { ok: false, error: "delivery_address.phone must be a valid Bangladesh mobile (01XXXXXXXXX)" };
  if (!street) return { ok: false, error: "delivery_address.address is required" };
  if (!division && !district) return { ok: false, error: "delivery_address division or district is required" };

  return {
    ok: true,
    value: {
      recipientName,
      phone,
      altPhone: a.altPhone || a.alt_phone || undefined,
      country: a.country || "Bangladesh",
      division: division || undefined,
      district: district || undefined,
      upazila: a.upazila || undefined,
      area: a.area || "",
      address: street,
      landmark: a.landmark || undefined,
      postCode: a.postCode || a.post_code || undefined,
      addressType: a.addressType || a.address_type || undefined,
      city: district || String(a.city || ""),
      note: a.note || undefined,
    },
  };
}
