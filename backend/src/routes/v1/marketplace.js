import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";

const router = Router();

/** Public product lists */
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
