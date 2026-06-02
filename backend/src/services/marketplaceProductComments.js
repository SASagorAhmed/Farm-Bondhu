import sql from "../db.js";
import { ReviewError } from "./marketplaceReviews.js";

const MAX_COMMENT_LENGTH = 1000;

/** @param {unknown} raw */
export function normalizeCommentBody(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  return text.slice(0, MAX_COMMENT_LENGTH);
}

/**
 * @param {{ userId: string; productId: string; body: unknown }} args
 */
export async function createProductComment({ userId, productId, body }) {
  const normalized = normalizeCommentBody(body);
  if (!normalized) throw new ReviewError("Comment cannot be empty", 400);

  const [product] = await sql`
    select id from products where id = ${productId} limit 1
  `;
  if (!product) throw new ReviewError("Product not found", 404);

  const [created] = await sql`
    insert into marketplace_product_comments (
      product_id,
      user_id,
      body,
      created_at,
      updated_at
    ) values (
      ${productId},
      ${userId},
      ${normalized},
      now(),
      now()
    )
    returning *
  `;

  return created;
}

/**
 * @param {string} productId
 * @param {{ page?: number; limit?: number }} [opts]
 */
export async function listProductComments(productId, opts = {}) {
  const page = Math.max(Number(opts.page) || 1, 1);
  const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 50);
  const offset = (page - 1) * limit;

  const rows = await sql`
    select
      c.id,
      c.product_id,
      c.user_id,
      c.body,
      c.created_at,
      p.name as user_name,
      p.avatar_url as user_avatar
    from marketplace_product_comments c
    left join profiles p on p.id = c.user_id
    where c.product_id = ${productId}
      and c.deleted_at is null
      and c.parent_id is null
    order by c.created_at desc
    limit ${limit}
    offset ${offset}
  `;

  const replyByParent = await fetchSellerRepliesForParents(rows.map((r) => r.id));

  const [countRow] = await sql`
    select count(*)::int as total
    from marketplace_product_comments
    where product_id = ${productId}
      and deleted_at is null
      and parent_id is null
  `;

  return {
    comments: rows.map((row) => ({
      ...row,
      seller_reply: replyByParent.get(String(row.id)) || null,
    })),
    page,
    limit,
    total: countRow?.total ?? 0,
  };
}

/** @param {string[]} parentIds */
async function fetchSellerRepliesForParents(parentIds) {
  const ids = parentIds.filter(Boolean);
  if (ids.length === 0) return new Map();

  const replies = await sql`
    select
      c.id,
      c.parent_id,
      c.user_id,
      c.body,
      c.created_at,
      c.updated_at,
      p.name as user_name,
      p.avatar_url as user_avatar
    from marketplace_product_comments c
    left join profiles p on p.id = c.user_id
    where c.parent_id = any(${ids})
      and c.deleted_at is null
  `;

  const map = new Map();
  for (const reply of replies) {
    const key = String(reply.parent_id);
    if (!map.has(key)) map.set(key, reply);
  }
  return map;
}

/**
 * @param {string} sellerId
 * @param {{ page?: number; limit?: number; filter?: string }} [opts]
 */
