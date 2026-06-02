import sql from "../db.js";

export class ReviewError extends Error {
  /** @param {string} message @param {number} [status] */
  constructor(message, status = 400) {
    super(message);
    this.name = "ReviewError";
    this.status = status;
  }
}

/** @param {unknown} raw */
export function normalizePhotoUrls(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean).slice(0, 3);
}

/** @param {unknown} raw */
export function parseRating(raw) {
  const r = Number(raw);
  if (!Number.isInteger(r) || r < 1 || r > 5) return null;
  return r;
}

/** @param {unknown} items @param {string} productId */
export function orderContainsProduct(items, productId) {
  const pid = String(productId || "").trim();
  if (!pid) return false;
  const list = Array.isArray(items) ? items : [];
  return list.some((item) => {
    const id = String(item?.productId || item?.product_id || "").trim();
    return id === pid;
  });
}

/** @param {unknown} raw */
export function normalizeReviewComment(raw) {
  if (raw == null) return null;
  const text = String(raw).trim().slice(0, 2000);
  return text || null;
}

/**
 * @param {{ id: string; status?: string; items?: unknown; date?: unknown; created_at?: unknown; seller_name?: unknown }} order
 * @param {Set<string> | Iterable<string>} reviewedProductIds
 * @param {{ productIdFilter?: string | null }} [opts]
 */
