import sql from "../db.js";
import { config } from "../config.js";
import { isMailConfigured, sendMailMessage } from "./mailSmtp.js";
import {
  buildEmailSubject,
  buildOrderEmailHtml,
  buildOrderEmailText,
  orderShortCode,
} from "./marketplaceOrderEmailTemplates.js";

const STATUS_LABELS = {
  pending: "Order placed",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  return_requested: "Return requested",
  returned: "Returned",
  refunded: "Refunded",
};

const SHOP_FALLBACK = "FarmBondhu Marketplace Shop";

/** @param {string} path */
function appLink(path) {
  const base = config.frontendUrl || "http://localhost:5173";
  const p = String(path || "").startsWith("/") ? path : `/${path || ""}`;
  return `${base}${p}`;
}

/**
 * @param {string} sellerId
 * @returns {Promise<string>}
 */
async function loadShopName(sellerId) {
  if (!sellerId) return SHOP_FALLBACK;
  const [shop] = await sql`
    select shop_name from shops where user_id = ${sellerId} limit 1
  `;
  const name = shop?.shop_name ? String(shop.shop_name).trim() : "";
  return name || SHOP_FALLBACK;
}

/**
 * @param {string} userId
 * @returns {Promise<{ email: string | null; name: string }>}
 */
async function loadUserContact(userId) {
  if (!userId) return { email: null, name: "User" };
  const [row] = await sql`
    select email, name from profiles where id = ${userId} limit 1
  `;
  return {
    email: row?.email ? String(row.email).trim() : null,
    name: row?.name ? String(row.name).trim() : "User",
  };
}

/**
 * @param {{
 *   userId: string;
 *   type?: string;
 *   context?: string;
 *   priority?: string;
 *   title: string;
 *   message: string;
 *   actionUrl?: string | null;
 * }} opts
 */
async function insertNotification(opts) {
  const actionUrl = opts.actionUrl || null;
  try {
    await sql`
      insert into notifications ${sql({
        user_id: opts.userId,
        type: opts.type || "order",
        context: opts.context || "marketplace",
        priority: opts.priority || "normal",
        title: opts.title,
        message: opts.message,
        link: actionUrl,
        action_url: actionUrl,
        read: false,
        created_at: new Date().toISOString(),
      })}
    `;
  } catch (err) {
    console.error("[marketplaceOrderNotify] in-app notification insert failed:", err?.message || err);
  }
}

/**
 * @param {{
 *   to: string;
 *   subject: string;
 *   text: string;
 *   html?: string;
 *   orderId: string;
 *   eventKey: string;
 *   audience: string;
 * }} opts
 */
async function sendOrderEmail(opts) {
  if (!isMailConfigured()) {
    console.warn("[marketplaceOrderNotify] Email not configured; skipping send to", opts.to);
    return;
  }
  await sendMailMessage({
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    audit: {
      emailType: "marketplace_order",
      category: "marketplace",
      metadata: {
        orderId: opts.orderId,
        eventKey: opts.eventKey,
        audience: opts.audience,
      },
    },
  });
}

/**
 * @param {{
 *   userId: string;
 *   order: Record<string, unknown>;
 *   shopName: string;
 *   audience: "buyer" | "seller";
 *   title: string;
 *   message: string;
 *   actionUrl: string;
 *   eventKey: string;
 *   statusLabel: string;
 *   ctaLabel: string;
 * }} opts
 */
async function notifyUser(opts) {
  await insertNotification({
    userId: opts.userId,
    title: opts.title,
    message: opts.message,
    actionUrl: opts.actionUrl,
  });

  const contact = await loadUserContact(opts.userId);
  if (!contact.email) {
    console.warn("[marketplaceOrderNotify] No email on profile for user", opts.userId);
    return;
  }

  const code = orderShortCode(opts.order.id);
  const orderPageUrl = appLink(opts.actionUrl);
  const emailOpts = {
    audience: opts.audience,
    recipientName: contact.name,
    order: opts.order,
    shopName: opts.shopName,
    statusLabel: opts.statusLabel,
    eventKey: opts.eventKey,
    ctaUrl: orderPageUrl,
    ctaLabel: opts.ctaLabel,
  };

  await sendOrderEmail({
    to: contact.email,
    subject: buildEmailSubject(code, opts.statusLabel),
    text: buildOrderEmailText(emailOpts),
    html: buildOrderEmailHtml(emailOpts),
    orderId: String(opts.order.id),
    eventKey: opts.eventKey,
    audience: opts.audience,
  });
}

