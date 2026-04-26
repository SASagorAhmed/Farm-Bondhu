import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { assertFarmOwnedByUser } from "../../services/ownership.js";

const router = Router();

const patchKeys = [
  "farm_id",
  "type",
  "tracking_mode",
  "breed",
  "age",
  "health_status",
  "batch_id",
  "batch_size",
  "name",
  "last_vaccination",
];

router.get(
  "/",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select * from animals where user_id = ${req.userId} order by created_at asc
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
      select * from animals where id = ${req.params.id} and user_id = ${req.userId} limit 1
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
    const { farm_id, breed, age } = body;
    if (!farm_id || !breed || !age) {
      res.status(400).json({ error: "farm_id, breed, and age are required" });
      return;
    }
    await assertFarmOwnedByUser(farm_id, req.userId);

    const rowData = {
      user_id: req.userId,
      farm_id,
      type: body.type ?? "chicken",
      tracking_mode: body.tracking_mode ?? "batch",
      breed,
      age,
      health_status: body.health_status ?? "healthy",
      batch_id: body.batch_id ?? null,
      batch_size: body.batch_size ?? null,
      name: body.name ?? null,
      last_vaccination: body.last_vaccination ?? null,
    };

    const [row] = await sql`
      insert into animals ${sql(rowData)}
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
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }
    const [row] = await sql`
      update animals set ${sql(patch)}
      where id = ${id} and user_id = ${req.userId}
      returning *
    `;
    if (!row) {
      res.status(404).json({ error: "Animal not found" });
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
      delete from animals where id = ${id} and user_id = ${req.userId} returning id
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Animal not found" });
      return;
    }
    res.status(204).end();
  })
);

export default router;