export async function listSellerProductComments(sellerId, opts = {}) {
  const page = Math.max(Number(opts.page) || 1, 1);
  const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 50);
  const offset = (page - 1) * limit;
  const filter = String(opts.filter || "all").toLowerCase();

  const [statsRow] = await sql`
    select
      count(*)::int as total,
      count(*) filter (where not exists (
        select 1 from marketplace_product_comments r
        where r.parent_id = c.id and r.deleted_at is null
      ))::int as needs_reply
    from marketplace_product_comments c
    join products p on p.id = c.product_id
    where p.seller_id = ${sellerId}
      and c.deleted_at is null
      and c.parent_id is null
  `;

  const total = statsRow?.total ?? 0;
  const needsReplyCount = statsRow?.needs_reply ?? 0;
  const repliedCount = Math.max(total - needsReplyCount, 0);
  const responseRate = total > 0 ? Math.round((repliedCount / total) * 1000) / 10 : 0;

  const rows = await sql`
    select
      c.id,
      c.product_id,
      c.user_id,
      c.body,
      c.created_at,
      pr.name as user_name,
      pr.avatar_url as user_avatar,
      p.name as product_name,
      p.image as product_image
    from marketplace_product_comments c
    join products p on p.id = c.product_id
    left join profiles pr on pr.id = c.user_id
    where p.seller_id = ${sellerId}
      and c.deleted_at is null
      and c.parent_id is null
      ${
        filter === "needs_reply"
          ? sql`and not exists (
            select 1 from marketplace_product_comments r
            where r.parent_id = c.id and r.deleted_at is null
          )`
          : sql``
      }
      ${
        filter === "replied"
          ? sql`and exists (
            select 1 from marketplace_product_comments r
            where r.parent_id = c.id and r.deleted_at is null
          )`
          : sql``
      }
    order by c.created_at desc
    limit ${limit}
    offset ${offset}
  `;

  const replyByParent = await fetchSellerRepliesForParents(rows.map((r) => r.id));

  let filteredTotal = total;
  if (filter === "needs_reply") filteredTotal = needsReplyCount;
  if (filter === "replied") filteredTotal = repliedCount;

  return {
    comments: rows.map((row) => ({
      ...row,
      seller_reply: replyByParent.get(String(row.id)) || null,
    })),
    page,
    limit,
    total: filteredTotal,
    stats: { total, needsReplyCount, repliedCount, responseRate },
  };
}

/**
 * @param {string} sellerId
 * @param {string} commentId
 * @param {unknown} body
 */
export async function upsertSellerCommentReply(sellerId, commentId, body) {
  const normalized = normalizeCommentBody(body);
  if (!normalized) throw new ReviewError("Reply cannot be empty", 400);

  const [parent] = await sql`
    select c.id, c.product_id, p.seller_id
    from marketplace_product_comments c
    join products p on p.id = c.product_id
    where c.id = ${commentId}
      and c.parent_id is null
      and c.deleted_at is null
    limit 1
  `;
  if (!parent) throw new ReviewError("Comment not found", 404);
  if (String(parent.seller_id) !== String(sellerId)) throw new ReviewError("Forbidden", 403);

  const [existing] = await sql`
    select id from marketplace_product_comments
    where parent_id = ${commentId}
      and user_id = ${sellerId}
      and deleted_at is null
    limit 1
  `;

  if (existing) {
    const [updated] = await sql`
      update marketplace_product_comments
      set body = ${normalized},
          updated_at = now()
      where id = ${existing.id}
      returning *
    `;
    return updated;
  }

  const [created] = await sql`
    insert into marketplace_product_comments (
      product_id,
      user_id,
      body,
      parent_id,
      created_at,
      updated_at
    ) values (
      ${parent.product_id},
      ${sellerId},
      ${normalized},
      ${commentId},
      now(),
      now()
    )
    returning *
  `;
  return created;
}

/** @param {string} commentId @param {string} adminUserId */
export async function adminDeleteProductComment(commentId, adminUserId) {
  const [row] = await sql`
    update marketplace_product_comments
    set deleted_at = now(),
        deleted_by = ${adminUserId},
        updated_at = now()
    where id = ${commentId}
      and deleted_at is null
    returning id
  `;
  if (!row) throw new ReviewError("Comment not found", 404);
  return { ok: true };
}

/** @param {{ limit?: number }} [opts] */
export async function listAdminProductComments(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 400);
  return sql`
    select
      c.*,
      p.name as user_name,
      pr.name as product_name
    from marketplace_product_comments c
    left join profiles p on p.id = c.user_id
    left join products pr on pr.id = c.product_id
    where c.parent_id is null
    order by c.created_at desc
    limit ${limit}
  `;
}
