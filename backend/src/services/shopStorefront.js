const MAX_PINNED = 8;

export class ShopStorefrontError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ShopStorefrontError";
    this.status = status;
  }
}

function normalizePinOrder(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PINNED) {
    throw new ShopStorefrontError(`shop_pin_order must be 1-${MAX_PINNED} or null`);
  }
  return n;
}

function normalizeSortOrder(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new ShopStorefrontError("shop_sort_order must be a non-negative integer");
  }
  return n;
}

/**
 * Validate and apply bulk storefront display updates for a seller's products.
 * @param {import("postgres").Sql} sql
 * @param {string} sellerId
 * @param {Array<{ product_id: string, shop_pin_order?: number|null, shop_sort_order?: number }>} items
 */
export async function applyShopStorefrontUpdates(sql, sellerId, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ShopStorefrontError("items array is required");
  }

  const normalized = items.map((item) => {
    const productId = String(item.product_id || item.productId || "").trim();
    if (!productId) throw new ShopStorefrontError("Each item requires product_id");
    const patch = { product_id: productId };
    if ("shop_pin_order" in item) {
      patch.shop_pin_order = normalizePinOrder(item.shop_pin_order);
    }
    if ("shop_sort_order" in item) {
      patch.shop_sort_order = normalizeSortOrder(item.shop_sort_order);
    }
    return patch;
  });

  const productIds = normalized.map((i) => i.product_id);
  const owned = await sql`
    select id, listing_status
    from products
    where seller_id = ${sellerId}
      and id in ${sql(productIds)}
  `;
  const ownedMap = new Map(owned.map((r) => [String(r.id), r]));

  for (const id of productIds) {
    if (!ownedMap.has(id)) {
      throw new ShopStorefrontError("Product not found or not owned by seller", 403);
    }
  }

  const pinAssignments = normalized.filter((i) => "shop_pin_order" in i && i.shop_pin_order != null);
  const pinOrders = pinAssignments.map((i) => i.shop_pin_order);
  if (new Set(pinOrders).size !== pinOrders.length) {
    throw new ShopStorefrontError("Duplicate shop_pin_order values in request");
  }
  if (pinOrders.length > MAX_PINNED) {
    throw new ShopStorefrontError(`Maximum ${MAX_PINNED} pinned products allowed`);
  }

  for (const item of pinAssignments) {
    const row = ownedMap.get(item.product_id);
    if (String(row.listing_status || "approved") !== "approved") {
      throw new ShopStorefrontError("Only approved products can be pinned");
    }
  }

  const existingPins = await sql`
    select id, shop_pin_order
    from products
    where seller_id = ${sellerId}
      and shop_pin_order is not null
  `;
  const finalPinByProduct = new Map(
    existingPins.map((r) => [String(r.id), r.shop_pin_order])
  );
  for (const item of normalized) {
    if ("shop_pin_order" in item) {
      if (item.shop_pin_order == null) {
        finalPinByProduct.delete(item.product_id);
      } else {
        finalPinByProduct.set(item.product_id, item.shop_pin_order);
      }
    }
  }

  const finalPinOrders = [...finalPinByProduct.values()];
  if (finalPinOrders.length > MAX_PINNED) {
    throw new ShopStorefrontError(`Maximum ${MAX_PINNED} pinned products allowed`);
  }
  if (new Set(finalPinOrders).size !== finalPinOrders.length) {
    throw new ShopStorefrontError("Pin slot already in use by another product");
  }

  const updated = [];
  for (const item of normalized) {
    const patch = {};
    if ("shop_pin_order" in item) patch.shop_pin_order = item.shop_pin_order;
    if ("shop_sort_order" in item) patch.shop_sort_order = item.shop_sort_order;
    if (!Object.keys(patch).length) continue;

    const [row] = await sql`
      update products
      set ${sql({ ...patch, updated_at: new Date().toISOString() })}
      where id = ${item.product_id}
        and seller_id = ${sellerId}
      returning id, shop_pin_order, shop_sort_order
    `;
    if (row) updated.push(row);
  }

  return updated;
}

export { MAX_PINNED };
