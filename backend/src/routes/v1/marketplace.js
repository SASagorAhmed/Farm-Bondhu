import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { getOrSetCachedValue, invalidateByPrefix, makeCacheKey } from "../../services/responseCache.js";
import { uploadToCloudinary } from "../../services/cloudinaryUpload.js";
import { validateProductPayload } from "../../validators/product.js";
import { requestHasAnyRole } from "../../services/medibondhuAccess.js";

const router = Router();
const UUID_RE = /^[0-9a-f-]{36}$/i;
const nowMs = () => Number(process.hrtime.bigint() / 1000000n);
const MARKETPLACE_CACHE_PREFIX = "marketplace";

const PHARMACY_CATEGORIES = ["medicine", "vaccines", "supplements"];
const FARM_CATEGORIES = [
  "feed", "poultry feed", "cattle feed", "equipment", "pest control", "pest_control",
  "livestock", "eggs", "meat", "milk", "dairy", "produce", "organic", "grooming", "packaging",
];

function normalizeCategory(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveSortClause(sort) {
  switch (String(sort || "newest")) {
    case "price_asc":
      return sql`order by price asc nulls last, created_at desc`;
    case "price_desc":
      return sql`order by price desc nulls last, created_at desc`;
    case "rating":
      return sql`order by rating desc nulls last, created_at desc`;
    case "newest":
    default:
      return sql`order by created_at desc`;
  }
}

router.use((req, res, next) => {
  if (req.method === "GET") return next();
  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    if (req.userId) invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:${req.userId}|`);
    invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:anon|products`);
    invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:anon|product`);
  });
  next();
});

/** Public product lists */
router.get(
  "/chat/inbox",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const startedAt = nowMs();
    const uid = req.userId;
    const cacheKey = makeCacheKey(MARKETPLACE_CACHE_PREFIX, { userId: uid, parts: ["chat-inbox"] });
    const { value: rows, cacheHit } = await getOrSetCachedValue(cacheKey, 8_000, () => sql`
      select
        c.id,
        c.buyer_id,
        c.seller_id,
        c.product_id,
        coalesce(c.last_message, 'Started a conversation') as last_message,
        coalesce(c.last_message_at, c.created_at) as last_message_at,
        p.name as product_name,
        p.image as product_image,
        p.price as product_price,
        s.shop_name,
        op.name as other_name
      from conversations c
      left join products p on p.id = c.product_id
      left join shops s on s.user_id = c.seller_id
      left join profiles op on op.id = case when c.buyer_id = ${uid} then c.seller_id else c.buyer_id end
      where c.buyer_id = ${uid} or c.seller_id = ${uid}
      order by coalesce(c.last_message_at, c.created_at) desc nulls last
      limit 500
    `);
    res.setHeader("x-fb-cache", cacheHit ? "hit" : "miss");
    res.json({ data: rows });
  })
);

router.get(
  "/chat/seller/:sellerId/bootstrap",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const sellerId = String(req.params.sellerId || "");
    if (!UUID_RE.test(sellerId)) {
      res.status(400).json({ error: "Invalid seller id" });
      return;
    }
    if (req.userId !== sellerId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const cacheKey = makeCacheKey(MARKETPLACE_CACHE_PREFIX, { userId: sellerId, parts: ["seller-bootstrap"] });
    const { value: rows, cacheHit } = await getOrSetCachedValue(cacheKey, 10_000, () => sql`
      select
        c.id,
        c.buyer_id,
        c.seller_id,
        c.product_id,
        coalesce(c.last_message, 'New conversation') as last_message,
        coalesce(c.last_message_at, c.created_at) as last_message_at,
        bp.name as buyer_name,
        p.name as product_name,
        p.image as product_image,
        p.price as product_price
      from conversations c
      left join profiles bp on bp.id = c.buyer_id
      left join products p on p.id = c.product_id
      where c.seller_id = ${sellerId}
      order by coalesce(c.last_message_at, c.created_at) desc nulls last
      limit 300
    `);
    res.setHeader("Cache-Control", "private, max-age=10");
    res.setHeader("x-fb-seller-inbox-ms", String(Math.max(0, nowMs() - startedAt)));
    res.setHeader("x-fb-cache", cacheHit ? "hit" : "miss");
    res.json({ data: rows });
  })
);

router.get(
  "/chat/admin/bootstrap",
  requireDatabase,
  requireUser,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const startedAt = nowMs();
    const rows = await sql`
      select
        c.id,
        c.buyer_id,
        c.seller_id,
        c.product_id,
        coalesce(c.last_message, 'New conversation') as last_message,
        coalesce(c.last_message_at, c.created_at) as last_message_at,
        bp.name as buyer_name,
        sp.name as seller_name,
        p.name as product_name,
        p.image as product_image,
        p.price as product_price,
        p.category as product_category
      from conversations c
      left join profiles bp on bp.id = c.buyer_id
      left join profiles sp on sp.id = c.seller_id
      left join products p on p.id = c.product_id
      order by coalesce(c.last_message_at, c.created_at) desc nulls last
      limit 400
    `;
    res.setHeader("Cache-Control", "private, max-age=10");
    res.setHeader("x-fb-admin-inbox-ms", String(Math.max(0, nowMs() - startedAt)));
    res.json({ data: rows });
  })
);

router.get(
  "/chat/conversations/:id/bootstrap",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const convoId = String(req.params.id || "");
    if (!UUID_RE.test(convoId)) {
      res.status(400).json({ error: "Invalid conversation id" });
      return;
    }
    const uid = req.userId;
    const [conversation] = await sql`
      select *
      from conversations
      where id = ${convoId}
        and (buyer_id = ${uid} or seller_id = ${uid})
      limit 1
    `;
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const otherId = conversation.buyer_id === uid ? conversation.seller_id : conversation.buyer_id;
    const [[profile] = [], [shop] = [], [product] = [], messages] = await Promise.all([
      sql`select name from profiles where id = ${otherId} limit 1`,
      sql`select shop_name from shops where user_id = ${conversation.seller_id} limit 1`,
      conversation.product_id
        ? sql`select id, name, price, image, seller_name, location, rating, stock, category from products where id = ${conversation.product_id} limit 1`
        : Promise.resolve([]),
      sql`select * from chat_messages where conversation_id = ${convoId} order by created_at asc`,
    ]);

    const sharedIds = [...new Set((messages || []).map((m) => m.shared_product_id).filter(Boolean))];
    let sharedMap = new Map();
    if (sharedIds.length) {
      const sharedProducts = await sql`
        select id, name, price, image, seller_name, location, stock
        from products
        where id in ${sql(sharedIds)}
      `;
      sharedMap = new Map(sharedProducts.map((p) => [p.id, p]));
    }

    const enrichedMessages = (messages || []).map((m) => ({
      ...m,
      shared_product: m.shared_product_id ? sharedMap.get(m.shared_product_id) || null : null,
    }));

    res.json({
      data: {
        conversation: {
          id: conversation.id,
          buyer_id: conversation.buyer_id,
          seller_id: conversation.seller_id,
          product_id: conversation.product_id,
          product: product || null,
          other_name: profile?.name || "User",
          shop_name: shop?.shop_name || null,
        },
        messages: enrichedMessages,
      },
    });
  })
);

router.get(
  "/chat/share-products",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = req.userId;
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const rows = q
      ? await sql`
          select id, name, price, image, category, stock
          from products
          where seller_id = ${uid}
            and name ilike ${`%${q}%`}
          order by created_at desc
          limit ${limit}
        `
      : await sql`
          select id, name, price, image, category, stock
          from products
          where seller_id = ${uid}
          order by created_at desc
          limit ${limit}
        `;
    res.json({ data: rows });
  })
);

router.get(
  "/products",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const sellerName = req.query.seller_name;
    const sellerId = req.query.seller_id;
    const category = normalizeCategory(req.query.category);
    const lane = normalizeCategory(req.query.lane);
    const inStock = req.query.in_stock === "true";
    const sort = String(req.query.sort || "newest");
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const cacheKey = makeCacheKey(MARKETPLACE_CACHE_PREFIX, {
      userId: "anon",
      parts: ["products", sellerName || "", sellerId || "", category, lane, inStock ? "1" : "0", sort, limit],
    });
    const { value: rows, cacheHit } = await getOrSetCachedValue(cacheKey, 15_000, async () => {
      if (sellerName) {
        return sql`
          select * from products where seller_name = ${sellerName}
          ${resolveSortClause(sort)} limit ${limit}
        `;
      }
      if (sellerId && typeof sellerId === "string") {
        return sql`
          select * from products where seller_id = ${sellerId}
          ${resolveSortClause(sort)} limit ${limit}
        `;
      }

      const laneList =
        lane === "pharmacy" ? PHARMACY_CATEGORIES : lane === "farm" ? FARM_CATEGORIES : null;

      if (laneList && category) {
        return sql`
          select * from products
          where lower(trim(coalesce(category, ''))) in ${sql(laneList)}
            and lower(trim(coalesce(category, ''))) = ${category}
            ${inStock ? sql`and coalesce(stock, 0) > 0` : sql``}
          ${resolveSortClause(sort)} limit ${limit}
        `;
      }
      if (laneList) {
        return sql`
          select * from products
          where lower(trim(coalesce(category, ''))) in ${sql(laneList)}
            ${inStock ? sql`and coalesce(stock, 0) > 0` : sql``}
          ${resolveSortClause(sort)} limit ${limit}
        `;
      }
      if (category) {
        return sql`
          select * from products
          where lower(trim(coalesce(category, ''))) = ${category}
            ${inStock ? sql`and coalesce(stock, 0) > 0` : sql``}
          ${resolveSortClause(sort)} limit ${limit}
        `;
      }
      if (inStock) {
        return sql`
          select * from products
          where coalesce(stock, 0) > 0
          ${resolveSortClause(sort)} limit ${limit}
        `;
      }
      return sql`
        select * from products ${resolveSortClause(sort)} limit ${limit}
      `;
    });
    res.setHeader("Cache-Control", "public, s-maxage=45, max-age=20");
    res.setHeader("x-fb-cache", cacheHit ? "hit" : "miss");
    res.json({ data: rows });
  })
);

router.get(
  "/products/featured",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select * from products order by rating desc nulls last limit 4
    `;
    res.setHeader("Cache-Control", "public, s-maxage=60, max-age=30");
    res.json({ data: rows });
  })
);

