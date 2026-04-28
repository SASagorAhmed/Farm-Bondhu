import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";

const router = Router();
const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Public product lists */
router.get(
  "/chat/inbox",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = req.userId;
    const rows = await sql`
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
    `;
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
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    let rows;
    if (sellerName) {
      rows = await sql`
        select * from products where seller_name = ${sellerName}
        order by created_at desc limit ${limit}
      `;
    } else if (sellerId && typeof sellerId === "string") {
      rows = await sql`
        select * from products where seller_id = ${sellerId}
        order by created_at desc limit ${limit}
      `;
    } else {
      rows = await sql`
        select * from products order by created_at desc limit ${limit}
      `;
    }
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

    res.json({ data: { product, shop: shop || null } });
  })
);

router.get(
  "/products/:id",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const [row] = await sql`select * from products where id = ${req.params.id} limit 1`;
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
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
  "/products",
  ...sellerChain,
  asyncHandler(async (req, res) => {
    const b = { ...req.body, seller_id: req.userId };
    const [created] = await sql`
      insert into products ${sql(b)}
      returning *
    `;
    res.status(201).json({ data: created });
  })
);

router.patch(
  "/products/:id",
  ...sellerChain,
  asyncHandler(async (req, res) => {
    const [existing] = await sql`
      select seller_id from products where id = ${req.params.id} limit 1
    `;
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.seller_id !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const patch = { ...req.body };
    delete patch.seller_id;
    const [updated] = await sql`
      update products set ${sql(patch)} where id = ${req.params.id} returning *
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
