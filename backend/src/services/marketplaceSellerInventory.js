import sql from "../db.js";

const CANCELLED_STATUSES = new Set(["cancelled", "returned", "refunded"]);

/**
 * @param {Array<{ status?: string, items?: unknown[] }>} orders
 */
export function aggregateSoldByProduct(orders) {
  /** @type {Map<string, { units_sold: number, units_delivered: number }>} */
  const soldByProduct = new Map();

  for (const order of orders) {
    const status = String(order.status || "");
    const isCancelled = CANCELLED_STATUSES.has(status);
    const isDelivered = status === "delivered";
    const items = Array.isArray(order.items) ? order.items : [];

    for (const item of items) {
      const productId = item?.productId || item?.product_id;
      if (!productId) continue;
      const qty = Number(item?.qty ?? item?.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const key = String(productId);
      const existing = soldByProduct.get(key) || { units_sold: 0, units_delivered: 0 };
      if (!isCancelled) {
        existing.units_sold += qty;
      }
      if (isDelivered) {
        existing.units_delivered += qty;
      }
      soldByProduct.set(key, existing);
    }
  }

  return soldByProduct;
}

/**
 * @param {string} sellerId
 */
export async function listSellerInventory(sellerId) {
  const products = await sql`
    select *
    from products
    where seller_id = ${sellerId}
    order by created_at desc
  `;

  const orders = await sql`
    select status, items
    from orders
    where seller_id = ${sellerId}
  `;

  const soldByProduct = aggregateSoldByProduct(orders);

  return products.map((product) => {
    const stats = soldByProduct.get(String(product.id)) || { units_sold: 0, units_delivered: 0 };
    return {
      ...product,
      stock: Number(product.stock ?? 0),
      units_sold: stats.units_sold,
      units_delivered: stats.units_delivered,
    };
  });
}