/** @param {Record<string, unknown>} order */
export async function notifyMarketplaceOrderCreated(order) {
  const orderId = String(order.id);
  const code = orderShortCode(orderId);
  const shopName = await loadShopName(String(order.seller_id));
  const total = Number(order.total);
  const totalLabel = Number.isFinite(total) ? `৳${total.toLocaleString("en-US")}` : "";

  await notifyUser({
    userId: String(order.buyer_id),
    order,
    shopName,
    audience: "buyer",
    title: "Order placed",
    message: `Your order #${code} from ${shopName} was placed successfully.${totalLabel ? ` Total: ${totalLabel}.` : ""}`,
    actionUrl: `/orders/${orderId}`,
    eventKey: "pending",
    statusLabel: STATUS_LABELS.pending,
    ctaLabel: "View order",
  });

  await notifyUser({
    userId: String(order.seller_id),
    order,
    shopName,
    audience: "seller",
    title: "New order received",
    message: `You received order #${code} from a customer.${totalLabel ? ` Total: ${totalLabel}.` : ""}`,
    actionUrl: `/seller/orders/${orderId}`,
    eventKey: "new_order",
    statusLabel: "New order",
    ctaLabel: "Manage order",
  });
}

const BUYER_STATUS_EVENTS = {
  confirmed: {
    title: "Order confirmed",
    message: (code, shopName) => `${shopName} confirmed your order #${code}.`,
    label: STATUS_LABELS.confirmed,
    eventKey: "confirmed",
  },
  packed: {
    title: "Order packed",
    message: (code) => `Your order #${code} has been packed and is ready for shipping.`,
    label: STATUS_LABELS.packed,
    eventKey: "packed",
  },
  shipped: {
    title: "Order shipped",
    message: (code, _shopName, tracking) =>
      tracking
        ? `Your order #${code} has been shipped. Tracking: ${tracking}.`
        : `Your order #${code} has been shipped.`,
    label: STATUS_LABELS.shipped,
    eventKey: "shipped",
  },
  out_for_delivery: {
    title: "Out for delivery",
    message: (code) => `Your order #${code} is out for delivery.`,
    label: STATUS_LABELS.out_for_delivery,
    eventKey: "out_for_delivery",
  },
  delivered: {
    title: "Order delivered",
    message: (code) => `Your order #${code} has been delivered. Thank you for shopping!`,
    label: STATUS_LABELS.delivered,
    eventKey: "delivered",
  },
  cancelled: {
    title: "Order cancelled",
    message: (code) => `Your order #${code} has been cancelled.`,
    label: STATUS_LABELS.cancelled,
    eventKey: "cancelled",
  },
  return_requested: {
    title: "Return requested",
    message: (code) => `Your return request for order #${code} has been submitted.`,
    label: STATUS_LABELS.return_requested,
    eventKey: "return_requested",
  },
  returned: {
    title: "Return accepted",
    message: (code) => `Your return for order #${code} has been accepted.`,
    label: STATUS_LABELS.returned,
    eventKey: "returned",
  },
  refunded: {
    title: "Refund processed",
    message: (code) => `A refund for order #${code} has been processed.`,
    label: STATUS_LABELS.refunded,
    eventKey: "refunded",
  },
};

const SELLER_STATUS_EVENTS = {
  cancelled: {
    title: "Order cancelled",
    message: (code) => `Order #${code} was cancelled by the customer.`,
    label: "Order cancelled by customer",
    eventKey: "cancelled",
  },
  return_requested: {
    title: "Return requested",
    message: (code) => `A customer requested a return for order #${code}.`,
    label: "Customer requested return",
    eventKey: "return_requested",
  },
};

/**
 * @param {Record<string, unknown>} before
 * @param {Record<string, unknown>} after
 */
export async function notifyMarketplaceOrderStatusChange(before, after) {
  const prevStatus = String(before.status || "");
  const nextStatus = String(after.status || "");
  if (prevStatus === nextStatus) return;

  const orderId = String(after.id);
  const code = orderShortCode(orderId);
  const shopName = await loadShopName(String(after.seller_id));
  const tracking = after.tracking_id ? String(after.tracking_id) : null;

  const buyerEvent = BUYER_STATUS_EVENTS[nextStatus];
  if (buyerEvent) {
    await notifyUser({
      userId: String(after.buyer_id),
      order: after,
      shopName,
      audience: "buyer",
      title: buyerEvent.title,
      message: buyerEvent.message(code, shopName, tracking),
      actionUrl: `/orders/${orderId}`,
      eventKey: buyerEvent.eventKey,
      statusLabel: buyerEvent.label,
      ctaLabel: "View order",
    });
  }

  const sellerEvent = SELLER_STATUS_EVENTS[nextStatus];
  if (sellerEvent) {
    await notifyUser({
      userId: String(after.seller_id),
      order: after,
      shopName,
      audience: "seller",
      title: sellerEvent.title,
      message: sellerEvent.message(code),
      actionUrl: `/seller/orders/${orderId}`,
      eventKey: sellerEvent.eventKey,
      statusLabel: sellerEvent.label,
      ctaLabel: "Manage order",
    });
  }
}
