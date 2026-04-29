import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { buildUserBundle } from "../../services/userBundle.js";

const router = Router();
const nowMs = () => Number(process.hrtime.bigint() / 1000000n);

/** Full app user (profile + roles + capabilities) for the authenticated subject. */
router.get(
  "/",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const startedAt = nowMs();
    const user = await buildUserBundle(req.userId);
    if (!user) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const elapsed = Math.max(0, nowMs() - startedAt);
    res.setHeader("x-fb-me-ms", String(elapsed));
    res.json({ user });
  })
);

const profilePatchKeys = ["name", "phone", "location", "avatar_url", "primary_role"];

router.patch(
  "/",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const patch = {};
    const b = req.body || {};
    for (const k of profilePatchKeys) {
      if (b[k] !== undefined) patch[k] = b[k];
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No updatable fields" });
      return;
    }
    patch.updated_at = new Date().toISOString();
    const [row] = await sql`
      update profiles set ${sql(patch)} where id = ${req.userId} returning *
    `;
    const user = await buildUserBundle(req.userId);
    res.json({ profile: row, user });
  })
);

export default router;
