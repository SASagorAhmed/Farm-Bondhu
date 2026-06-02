import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import {
  syncProfileFromDefaultAddress,
  validateAddressPayload,
} from "../../lib/bangladeshAddressValidate.js";

const router = Router();
const chain = [requireDatabase, requireUser];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get(
  "/",
  ...chain,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select *
      from user_addresses
      where user_id = ${req.userId}
      order by is_default desc, updated_at desc
    `;
    res.json({ data: rows });
  })
);

router.post(
  "/",
  ...chain,
  asyncHandler(async (req, res) => {
    const validated = validateAddressPayload(req.body || {});
    if (!validated.ok) {
      res.status(400).json({ error: validated.errors[0], errors: validated.errors });
      return;
    }
    const payload = validated.payload;
    const makeDefault = Boolean(req.body?.is_default);

    if (makeDefault) {
      await sql`update user_addresses set is_default = false where user_id = ${req.userId}`;
    }

    const existing = await sql`select id from user_addresses where user_id = ${req.userId} limit 1`;
    const isDefault = makeDefault || existing.length === 0;

    const [created] = await sql`
      insert into user_addresses ${sql({ ...payload, user_id: req.userId, is_default: isDefault })}
      returning *
    `;

    if (isDefault) {
      await syncProfileFromDefaultAddress(sql, req.userId);
    }

    res.status(201).json({ data: created });
  })
);

router.patch(
  "/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || "");
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: "Invalid address id" });
      return;
    }

    const [existing] = await sql`
      select * from user_addresses where id = ${id} and user_id = ${req.userId} limit 1
    `;
    if (!existing) {
      res.status(404).json({ error: "Address not found" });
      return;
    }

    const merged = { ...existing, ...req.body };
    const validated = validateAddressPayload(merged, { partial: true });
    if (!validated.ok) {
      res.status(400).json({ error: validated.errors[0], errors: validated.errors });
      return;
    }

    const patch = { ...validated.payload, updated_at: new Date().toISOString() };
    if (req.body?.is_default === true) {
      await sql`update user_addresses set is_default = false where user_id = ${req.userId}`;
      patch.is_default = true;
    }

    const [updated] = await sql`
      update user_addresses set ${sql(patch)} where id = ${id} and user_id = ${req.userId} returning *
    `;

    if (updated?.is_default) {
      await syncProfileFromDefaultAddress(sql, req.userId);
    }

    res.json({ data: updated });
  })
);

router.patch(
  "/:id/default",
  ...chain,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || "");
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: "Invalid address id" });
      return;
    }

    const [existing] = await sql`
      select id from user_addresses where id = ${id} and user_id = ${req.userId} limit 1
    `;
    if (!existing) {
      res.status(404).json({ error: "Address not found" });
      return;
    }

    await sql`update user_addresses set is_default = false where user_id = ${req.userId}`;
    const [updated] = await sql`
      update user_addresses
      set is_default = true, updated_at = now()
      where id = ${id} and user_id = ${req.userId}
      returning *
    `;

    await syncProfileFromDefaultAddress(sql, req.userId);
    res.json({ data: updated });
  })
);

router.delete(
  "/:id",
  ...chain,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || "");
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: "Invalid address id" });
      return;
    }

    const [existing] = await sql`
      select id, is_default from user_addresses where id = ${id} and user_id = ${req.userId} limit 1
    `;
    if (!existing) {
      res.status(404).json({ error: "Address not found" });
      return;
    }

    await sql`delete from user_addresses where id = ${id} and user_id = ${req.userId}`;

    if (existing.is_default) {
      const [next] = await sql`
        select id from user_addresses where user_id = ${req.userId} order by updated_at desc limit 1
      `;
      if (next) {
        await sql`update user_addresses set is_default = true where id = ${next.id}`;
        await syncProfileFromDefaultAddress(sql, req.userId);
      }
    }

    res.status(204).end();
  })
);

export default router;
