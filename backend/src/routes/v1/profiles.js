import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";

const router = Router();

router.post(
  "/by-ids",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      res.json({ data: [] });
      return;
    }
    const rows = await sql`
      select id, name, primary_role, avatar_url from profiles where id in ${sql(ids)}
    `;
    res.json({ data: rows });
  })
);

router.get(
  "/:id",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const [row] = await sql`
      select id, name, primary_role, avatar_url from profiles where id = ${req.params.id} limit 1
    `;
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: row });
  })
);

export default router;
