import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";

const router = Router();

const patchKeys = ["name", "location", "type", "sheds", "total_animals"];

router.get(
  "/",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select * from farms where user_id = ${req.userId} order by created_at asc
    `;
    res.json({ data: rows });
  })
);

router.get(
  "/:id",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const [row] = await sql`
      select * from farms where id = ${req.params.id} and user_id = ${req.userId} limit 1
    `;
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: row });
  })
);

router.post(
  "/",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const { name, location, type, sheds, total_animals } = req.body || {};
    if (!name || !location || !type) {
      res.status(400).json({ error: "name, location, and type are required" });
      return;
    }
    const [row] = await sql`
      insert into farms ${sql({
        user_id: req.userId,
        name,
        location,
        type,
        sheds: sheds ?? 1,
        total_animals: total_animals ?? 0,
      })}
      returning *
    `;
    res.status(201).json({ data: row });
  })
);

router.patch(
  "/:id",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    const patch = {};
    for (const k of patchKeys) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: `Provide at least one of: ${patchKeys.join(", ")}` });
      return;
    }
    const [row] = await sql`
      update farms set ${sql(patch)}
      where id = ${id} and user_id = ${req.userId}
      returning *
    `;
    if (!row) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }
    res.json({ data: row });
  })
);

router.delete(
  "/:id",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await sql`
      delete from farms where id = ${id} and user_id = ${req.userId} returning id
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }
    res.status(204).end();
  })
);

export default router;
