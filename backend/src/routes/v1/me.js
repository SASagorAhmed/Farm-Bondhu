import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { buildUserBundle } from "../../services/userBundle.js";
import { parseDataUrl, uploadToCloudinary } from "../../services/cloudinaryUpload.js";

const router = Router();
const nowMs = () => Number(process.hrtime.bigint() / 1000000n);
const CV_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/jpg"]);

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

const profilePatchKeys = ["name", "phone", "location", "avatar_url", "primary_role", "farmer_open_medibondhu"];

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

router.post(
  "/cv",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const fileData = String(req.body?.file_data || req.body?.fileData || "");
    const filename = String(req.body?.filename || "CV").trim().slice(0, 180) || "CV";
    const parsed = parseDataUrl(fileData);
    if (!parsed || !CV_MIME_TYPES.has(parsed.mime)) {
      res.status(400).json({ error: "Upload a PDF, PNG, JPG, or JPEG CV file" });
      return;
    }
    if (parsed.base64.length > 18_000_000) {
      res.status(413).json({ error: "CV file is too large. Please upload a smaller PDF or image." });
      return;
    }

    let cvUrl = fileData;
    try {
      const uploaded = await uploadToCloudinary(fileData, "community-cv", `cv_${req.userId}`);
      cvUrl = uploaded.url;
    } catch (error) {
      if (error?.status !== 503) throw error;
      // Local/dev fallback when Cloudinary is not configured. Production should configure Cloudinary.
      cvUrl = fileData;
    }

    const [profile] = await sql`
      update profiles
      set
        cv_url = ${cvUrl},
        cv_filename = ${filename},
        cv_mime_type = ${parsed.mime},
        cv_updated_at = now(),
        updated_at = now()
      where id = ${req.userId}
      returning *
    `;
    const user = await buildUserBundle(req.userId);
    res.json({ profile, user });
  })
);

router.delete(
  "/cv",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const [profile] = await sql`
      update profiles
      set
        cv_url = null,
        cv_filename = null,
        cv_mime_type = null,
        cv_updated_at = null,
        updated_at = now()
      where id = ${req.userId}
      returning *
    `;
    const user = await buildUserBundle(req.userId);
    res.json({ profile, user });
  })
);

export default router;