router.get(
  "/products/:id/details",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const [product] = await sql`select * from products where id = ${req.params.id} limit 1`;
    if (!product) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const [shop] = await sql`
      select * from shops where user_id = ${product.seller_id} limit 1
    `;

    res.setHeader("Cache-Control", "public, s-maxage=45, max-age=20");
    res.json({ data: { product, shop: shop || null } });
  })
);

router.get(
  "/products/:id",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const cacheKey = makeCacheKey(MARKETPLACE_CACHE_PREFIX, {
      userId: "anon",
      parts: ["product", req.params.id],
    });
    const { value: row, cacheHit } = await getOrSetCachedValue(cacheKey, 20_000, async () => {
      const [data] = await sql`select * from products where id = ${req.params.id} limit 1`;
      return data || null;
    });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.setHeader("Cache-Control", "public, s-maxage=45, max-age=20");
    res.setHeader("x-fb-cache", cacheHit ? "hit" : "miss");
    res.json({ data: row });
  })
);

router.get(
  "/shops/by-user/:userId",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const [row] = await sql`
      select * from shops where user_id = ${req.params.userId} limit 1
    `;
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: row });
  })
);

const sellerChain = [requireDatabase, requireUser];

router.post(
  "/products/upload-image",
  ...sellerChain,
  asyncHandler(async (req, res) => {
    const fileData = String(req.body?.image || req.body?.file_data || "");
    if (!fileData) {
      res.status(400).json({ error: "image is required" });
      return;
    }
    try {
      const uploaded = await uploadToCloudinary(fileData, "marketplace/products", `product_${req.userId}`);
      res.status(201).json({ data: { url: uploaded.url } });
    } catch (error) {
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("cloudinary is not configured")) {
        res.status(201).json({ data: { url: fileData, storage: "inline_data_url" } });
        return;
      }
      throw error;
    }
  })
);

