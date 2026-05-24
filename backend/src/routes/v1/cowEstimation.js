import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { uploadToCloudinary } from "../../services/cloudinaryUpload.js";
import { assertFarmOwnedByUser } from "../../services/ownership.js";
import {
  estimateFromDimensions,
  validateDimensions,
} from "../../services/cowEstimationFormula.js";

const router = Router();

const DETECTION_MODES = new Set(["plan_b", "plan_c"]);
const INPUT_METHODS = new Set(["ai_assisted", "manual", "annotated", "ml"]);

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toTextOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function mapDbError(err) {
  const code = err?.code;
  if (code === "42P01") {
    const e = new Error(
      "cow_weight_estimations table missing — run: cd backend && npm run db:ensure"
    );
    e.status = 503;
    return e;
  }
  return err;
}

function defaultCowName(id) {
  return `Cow #${String(id).slice(0, 8)}`;
}

async function uploadCowImage(fileData, userId) {
  try {
    const uploaded = await uploadToCloudinary(fileData, "cow-estimation", `cow_${userId}`);
    return uploaded.url;
  } catch (e) {
    const status = Number(e?.status) || 502;
    if (status === 503) {
      console.warn("[cow-estimations] Cloudinary not configured — saving without image");
      return null;
    }
    throw e;
  }
}

router.get(
  "/",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    try {
      const rows = await sql`
        select id, user_id, farm_id, animal_id, image_url, cow_name, chest_width_cm, body_length_cm,
               estimated_live_weight_kg, edible_meat_kg, breakdown, detection_mode, input_method,
               confidence, created_at
        from cow_weight_estimations
        where user_id = ${req.userId}
        order by created_at desc
        limit 100
      `;
      res.json({ data: rows });
    } catch (err) {
      throw mapDbError(err);
    }
  })
);

router.get(
  "/:id",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    try {
      const [row] = await sql`
        select * from cow_weight_estimations
        where id = ${req.params.id} and user_id = ${req.userId}
        limit 1
      `;
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json({ data: row });
    } catch (err) {
      throw mapDbError(err);
    }
  })
);

router.post(
  "/",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const chestWidthCm = toNum(body.chest_width_cm);
    const bodyLengthCm = toNum(body.body_length_cm);
    const dimCheck = validateDimensions(chestWidthCm, bodyLengthCm);
    if (!dimCheck.ok) {
      res.status(400).json({ error: dimCheck.error });
      return;
    }

    const detectionMode = toTextOrNull(body.detection_mode) || "plan_b";
    if (!DETECTION_MODES.has(detectionMode)) {
      res.status(400).json({ error: "detection_mode must be plan_b or plan_c" });
      return;
    }

    const inputMethod = toTextOrNull(body.input_method) || "ai_assisted";
    if (!INPUT_METHODS.has(inputMethod)) {
      res.status(400).json({ error: "Invalid input_method" });
      return;
    }

    const farmId = toTextOrNull(body.farm_id);
    const animalId = toTextOrNull(body.animal_id);
    if (farmId) await assertFarmOwnedByUser(farmId, req.userId);
    if (animalId) {
      const [animal] = await sql`
        select id from animals where id = ${animalId} and user_id = ${req.userId} limit 1
      `;
      if (!animal) {
        res.status(404).json({ error: "Animal not found" });
        return;
      }
    }

    let imageUrl = toTextOrNull(body.image_url);
    const fileData = body.file_data;
    if (fileData && typeof fileData === "string") {
      try {
        imageUrl = await uploadCowImage(fileData, req.userId);
      } catch (e) {
        const status = Number(e?.status) || 502;
        res.status(status).json({ error: e.message || "Image upload failed" });
        return;
      }
    }

    const cowNameInput = toTextOrNull(body.cow_name);

    const estimates = estimateFromDimensions(chestWidthCm, bodyLengthCm);
    const confidence = toNum(body.confidence);
    const annotationJson =
      body.annotation_json != null && typeof body.annotation_json === "object"
        ? body.annotation_json
        : null;

    const rowData = {
      user_id: req.userId,
      farm_id: farmId,
      animal_id: animalId,
      image_url: imageUrl,
      cow_name: cowNameInput,
      chest_width_cm: chestWidthCm,
      body_length_cm: bodyLengthCm,
      estimated_live_weight_kg: estimates.estimated_live_weight_kg,
      edible_meat_kg: estimates.edible_meat_kg,
      breakdown: sql.json(estimates.breakdown),
      detection_mode: detectionMode,
      input_method: inputMethod,
      annotation_json: annotationJson != null ? sql.json(annotationJson) : null,
      confidence: confidence != null ? confidence : null,
      model_version: toTextOrNull(body.model_version) || "yolov8n-browser-v1",
    };

    try {
      const [inserted] = await sql`
        insert into cow_weight_estimations ${sql(rowData)}
        returning *
      `;
      let row = inserted;
      if (!toTextOrNull(row.cow_name)) {
        const [updated] = await sql`
          update cow_weight_estimations
          set cow_name = ${defaultCowName(row.id)}
          where id = ${row.id}
          returning *
        `;
        row = updated;
      }
      res.status(201).json({ data: row });
    } catch (err) {
      throw mapDbError(err);
    }
  })
);

export default router;
