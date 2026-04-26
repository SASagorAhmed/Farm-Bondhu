import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";

const router = Router();

/** Published guides — public read (no auth). */
router.get(
  "/guides",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select id, title, summary, content, category, animal_type
      from learning_guides
      where is_published = true
      order by created_at desc
    `;
    res.json({ data: rows });
  })
);

export default router;