router.post(
  "/products",
  ...sellerChain,
  asyncHandler(async (req, res) => {
    const body = { ...req.body };
    delete body.seller_id;
    let validated;
    try {
      validated = validateProductPayload(body);
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message });
      return;
    }
    const isAdmin = await requestHasAnyRole(req, ["admin"]);
    if (!isAdmin) delete validated.is_verified_seller;
    const b = { ...validated, seller_id: req.userId };
    try {
      const [created] = await sql`
        insert into products ${sql(b)}
        returning *
      `;
      res.status(201).json({ data: created });
    } catch (error) {
      if (error?.code === "42703") {
        res.status(503).json({
          error: 'Database schema is outdated (missing product columns). From the backend folder run: npm run db:ensure',
        });
        return;
      }
      throw error;
    }
  })
);

router.patch(
  "/products/:id",
  ...sellerChain,
  asyncHandler(async (req, res) => {
    const [existing] = await sql`
      select * from products where id = ${req.params.id} limit 1
    `;
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.seller_id !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    let validated;
    try {
      const body = { ...req.body };
      delete body.seller_id;
      validated = validateProductPayload(body, { partial: true, existing });
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message });
      return;
    }
    if (!Object.keys(validated).length) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }
    const isAdmin = await requestHasAnyRole(req, ["admin"]);
    if (!isAdmin) delete validated.is_verified_seller;
    const [updated] = await sql`
      update products set ${sql(validated)}, updated_at = now() where id = ${req.params.id} returning *
    `;
    res.json({ data: updated });
  })
);

router.delete(
  "/products/:id",
  ...sellerChain,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      delete from products where id = ${req.params.id} and seller_id = ${req.userId} returning id
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  })
);

router.patch(
  "/shops/:userId",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    if (req.params.userId !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const patch = { ...req.body };
    delete patch.user_id;
    const [updated] = await sql`
      update shops set ${sql(patch)} where user_id = ${req.userId} returning *
    `;
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: updated });
  })
);

router.patch(
  "/admin/products/verify-seller",
  requireDatabase,
  requireUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { seller_user_id: sellerUserId, is_verified_seller: verified } = req.body || {};
    if (!sellerUserId || verified === undefined) {
      res.status(400).json({ error: "seller_user_id and is_verified_seller required" });
      return;
    }
    await sql`
      update products set is_verified_seller = ${verified} where seller_id = ${sellerUserId}
    `;
    res.status(204).end();
  })
);

export default router;