export function pendingItemsFromOrder(order, reviewedProductIds, opts = {}) {
  if (String(order.status) !== "delivered") return [];
  const reviewed =
    reviewedProductIds instanceof Set ? reviewedProductIds : new Set(reviewedProductIds);
  const productIdFilter = opts.productIdFilter ? String(opts.productIdFilter).trim() : null;
  const items = Array.isArray(order.items) ? order.items : [];
  const pending = [];
  const seen = new Set();

  for (const item of items) {
    const productId = String(item?.productId || item?.product_id || "").trim();
    if (!productId || reviewed.has(productId)) continue;
    if (productIdFilter && productId !== productIdFilter) continue;
    const key = `${order.id}:${productId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pending.push({
      orderId: String(order.id),
      productId,
      productName: item?.name ? String(item.name) : "Product",
      productImage: item?.image ? String(item.image) : null,
      orderDate: order.date || order.created_at || null,
      sellerName: order.seller_name ? String(order.seller_name) : null,
    });
  }
  return pending;
}

/**
 * @param {string} userId
 * @param {{ productId?: string }} [opts]
 */
export async function listPendingReviewables(userId, opts = {}) {
  const productIdFilter = opts.productId ? String(opts.productId).trim() : null;

  const orders = await sql`
    select id, items, status, date, created_at, seller_name
    from orders
    where buyer_id = ${userId}
      and status = 'delivered'
    order by created_at desc
  `;

  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const existing = await sql`
    select order_id, product_id
    from marketplace_product_reviews
    where order_id = any(${orderIds})
      and deleted_at is null
  `;

  const reviewedByOrder = new Map();
  for (const row of existing) {
    const oid = String(row.order_id);
    if (!reviewedByOrder.has(oid)) reviewedByOrder.set(oid, new Set());
    reviewedByOrder.get(oid).add(String(row.product_id));
  }

  const all = [];
  for (const order of orders) {
    const reviewed = reviewedByOrder.get(String(order.id)) || new Set();
    all.push(
      ...pendingItemsFromOrder(order, reviewed, {
        productIdFilter,
      }),
    );
  }
  return all;
}

/**
 * @param {string} userId
 * @param {string} orderId
 * @param {string} productId
 */
export async function assertReviewEligible(userId, orderId, productId) {
  const [order] = await sql`select * from orders where id = ${orderId} limit 1`;
  if (!order) throw new ReviewError("Order not found", 404);
  if (String(order.buyer_id) !== String(userId)) throw new ReviewError("Forbidden", 403);
  if (String(order.status) !== "delivered") {
    throw new ReviewError("Reviews are only allowed after delivery", 400);
  }
  if (!orderContainsProduct(order.items, productId)) {
    throw new ReviewError("Product not found in this order", 400);
  }

  const [existing] = await sql`
    select id from marketplace_product_reviews
    where order_id = ${orderId}
      and product_id = ${productId}
      and deleted_at is null
    limit 1
  `;
  if (existing) throw new ReviewError("You already reviewed this product for this order", 409);

  return order;
}

/** @param {string} productId */
export async function recomputeProductRating(productId) {
  const [agg] = await sql`
    select
      coalesce(avg(rating)::numeric, 0) as avg_rating,
      count(*)::int as review_count
    from marketplace_product_reviews
    where product_id = ${productId}
      and deleted_at is null
  `;
  const avg = agg ? Number(agg.avg_rating) : 0;
  const count = agg ? Number(agg.review_count) : 0;
  const roundedRating = Math.round(avg * 10) / 10;
  await sql`
    update products
    set rating = ${roundedRating},
        review_count = ${count},
        updated_at = now()
    where id = ${productId}
  `;
  return { rating: roundedRating, reviewCount: count };
}

/**
 * @param {{
 *   userId: string;
 *   orderId: string;
 *   productId: string;
 *   rating: unknown;
 *   comment?: unknown;
 *   photoUrls?: unknown;
 * }} args
 */
export async function createReview({ userId, orderId, productId, rating, comment, photoUrls }) {
  const order = await assertReviewEligible(userId, orderId, productId);
  const parsedRating = parseRating(rating);
  if (parsedRating == null) throw new ReviewError("rating must be an integer from 1 to 5", 400);

  const photos = normalizePhotoUrls(photoUrls);
  const commentText = normalizeReviewComment(comment);

  const [created] = await sql`
    insert into marketplace_product_reviews (
      order_id,
      product_id,
      buyer_id,
      seller_id,
      rating,
      comment,
      photo_urls,
      created_at,
      updated_at
    ) values (
      ${orderId},
      ${productId},
      ${userId},
      ${order.seller_id},
      ${parsedRating},
      ${commentText},
      ${sql.json(photos)},
      now(),
      now()
    )
    returning *
  `;

  const aggregates = await recomputeProductRating(productId);
  return { review: created, ...aggregates };
}

/**
 * @param {string} productId
 * @param {{ page?: number; limit?: number }} [opts]
 */
export async function listProductReviews(productId, opts = {}) {
  const page = Math.max(Number(opts.page) || 1, 1);
  const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 50);
  const offset = (page - 1) * limit;

  const rows = await sql`
    select
      r.id,
      r.order_id,
      r.product_id,
      r.buyer_id,
      r.rating,
      r.comment,
      r.photo_urls,
      r.seller_reply,
      r.seller_reply_at,
      r.created_at,
      p.name as buyer_name,
      p.avatar_url as buyer_avatar
    from marketplace_product_reviews r
    left join profiles p on p.id = r.buyer_id
    where r.product_id = ${productId}
      and r.deleted_at is null
    order by r.created_at desc
    limit ${limit}
    offset ${offset}
  `;

  const [aggRow] = await sql`
    select
      coalesce(avg(rating)::numeric, 0) as average_rating,
      count(*)::int as total
    from marketplace_product_reviews
    where product_id = ${productId}
      and deleted_at is null
  `;

  const total = aggRow?.total ?? 0;
  const averageRating = Math.round(Number(aggRow?.average_rating ?? 0) * 10) / 10;

  return {
    reviews: rows,
    page,
    limit,
    total,
    averageRating,
  };
}

/**
 * @param {string} orderId
 * @param {string} userId
 */
export async function listOrderReviewStatus(orderId, userId) {
  const [order] = await sql`select * from orders where id = ${orderId} limit 1`;
  if (!order) throw new ReviewError("Order not found", 404);
  if (String(order.buyer_id) !== String(userId)) throw new ReviewError("Forbidden", 403);

  const items = Array.isArray(order.items) ? order.items : [];
  const productIds = [
    ...new Set(
      items
        .map((item) => String(item?.productId || item?.product_id || "").trim())
        .filter(Boolean),
    ),
  ];

  if (productIds.length === 0) {
    return { orderId, status: order.status, items: [] };
  }

  const existing = await sql`
    select id, product_id
    from marketplace_product_reviews
    where order_id = ${orderId}
      and product_id = any(${productIds})
      and deleted_at is null
  `;
  const reviewByProduct = new Map(existing.map((r) => [String(r.product_id), String(r.id)]));

  const delivered = String(order.status) === "delivered";

  return {
    orderId,
    status: order.status,
    items: items.map((item) => {
      const productId = String(item?.productId || item?.product_id || "").trim();
      const reviewId = reviewByProduct.get(productId);
      return {
        productId,
        name: item?.name || "Product",
        image: item?.image || null,
        canReview: delivered && Boolean(productId) && !reviewId,
        alreadyReviewed: Boolean(reviewId),
        reviewId: reviewId || null,
      };
    }),
  };
}

/** @param {string} reviewId @param {string} adminUserId */
export async function adminDeleteReview(reviewId, adminUserId) {
  const [row] = await sql`
    update marketplace_product_reviews
    set deleted_at = now(),
        deleted_by = ${adminUserId},
        updated_at = now()
    where id = ${reviewId}
      and deleted_at is null
    returning product_id
  `;
  if (!row) throw new ReviewError("Review not found", 404);
  await recomputeProductRating(row.product_id);
  return { ok: true, productId: row.product_id };
}

/** @param {{ limit?: number }} [opts] */
export async function listAdminReviews(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 400);
  return sql`
    select
      r.*,
      p.name as buyer_name,
      pr.name as product_name
    from marketplace_product_reviews r
    left join profiles p on p.id = r.buyer_id
    left join products pr on pr.id = r.product_id
    order by r.created_at desc
    limit ${limit}
  `;
}

/** @param {unknown} raw */
export function normalizeSellerReply(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new ReviewError("Reply cannot be empty", 400);
  return text.slice(0, 1000);
}

/**
 * @param {string} sellerId
 * @param {{ page?: number; limit?: number; filter?: string; productId?: string }} [opts]
 */
export async function listSellerReviews(sellerId, opts = {}) {
  const page = Math.max(Number(opts.page) || 1, 1);
  const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 50);
  const offset = (page - 1) * limit;
  const filter = String(opts.filter || "all").toLowerCase();
  const productId = opts.productId ? String(opts.productId).trim() : null;

  const [statsRow] = await sql`
    select
      count(*)::int as total,
      count(*) filter (where seller_reply is null)::int as needs_reply,
      count(*) filter (where seller_reply is not null)::int as replied
    from marketplace_product_reviews
    where seller_id = ${sellerId}
      and deleted_at is null
  `;

  const total = statsRow?.total ?? 0;
  const needsReplyCount = statsRow?.needs_reply ?? 0;
  const repliedCount = statsRow?.replied ?? 0;
  const responseRate = total > 0 ? Math.round((repliedCount / total) * 1000) / 10 : 0;

  const rows = await sql`
    select
      r.id,
      r.order_id,
      r.product_id,
      r.buyer_id,
      r.rating,
      r.comment,
      r.photo_urls,
      r.seller_reply,
      r.seller_reply_at,
      r.seller_reply_updated_at,
      r.created_at,
      p.name as product_name,
      p.image as product_image,
      pr.name as buyer_name,
      pr.avatar_url as buyer_avatar
    from marketplace_product_reviews r
    left join products p on p.id = r.product_id
    left join profiles pr on pr.id = r.buyer_id
    where r.seller_id = ${sellerId}
      and r.deleted_at is null
      ${filter === "needs_reply" ? sql`and r.seller_reply is null` : sql``}
      ${filter === "replied" ? sql`and r.seller_reply is not null` : sql``}
      ${productId ? sql`and r.product_id = ${productId}` : sql``}
    order by r.created_at desc
    limit ${limit}
    offset ${offset}
  `;

  let filteredTotal = total;
  if (filter === "needs_reply") filteredTotal = needsReplyCount;
  if (filter === "replied") filteredTotal = repliedCount;

  return {
    reviews: rows,
    page,
    limit,
    total: filteredTotal,
    stats: { total, needsReplyCount, repliedCount, responseRate },
  };
}

/**
 * @param {string} sellerId
 * @param {string} reviewId
 * @param {unknown} body
 */
export async function upsertSellerReviewReply(sellerId, reviewId, body) {
  const replyText = normalizeSellerReply(body);

  const [review] = await sql`
    select id, seller_id
    from marketplace_product_reviews
    where id = ${reviewId}
      and deleted_at is null
    limit 1
  `;
  if (!review) throw new ReviewError("Review not found", 404);
  if (String(review.seller_id) !== String(sellerId)) throw new ReviewError("Forbidden", 403);

  const [updated] = await sql`
    update marketplace_product_reviews
    set seller_reply = ${replyText},
        seller_reply_at = case when seller_reply_at is null then now() else seller_reply_at end,
        seller_reply_updated_at = now(),
        updated_at = now()
    where id = ${reviewId}
    returning *
  `;
  return updated;
}
