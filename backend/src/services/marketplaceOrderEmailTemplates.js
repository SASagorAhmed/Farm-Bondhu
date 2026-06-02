/** @param {string} orderId */
export function orderShortCode(orderId) {
  return String(orderId || "").slice(0, 8).toUpperCase();
}

/** @param {string} name */
export function firstNameFrom(name) {
  const s = String(name || "").trim();
  if (!s) return "there";
  return s.split(/\s+/)[0];
}

/** @param {unknown} value */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** @param {number} amount */
function formatMoney(amount) {
  if (!Number.isFinite(amount)) return "—";
  return `৳${amount.toLocaleString("en-US")}`;
}

/** @param {unknown} method */
function paymentMethodLabel(method) {
  const m = String(method || "").toLowerCase();
  if (m === "cash_on_delivery") return "Cash on delivery";
  if (m === "online" || m === "card" || m === "mobile_banking") return "Online payment";
  return m ? m.replace(/_/g, " ") : "Not specified";
}

/** @param {unknown} address */
export function formatDeliverySummary(address) {
  if (!address || typeof address !== "object") return null;
  const a = /** @type {Record<string, unknown>} */ (address);
  const district = String(a.district || a.city || "").trim();
  const division = String(a.division || "").trim();
  if (district && division) return `${district}, ${division}`;
  return district || division || null;
}

/** @param {unknown} items */
function normalizeItems(items) {
  const list = Array.isArray(items) ? items : [];
  return list.map((item) => {
    const qty = Number(item?.qty ?? item?.quantity ?? 1);
    const price = Number(item?.price ?? 0);
    const lineTotal = Number.isFinite(price) ? price * qty : 0;
    return {
      name: String(item?.name || "Item"),
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      price: Number.isFinite(price) ? price : 0,
      lineTotal,
    };
  });
}

/** @param {Record<string, unknown>} order */
export function formatOrderSummary(order) {
  const total = Number(order.total);
  const shipping = Number(order.shipping_fee ?? 0);
  const grandTotal = Number.isFinite(total) ? total : 0;
  const shippingFee = Number.isFinite(shipping) ? shipping : 0;
  const subtotal = Math.max(0, grandTotal - shippingFee);
  return {
    subtotal,
    shippingFee,
    grandTotal,
    paymentLabel: paymentMethodLabel(order.payment_method),
    eta: typeof order.estimated_delivery_note === "string" ? order.estimated_delivery_note.trim() : null,
  };
}

/** @param {unknown} items */
export function formatItemsTableText(items) {
  const rows = normalizeItems(items);
  if (!rows.length) return "  (No items listed)";
  const lines = rows.map(
    (r) => `  • ${r.name} — Qty ${r.qty} × ${formatMoney(r.price)} = ${formatMoney(r.lineTotal)}`
  );
  return lines.join("\n");
}

