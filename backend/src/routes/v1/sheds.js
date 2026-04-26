import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { assertFarmOwnedByUser } from "../../services/ownership.js";

const router = Router();

const patchKeys = ["name", "capacity", "animal_type", "status", "current_count", "farm_id"];

router.get(
  "/",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select * from sheds where user_id = ${req.userId} order by created_at asc
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
      select * from sheds where id = ${req.params.id} and user_id = ${req.userId} limit 1
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
    const body = req.body || {};
    const { farm_id, name, capacity, animal_type, status } = body;
    if (!farm_id || !name) {
      res.status(400).json({ error: "farm_id and name are required" });
      return;
    }
    await assertFarmOwnedByUser(farm_id, req.userId);

    const [row] = await sql`
      insert into sheds ${sql({
        farm_id,
        user_id: req.userId,
        name,
        capacity: capacity ?? 100,
        animal_type: animal_type ?? "chicken",
        status: status ?? "active",
        current_count: body.current_count ?? 0,
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
    if (patch.farm_id) {
      await assertFarmOwnedByUser(patch.farm_id, req.userId);
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: `Provide at least one of: ${patchKeys.join(", ")}` });
      return;
    }
    const [row] = await sql`
      update sheds set ${sql(patch)}
      where id = ${id} and user_id = ${req.userId}
      returning *
    `;
    if (!row) {
      res.status(404).json({ error: "Shed not found" });
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
      delete from sheds where id = ${id} and user_id = ${req.userId} returning id
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Shed not found" });
      return;
    }
    res.status(204).end();
  })
);

export default router;
