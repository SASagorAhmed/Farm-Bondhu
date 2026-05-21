import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireUser } from "../../middleware/requireUser.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { uploadToCloudinary } from "../../services/cloudinaryUpload.js";

const router = Router();

function toTextOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function normalizeHeadSide(v) {
  const s = String(v || "").toLowerCase();
  if (s === "left" || s === "head_left") return "left";
  if (s === "right" || s === "head_right") return "right";
  return null;
}

/** YOLO normalized line: class cx cy w h (0-1). */
function bboxToYoloLine(bbox, classId = 0) {
  if (!bbox || typeof bbox !== "object") return null;
  const x = Number(bbox.x);
  const y = Number(bbox.y);
  const w = Number(bbox.width);
  const h = Number(bbox.height);
  if (![x, y, w, h].every((n) => Number.isFinite(n) && n > 0)) return null;
  const cx = (x + w / 2);
  const cy = (y + h / 2);
  return `${classId} ${(cx).toFixed(6)} ${(cy).toFixed(6)} ${(w).toFixed(6)} ${(h).toFixed(6)}`;
}

router.post(
  "/detection-feedback",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const corrected = normalizeHeadSide(body.corrected_head_side);
    if (!corrected) {
      res.status(400).json({ error: "corrected_head_side must be left or right" });
      return;
    }

    let imageUrl = toTextOrNull(body.image_url);
    const fileData = body.file_data;
    if (fileData && typeof fileData === "string") {
      try {
        const uploaded = await uploadToCloudinary(fileData, "cow-feedback", `fb_${req.userId}`);
        imageUrl = uploaded?.url ?? imageUrl;
      } catch {
        /* optional image */
      }
    }

    const row = {
      user_id: req.userId,
      estimation_id: toTextOrNull(body.estimation_id),
      image_url: imageUrl,
      detection_mode: toTextOrNull(body.detection_mode) || "plan_b",
      predicted_head_side: normalizeHeadSide(body.predicted_head_side),
      predicted_facing: toTextOrNull(body.predicted_facing),
      predicted_head_bbox:
        body.predicted_head_bbox != null && typeof body.predicted_head_bbox === "object"
          ? sql.json(body.predicted_head_bbox)
          : null,
      corrected_head_side: corrected,
      corrected_head_bbox:
        body.corrected_head_bbox != null && typeof body.corrected_head_bbox === "object"
          ? sql.json(body.corrected_head_bbox)
          : null,
      local_model: toTextOrNull(body.local_model),
      vision_model: toTextOrNull(body.vision_model),
      annotation_json:
        body.annotation_json != null && typeof body.annotation_json === "object"
          ? sql.json(body.annotation_json)
          : null,
    };

    const [inserted] = await sql`
      insert into cow_detection_feedback ${sql(row)}
      returning id, created_at
    `;
    res.status(201).json({ data: inserted });
  })
);

router.get(
  "/detection-feedback/stats",
  requireDatabase,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [row] = await sql`
      select count(*)::int as total from cow_detection_feedback
    `;
    res.json({ data: { total: row?.total ?? 0 } });
  })
);

router.get(
  "/detection-feedback/export",
  requireDatabase,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const format = String(req.query.format || "yolo").toLowerCase();
    const rows = await sql`
      select id, image_url, corrected_head_side, annotation_json, created_at
      from cow_detection_feedback
      order by created_at desc
      limit 5000
    `;

    if (format === "jsonl") {
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Content-Disposition", 'attachment; filename="cow_detection_feedback.jsonl"');
      for (const r of rows) {
        res.write(`${JSON.stringify(r)}\n`);
      }
      res.end();
      return;
    }

    const items = rows.map((r) => {
      const ann = r.annotation_json || {};
      const bbox = ann.bbox;
      const imgW = Number(ann.imageWidth) || 1;
      const imgH = Number(ann.imageHeight) || 1;
      let headBbox = ann.headBbox || null;
      if (!headBbox && bbox && (r.corrected_head_side === "left" || r.corrected_head_side === "right")) {
        const frac = 0.18;
        headBbox =
          r.corrected_head_side === "left"
            ? { x: bbox.x, y: bbox.y, width: bbox.width * frac, height: bbox.height * 0.35 }
            : {
                x: bbox.x + bbox.width * (1 - frac),
                y: bbox.y,
                width: bbox.width * frac,
                height: bbox.height * 0.35,
              };
      }
      const cowLine = bbox
        ? bboxToYoloLine(
            {
              x: bbox.x / imgW,
              y: bbox.y / imgH,
              width: bbox.width / imgW,
              height: bbox.height / imgH,
            },
            0
          )
        : null;
      const headLine = headBbox
        ? bboxToYoloLine(
            {
              x: headBbox.x / imgW,
              y: headBbox.y / imgH,
              width: headBbox.width / imgW,
              height: headBbox.height / imgH,
            },
            1
          )
        : null;
      return {
        id: r.id,
        image_url: r.image_url,
        corrected_head_side: r.corrected_head_side,
        yolo_labels: [cowLine, headLine].filter(Boolean),
        created_at: r.created_at,
      };
    });

    res.json({
      data: {
        count: items.length,
        format: "yolo",
        readme: "Use backend/scripts/export-cow-detection-feedback.js for images/labels folders.",
        items,
      },
    });
  })
);

export default router;
