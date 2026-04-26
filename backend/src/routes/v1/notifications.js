import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";

const router = Router();
const chain = [requireDatabase, requireUser];

router.get(
  "/",
  ...chain,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select * from notifications where user_id = ${req.userId} order by created_at desc
    `;
    res.json({ data: rows });
  })
);

router.get(
  "/unread-count",
  ...chain,
  asyncHandler(async (req, res) => {
    const [{ count }] = await sql`
      select count(*)::int as count from notifications
      where user_id = ${req.userId} and read = false
    `;
    res.json({ count: count ?? 0 });
  })
);

router.patch(
  "/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const patch = {};
    const b = req.body || {};
    if (b.read !== undefined) patch.read = b.read;
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "read field expected" });
      return;
    }
    const [row] = await sql`
      update notifications set ${sql(patch)}
      where id = ${req.params.id} and user_id = ${req.userId}
      returning *
    `;
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: row });
  })
);

router.post(
  "/mark-read",
  ...chain,
  asyncHandler(async (req, res) => {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      res.status(400).json({ error: "ids array required" });
      return;
    }
    await sql`
      update notifications set read = true
      where user_id = ${req.userId} and id in ${sql(ids)}
    `;
    res.status(204).end();
  })
);

export default router;
