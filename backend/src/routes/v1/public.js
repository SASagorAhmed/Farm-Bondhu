import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";

const router = Router();

router.get(
  "/community-posts",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select * from community_posts where status = 'active' order by created_at desc limit 500
    `;
    res.setHeader("Cache-Control", "public, s-maxage=30, max-age=15");
    res.json({ data: rows });
  })
);

/** One post by id (e.g. share links) — no auth required. */
router.get(
  "/community-posts/:id",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const [row] = await sql`
      select * from community_posts where id = ${req.params.id} limit 1
    `;
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.setHeader("Cache-Control", "public, s-maxage=30, max-age=15");
    res.json({ data: row });
  })
);

export default router;
