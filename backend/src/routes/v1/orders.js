import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";

const router = Router();
const chain = [requireDatabase, requireUser];

router.get(
  "/",
  ...chain,
  asyncHandler(async (req, res) => {
    const adminRows = await sql`
      select 1 from user_roles where user_id = ${req.userId} and role = 'admin' limit 1
    `;
    const rows = adminRows.length
      ? await sql`select * from orders order by created_at desc limit 500`
      : await sql`
          select * from orders
          where buyer_id = ${req.userId} or seller_id = ${req.userId}
          order by created_at desc
        `;
    res.json({ data: rows });
  })
);

const insertKeys = [
  "buyer_name",
  "seller_id",
  "seller_name",
  "items",
  "total",
  "shipping_fee",
  "delivery_address",
  "payment_method",
  "payment_status",
  "timeline",
  "estimated_delivery",
  "status",
  "date",
  "return_reason",
  "return_note",
  "tracking_id",
];

router.post(
  "/",
  ...chain,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const row = { buyer_id: req.userId };
    for (const k of insertKeys) {
      if (b[k] !== undefined) row[k] = b[k];
    }
    if (!row.seller_id) {
      res.status(400).json({ error: "seller_id is required" });
      return;
    }
    const [created] = await sql`
      insert into orders ${sql(row)}
      returning *
    `;
    res.status(201).json({ data: created });
  })
);

const updateKeys = [
  "buyer_name",
  "seller_name",
  "items",
  "total",
  "shipping_fee",
  "delivery_address",
  "payment_method",
  "payment_status",
  "timeline",
  "estimated_delivery",
  "status",
  "date",
  "return_reason",
  "return_note",
  "tracking_id",
];

router.patch(
  "/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const patch = {};
    for (const k of updateKeys) {
      if (b[k] !== undefined) patch[k] = b[k];
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No updatable fields" });
      return;
    }
    const [existing] = await sql`
      select buyer_id, seller_id from orders where id = ${req.params.id} limit 1
    `;
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const adminRows = await sql`
      select 1 from user_roles where user_id = ${req.userId} and role = 'admin' limit 1
    `;
    const allowed =
      adminRows.length ||
      existing.buyer_id === req.userId ||
      existing.seller_id === req.userId;
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [updated] = await sql`
      update orders set ${sql(patch)} where id = ${req.params.id} returning *
    `;
    res.json({ data: updated });
  })
);

/** Admin-only: list many orders (same as GET with admin, kept for explicit client path). */
router.get(
  "/admin/all",
  requireDatabase,
  requireUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select * from orders order by created_at desc limit 500
    `;
    res.json({ data: rows });
  })
);

export default router;