/** @param {unknown} items */
export function formatItemsTableHtml(items) {
  const rows = normalizeItems(items);
  if (!rows.length) {
    return `<p style="margin:0;color:#64748b">No items listed.</p>`;
  }
  const body = rows
    .map(
      (r) => `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0">${escapeHtml(r.name)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:center">${r.qty}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right">${escapeHtml(formatMoney(r.price))}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${escapeHtml(formatMoney(r.lineTotal))}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
    <thead>
      <tr style="background:#f8fafc">
        <th align="left" style="padding:10px 8px;border-bottom:2px solid #e2e8f0">Item</th>
        <th style="padding:10px 8px;border-bottom:2px solid #e2e8f0">Qty</th>
        <th align="right" style="padding:10px 8px;border-bottom:2px solid #e2e8f0">Unit price</th>
        <th align="right" style="padding:10px 8px;border-bottom:2px solid #e2e8f0">Total</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

/** @param {Record<string, unknown>} order */
function formatOrderDate(order) {
  const raw = order.date || order.created_at;
  if (!raw) return "—";
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** @type {Record<string, { buyer: string; seller: string }>} */
export const EVENT_INTROS = {
  pending: {
    buyer:
      "Thank you for your purchase on FarmBondhu Marketplace. We have received your order and shared it with the shop for confirmation. You will receive another update once the shop accepts your order.",
    seller:
      "You have received a new marketplace order. Please review the items below and confirm the order in your seller dashboard when you are ready to begin fulfillment.",
  },
  confirmed: {
    buyer:
      "Good news — the shop has confirmed your order and will begin preparing your items. We will notify you again when your order is packed and ready to ship.",
    seller:
      "This order has been marked as confirmed. Please prepare the items listed below for packing and shipment.",
  },
  packed: {
    buyer:
      "Your order has been packed and is ready to be handed over for delivery. You will receive a shipping update with tracking details as soon as the parcel is dispatched.",
    seller:
      "This order has been marked as packed. Please hand it over to your delivery partner when ready.",
  },
  shipped: {
    buyer:
      "Your order is on its way. The shop has dispatched your parcel and it is now in transit. Please use the tracking reference below to follow progress.",
    seller:
      "This order has been marked as shipped. The customer has been notified with the tracking information.",
  },
  out_for_delivery: {
    buyer:
      "Your parcel is out for final delivery and should arrive soon. Please ensure someone is available to receive the order at your delivery location.",
    seller:
      "This order is out for final delivery. The customer has been notified.",
  },
  delivered: {
    buyer:
      "Your order has been delivered successfully. We hope you are satisfied with your purchase. If anything is not right, you can request a return from your order page within the return window.",
    seller:
      "This order has been marked as delivered. No further fulfillment action is required unless the customer contacts you.",
  },
  cancelled: {
    buyer:
      "Your order has been cancelled. If payment was collected in advance, any applicable refund will be processed according to our marketplace policy.",
    seller:
      "This order was cancelled by the customer. Please do not ship these items.",
  },
  return_requested: {
    buyer:
      "We have received your return request. The shop will review it and you will be notified when a decision is made.",
    seller:
      "A customer has requested a return for this order. Please review the request in your seller dashboard and respond promptly.",
  },
  returned: {
    buyer:
      "Your return has been accepted by the shop. Refund processing will follow according to the payment method used for this order.",
    seller:
      "This return has been accepted. Please complete any required refund or restocking steps in your seller dashboard.",
  },
  refunded: {
    buyer:
      "A refund for this order has been processed. Depending on your bank or payment provider, it may take a few business days to appear in your account.",
    seller:
      "A refund has been processed for this order. Please ensure your records reflect the updated payment status.",
  },
  new_order: {
    seller:
      "You have received a new marketplace order from a customer. Please review the details below and confirm the order when you are ready to fulfill it.",
    buyer: "",
  },
};

/**
 * @param {{
 *   audience: "buyer" | "seller";
 *   recipientName: string;
 *   order: Record<string, unknown>;
 *   shopName: string;
 *   statusLabel: string;
 *   eventKey: string;
 *   ctaUrl: string;
 *   ctaLabel: string;
 * }} opts
 */
export function buildOrderEmailText(opts) {
  const code = orderShortCode(opts.order.id);
  const first = firstNameFrom(opts.recipientName);
  const summary = formatOrderSummary(opts.order);
  const delivery = opts.audience === "buyer" ? formatDeliverySummary(opts.order.delivery_address) : null;
  const intro =
    (opts.audience === "buyer" ? EVENT_INTROS[opts.eventKey]?.buyer : EVENT_INTROS[opts.eventKey]?.seller) ||
    `Your order #${code} status is now: ${opts.statusLabel}.`;
  const tracking = opts.order.tracking_id ? String(opts.order.tracking_id) : null;

  const lines = [
    `FarmBondhu Marketplace`,
    `${opts.statusLabel} — Order #${code}`,
    "",
    `Hi ${first},`,
    "",
    intro,
    "",
    "— Order details —",
    `Order number: #${code}`,
    `Status: ${opts.statusLabel}`,
    `Order date: ${formatOrderDate(opts.order)}`,
  ];

  if (opts.audience === "buyer") {
    lines.push(`Shop: ${opts.shopName}`);
    if (delivery) lines.push(`Delivery area: ${delivery}`);
  }

  lines.push("", "Items:", formatItemsTableText(opts.order.items), "");
  lines.push(`Subtotal: ${formatMoney(summary.subtotal)}`);
  lines.push(`Shipping: ${formatMoney(summary.shippingFee)}`);
  lines.push(`Order total: ${formatMoney(summary.grandTotal)}`);
  lines.push(`Payment: ${summary.paymentLabel}`);
  if (summary.eta && opts.audience === "buyer") lines.push(`Estimated delivery: ${summary.eta}`);
  if (tracking && ["shipped", "out_for_delivery", "delivered"].includes(String(opts.order.status))) {
    lines.push(`Tracking reference: ${tracking}`);
  }

  lines.push(
    "",
    `${opts.ctaLabel}: ${opts.ctaUrl}`,
    "",
    "Need help? Visit FarmBondhu and open your order for full details and support options.",
    "",
    "This is an automated message from FarmBondhu Marketplace. Please do not reply to this email."
  );

  return lines.join("\n");
}

/**
 * @param {{
 *   audience: "buyer" | "seller";
 *   recipientName: string;
 *   order: Record<string, unknown>;
 *   shopName: string;
 *   statusLabel: string;
 *   eventKey: string;
 *   ctaUrl: string;
 *   ctaLabel: string;
 * }} opts
 */
export function buildOrderEmailHtml(opts) {
  const code = orderShortCode(opts.order.id);
  const first = escapeHtml(firstNameFrom(opts.recipientName));
  const summary = formatOrderSummary(opts.order);
  const delivery = opts.audience === "buyer" ? formatDeliverySummary(opts.order.delivery_address) : null;
  const intro =
    (opts.audience === "buyer" ? EVENT_INTROS[opts.eventKey]?.buyer : EVENT_INTROS[opts.eventKey]?.seller) ||
    `Your order #${code} status is now: ${opts.statusLabel}.`;
  const tracking = opts.order.tracking_id ? escapeHtml(String(opts.order.tracking_id)) : null;
  const shop = escapeHtml(opts.shopName);
  const status = escapeHtml(opts.statusLabel);
  const orderDate = escapeHtml(formatOrderDate(opts.order));

  const metaRows =
    opts.audience === "buyer"
      ? `<tr><td style="padding:6px 0;color:#64748b;width:120px">Shop</td><td style="padding:6px 0;font-weight:600">${shop}</td></tr>
         ${delivery ? `<tr><td style="padding:6px 0;color:#64748b">Delivery area</td><td style="padding:6px 0">${escapeHtml(delivery)}</td></tr>` : ""}`
      : "";

  const trackingBlock =
    tracking && ["shipped", "out_for_delivery", "delivered"].includes(String(opts.order.status))
      ? `<div style="margin:20px 0;padding:14px 16px;background:#ecfdf5;border:1px solid #99f6e4;border-radius:8px">
           <p style="margin:0 0 4px;font-size:12px;color:#0f766e;text-transform:uppercase;letter-spacing:0.04em">Tracking reference</p>
           <p style="margin:0;font-size:16px;font-weight:700;color:#134e4a">${tracking}</p>
         </div>`
      : "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08)">
          <tr>
            <td style="background:#0d9488;padding:20px 24px">
              <p style="margin:0;font-size:13px;color:#ccfbf1;letter-spacing:0.06em;text-transform:uppercase">FarmBondhu Marketplace</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#ffffff">${status}</h1>
              <p style="margin:6px 0 0;font-size:14px;color:#ccfbf1">Order #${escapeHtml(code)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${first},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#334155">${escapeHtml(intro)}</p>

              <div style="margin:0 0 20px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
                  <tr><td style="padding:6px 0;color:#64748b;width:120px">Order number</td><td style="padding:6px 0;font-weight:600">#${escapeHtml(code)}</td></tr>
                  <tr><td style="padding:6px 0;color:#64748b">Status</td><td style="padding:6px 0;font-weight:600">${status}</td></tr>
                  <tr><td style="padding:6px 0;color:#64748b">Order date</td><td style="padding:6px 0">${orderDate}</td></tr>
                  ${metaRows}
                </table>
              </div>

              <h2 style="margin:0 0 12px;font-size:16px">Order summary</h2>
              ${formatItemsTableHtml(opts.order.items)}

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;font-size:14px">
                <tr><td style="padding:6px 0;color:#64748b">Subtotal</td><td align="right" style="padding:6px 0">${escapeHtml(formatMoney(summary.subtotal))}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Shipping</td><td align="right" style="padding:6px 0">${escapeHtml(formatMoney(summary.shippingFee))}</td></tr>
                <tr><td style="padding:10px 0 6px;font-weight:700;border-top:1px solid #e2e8f0">Order total</td><td align="right" style="padding:10px 0 6px;font-weight:700;border-top:1px solid #e2e8f0">${escapeHtml(formatMoney(summary.grandTotal))}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Payment</td><td align="right" style="padding:6px 0">${escapeHtml(summary.paymentLabel)}</td></tr>
                ${summary.eta && opts.audience === "buyer" ? `<tr><td style="padding:6px 0;color:#64748b">Estimated delivery</td><td align="right" style="padding:6px 0">${escapeHtml(summary.eta)}</td></tr>` : ""}
              </table>

              ${trackingBlock}

              <p style="margin:28px 0 0;text-align:center">
                <a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">${escapeHtml(opts.ctaLabel)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;background:#f8fafc;border-top:1px solid #e2e8f0">
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.6">Need help? Open your order in FarmBondhu for full details and support options.</p>
              <p style="margin:0;font-size:12px;color:#94a3b8">This is an automated message from FarmBondhu Marketplace. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/** @param {string} code @param {string} statusLabel */
export function buildEmailSubject(code, statusLabel) {
  return `FarmBondhu — Order #${code} ${statusLabel}`;
}
