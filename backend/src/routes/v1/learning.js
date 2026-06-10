import { Router } from "express";
import Busboy from "busboy";
import { v2 as cloudinary } from "cloudinary";
import { createWriteStream, mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { parseDataUrl, uploadToCloudinary } from "../../services/cloudinaryUpload.js";

const router = Router();
const UUID_RE = /^[0-9a-f-]{36}$/i;
const MAX_LEARNING_VIDEO_BYTES = 95 * 1024 * 1024;
const MAX_LEARNING_VIDEO_LABEL = "95 MB";
const authChain = [requireDatabase, requireUser];
const adminChain = [requireDatabase, requireUser, requireAdmin];

function bad(res, message, status = 400) {
  res.status(status).json({ error: message });
}

function getCloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

function uploadLargeVideoToCloudinary(filePath, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(filePath, options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      if (!result) {
        reject(new Error("Cloudinary did not return an upload result"));
        return;
      }
      resolve(result);
    });
  });
}

function parseMultipartVideo(req, { maxBytes = MAX_LEARNING_VIDEO_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers["content-type"] || "");
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      reject(Object.assign(new Error("Expected multipart/form-data video upload"), { status: 400 }));
      return;
    }

    let tempDir = "";
    let tempPath = "";
    let uploadBytes = 0;
    let sawFile = false;
    let resolved = false;
    let failed = false;
    const busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: maxBytes } });

    const cleanup = async () => {
      if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    };

    busboy.on("file", (_fieldName, file, info) => {
      if (resolved) {
        file.resume();
        return;
      }
      sawFile = true;
      const mimeType = String(info?.mimeType || "");
      if (!mimeType.startsWith("video/")) {
        file.resume();
        failed = true;
        reject(Object.assign(new Error("Please upload a valid video file"), { status: 400 }));
        return;
      }

      try {
        tempDir = mkdtempSync(path.join(os.tmpdir(), "farmbondhu-learning-video-"));
        const safeName = String(info?.filename || "video").replace(/[^a-z0-9_.-]/gi, "_");
        tempPath = path.join(tempDir, safeName);
        const out = createWriteStream(tempPath);
        file.on("data", (chunk) => {
          uploadBytes += chunk.length;
        });
        file.on("limit", () => {
          failed = true;
          out.destroy();
          reject(Object.assign(new Error(`Video is too large. Please upload a video under ${MAX_LEARNING_VIDEO_LABEL}.`), { status: 413 }));
        });
        out.on("error", (error) => {
          failed = true;
          reject(error);
        });
        out.on("finish", () => {
          if (failed) return;
          resolved = true;
          resolve({ tempDir, tempPath, filename: safeName, mimeType, size: uploadBytes, cleanup });
        });
        file.pipe(out);
      } catch (error) {
        failed = true;
        reject(error);
      }
    });

    busboy.on("error", (error) => {
      failed = true;
      reject(error);
    });
    busboy.on("finish", () => {
      if (!sawFile && !resolved && !failed) reject(Object.assign(new Error("No video file was uploaded"), { status: 400 }));
    });
    req.pipe(busboy);
  });
}

function isUuid(value) {
  return UUID_RE.test(String(value || ""));
}

function slugify(value) {
  const base = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `course-${Date.now()}`;
}

function coursePatch(body) {
  const patch = {};
  for (const key of [
    "title",
    "slug",
    "summary",
    "description",
    "category",
    "animal_type",
    "thumbnail_url",
    "access_type",
    "currency",
  ]) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (body.price !== undefined) patch.price = Number(body.price) || 0;
  if (body.is_published !== undefined) patch.is_published = Boolean(body.is_published);
  if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order) || 0;
  patch.updated_at = new Date().toISOString();
  if (!patch.slug && patch.title) patch.slug = slugify(patch.title);
  if (patch.access_type && !["free", "paid"].includes(String(patch.access_type))) {
    patch.access_type = "free";
  }
  return patch;
}

function videoPatch(body) {
  const patch = {};
  for (const key of ["course_id", "title", "description", "video_url", "cloudinary_public_id"]) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (body.duration_seconds !== undefined) patch.duration_seconds = Number(body.duration_seconds) || 0;
  if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order) || 0;
  if (body.is_preview !== undefined) patch.is_preview = Boolean(body.is_preview);
  if (body.is_published !== undefined) patch.is_published = Boolean(body.is_published);
  patch.updated_at = new Date().toISOString();
  return patch;
}

function paymentText(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function paymentStatusForEnrollment(status) {
  if (status === "active") return "approved";
  if (status === "cancelled" || status === "expired") return "rejected";
  return undefined;
}

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

router.get(
  "/admin/guides",
  ...adminChain,
  asyncHandler(async (_req, res) => {
    const rows = await sql`
      select *
      from learning_guides
      order by created_at desc
    `;
    res.json({ data: rows });
  })
);

router.post(
  "/admin/guides",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const row = {
      title: String(req.body?.title || "").trim(),
      summary: req.body?.summary || "",
      content: req.body?.content || "",
      category: req.body?.category || "disease",
      animal_type: req.body?.animal_type || "general",
      is_published: req.body?.is_published !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!row.title) return bad(res, "Title is required");
    const [created] = await sql`insert into learning_guides ${sql(row)} returning *`;
    res.status(201).json({ data: created });
  })
);

router.patch(
  "/admin/guides/:id",
  ...adminChain,
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res, "Invalid guide id");
    const patch = {
      updated_at: new Date().toISOString(),
    };
    for (const key of ["title", "summary", "content", "category", "animal_type", "is_published"]) {
      if (req.body?.[key] !== undefined) patch[key] = req.body[key];
    }
    const [updated] = await sql`update learning_guides set ${sql(patch)} where id = ${req.params.id} returning *`;
    if (!updated) return bad(res, "Guide not found", 404);
    res.json({ data: updated });
  })
);

router.delete(
  "/admin/guides/:id",
  ...adminChain,
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res, "Invalid guide id");
    await sql`delete from learning_guides where id = ${req.params.id}`;
    res.json({ data: null });
  })
);

router.get(
  "/courses",
  ...authChain,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select
        c.*,
        count(v.id)::int as video_count,
        e.status as enrollment_status,
        e.valid_until,
        e.access_source,
        (
          c.access_type = 'free'
          or ((e.status = 'active' or e.payment_status = 'approved') and (e.valid_until is null or e.valid_until > now()))
        ) as can_play
      from learning_courses c
      left join learning_course_videos v on v.course_id = c.id and v.is_published = true
      left join learning_course_enrollments e on e.course_id = c.id and e.user_id = ${req.userId}
      where c.is_published = true
      group by c.id, e.status, e.valid_until, e.access_source, e.payment_status
      order by c.sort_order asc, c.created_at desc
    `;
    res.json({ data: rows });
  })
);

router.get(
  "/courses/my",
  ...authChain,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select
        c.*,
        count(v.id)::int as video_count,
        e.status as enrollment_status,
        e.valid_until,
        e.access_source,
        true as can_play
      from learning_course_enrollments e
      join learning_courses c on c.id = e.course_id
      left join learning_course_videos v on v.course_id = c.id and v.is_published = true
      where e.user_id = ${req.userId}
        and (e.status = 'active' or e.payment_status = 'approved')
        and (e.valid_until is null or e.valid_until > now())
        and c.is_published = true
      group by c.id, e.status, e.valid_until, e.access_source, e.payment_status, e.updated_at, e.created_at
      order by coalesce(e.updated_at, e.created_at) desc
    `;
    res.json({ data: rows });
  })
);

router.get(
  "/courses/:id",
  ...authChain,
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res, "Invalid course id");
    const [course] = await sql`
      select
        c.*,
        e.status as enrollment_status,
        e.valid_until,
        e.access_source,
        (
          c.access_type = 'free'
          or ((e.status = 'active' or e.payment_status = 'approved') and (e.valid_until is null or e.valid_until > now()))
        ) as can_play
      from learning_courses c
      left join learning_course_enrollments e on e.course_id = c.id and e.user_id = ${req.userId}
      where c.id = ${req.params.id} and c.is_published = true
      limit 1
    `;
    if (!course) return bad(res, "Course not found", 404);
    const videos = await sql`
      select id, course_id, title, description, duration_seconds, sort_order, is_preview, is_published,
        case when ${Boolean(course.can_play)} or is_preview then video_url else null end as video_url
      from learning_course_videos
      where course_id = ${req.params.id} and is_published = true
      order by sort_order asc, created_at asc
    `;
    res.json({ data: { course, videos } });
  })
);

router.post(
  "/courses/:id/enroll-free",
  ...authChain,
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res, "Invalid course id");
    const [course] = await sql`
      select id, access_type from learning_courses
      where id = ${req.params.id} and is_published = true
      limit 1
    `;
    if (!course) return bad(res, "Course not found", 404);
    if (course.access_type !== "free") return bad(res, "This course requires admin-approved access", 403);
    const [row] = await sql`
      insert into learning_course_enrollments ${sql({
        course_id: req.params.id,
        user_id: req.userId,
        status: "active",
        access_source: "free",
        valid_until: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })}
      on conflict (course_id, user_id) do update set
        status = 'active',
        access_source = 'free',
        valid_until = null,
        updated_at = now()
      returning *
    `;
    res.status(201).json({ data: row });
  })
);

router.post(
  "/courses/:id/request-access",
  ...authChain,
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res, "Invalid course id");
    const [course] = await sql`
      select id, access_type, price, currency from learning_courses
      where id = ${req.params.id} and is_published = true
      limit 1
    `;
    if (!course) return bad(res, "Course not found", 404);
    if (course.access_type === "free") return bad(res, "Free courses can be started directly");
    const paymentMethod = paymentText(req.body?.payment_method, 40);
    const paymentReference = paymentText(req.body?.payment_reference, 80);
    const paymentSender = paymentText(req.body?.payment_sender, 80);
    const paymentNote = paymentText(req.body?.payment_note, 300);
    if (!paymentMethod) return bad(res, "Payment method is required");
    if (!paymentSender) return bad(res, "Sender number or account is required");
    const submittedAt = new Date().toISOString();
    const [row] = await sql`
      insert into learning_course_enrollments ${sql({
        course_id: req.params.id,
        user_id: req.userId,
        status: "active",
        access_source: "mock_payment",
        valid_until: null,
        payment_status: "approved",
        payment_method: paymentMethod,
        payment_reference: paymentReference || null,
        payment_sender: paymentSender,
        payment_amount: Number(course.price || 0),
        payment_currency: String(course.currency || "BDT"),
        payment_note: paymentNote || null,
        payment_submitted_at: submittedAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })}
      on conflict (course_id, user_id) do update set
        status = 'active',
        access_source = 'mock_payment',
        valid_until = null,
        payment_status = 'approved',
        payment_method = ${paymentMethod},
        payment_reference = ${paymentReference || null},
        payment_sender = ${paymentSender},
        payment_amount = ${Number(course.price || 0)},
        payment_currency = ${String(course.currency || "BDT")},
        payment_note = ${paymentNote || null},
        payment_submitted_at = ${submittedAt},
        updated_at = now()
      returning *
    `;
    res.status(201).json({ data: row });
  })
);

router.get(
  "/admin/courses",
  ...adminChain,
  asyncHandler(async (_req, res) => {
    const rows = await sql`
      select c.*, count(v.id)::int as video_count
      from learning_courses c
      left join learning_course_videos v on v.course_id = c.id
      group by c.id
      order by c.sort_order asc, c.created_at desc
    `;
    res.json({ data: rows });
  })
);

router.post(
  "/admin/courses",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const patch = coursePatch(req.body || {});
    if (!String(patch.title || "").trim()) return bad(res, "Course title is required");
    const [row] = await sql`
      insert into learning_courses ${sql({
        ...patch,
        author_id: req.userId,
        created_at: new Date().toISOString(),
      })}
      returning *
    `;
    res.status(201).json({ data: row });
  })
);

router.post(
  "/admin/courses/upload-thumbnail",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const fileData = String(req.body?.fileData || "");
    const parsed = parseDataUrl(fileData);
    const allowed = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
    if (!parsed || !allowed.has(String(parsed.mime || "").toLowerCase())) {
      return bad(res, "Please upload a PNG, JPG, JPEG, or WebP thumbnail image");
    }
    const uploaded = await uploadToCloudinary(fileData, "learning/thumbnails", `course_thumbnail_${req.userId}`);
    res.status(201).json({ data: { url: uploaded.url, publicId: uploaded.publicId } });
  })
);

router.patch(
  "/admin/courses/:id",
  ...adminChain,
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res, "Invalid course id");
    const patch = coursePatch(req.body || {});
    const [row] = await sql`update learning_courses set ${sql(patch)} where id = ${req.params.id} returning *`;
    if (!row) return bad(res, "Course not found", 404);
    res.json({ data: row });
  })
);

router.delete(
  "/admin/courses/:id",
  ...adminChain,
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res, "Invalid course id");
    await sql`delete from learning_course_enrollments where course_id = ${req.params.id}`;
    await sql`delete from learning_course_videos where course_id = ${req.params.id}`;
    await sql`delete from learning_courses where id = ${req.params.id}`;
    res.json({ data: null });
  })
);

router.get(
  "/admin/videos",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const courseId = String(req.query.course_id || "");
    const rows = isUuid(courseId)
      ? await sql`select * from learning_course_videos where course_id = ${courseId} order by sort_order asc, created_at asc`
      : await sql`select * from learning_course_videos order by created_at desc limit 500`;
    res.json({ data: rows });
  })
);

router.post(
  "/admin/videos",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const patch = videoPatch(req.body || {});
    if (!isUuid(patch.course_id)) return bad(res, "Course is required");
    if (!String(patch.title || "").trim()) return bad(res, "Video title is required");
    const [row] = await sql`
      insert into learning_course_videos ${sql({ ...patch, created_at: new Date().toISOString() })}
      returning *
    `;
    res.status(201).json({ data: row });
  })
);

router.patch(
  "/admin/videos/:id",
  ...adminChain,
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res, "Invalid video id");
    const patch = videoPatch(req.body || {});
    const [row] = await sql`update learning_course_videos set ${sql(patch)} where id = ${req.params.id} returning *`;
    if (!row) return bad(res, "Video not found", 404);
    res.json({ data: row });
  })
);

router.delete(
  "/admin/videos/:id",
  ...adminChain,
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res, "Invalid video id");
    await sql`delete from learning_course_videos where id = ${req.params.id}`;
    res.json({ data: null });
  })
);

router.post(
  "/admin/videos/reorder",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    for (const item of items) {
      if (!isUuid(item?.id)) continue;
      await sql`
        update learning_course_videos
        set sort_order = ${Number(item.sort_order) || 0}, updated_at = now()
        where id = ${item.id}
      `;
    }
    res.json({ data: null });
  })
);

router.post(
  "/admin/videos/upload-file",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const cfg = getCloudinaryConfig();
    if (!cfg) return bad(res, "Cloudinary is not configured on server", 503);

    let parsed;
    try {
      parsed = await parseMultipartVideo(req);
    } catch (error) {
      return bad(res, error instanceof Error ? error.message : "Video upload failed", error?.status || 400);
    }
    try {
      cloudinary.config({
        cloud_name: cfg.cloudName,
        api_key: cfg.apiKey,
        api_secret: cfg.apiSecret,
      });
      if (parsed.size > MAX_LEARNING_VIDEO_BYTES) {
        return bad(res, `Video is too large. Please upload a video under ${MAX_LEARNING_VIDEO_LABEL}.`, 413);
      }
      const timestamp = Math.floor(Date.now() / 1000);
      let uploaded;
      try {
        uploaded = await cloudinary.uploader.upload(parsed.tempPath, {
          resource_type: "video",
          folder: "learning/videos",
          public_id: `course_video_${req.userId}_${timestamp}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "");
        if (message.includes("104857600") || message.toLowerCase().includes("file size too large")) {
          return bad(res, `Cloudinary allows videos below 100 MB on this account. Please upload a video under ${MAX_LEARNING_VIDEO_LABEL}.`, 413);
        }
        throw error;
      }
      const url = String(uploaded.secure_url || uploaded.url || "");
      const publicId = String(uploaded.public_id || "");
      if (!url) {
        return bad(res, "Cloudinary upload completed but did not return a video URL", 502);
      }
      res.status(201).json({
        data: {
          url,
          publicId,
        },
      });
    } finally {
      await parsed.cleanup();
    }
  })
);

router.post(
  "/admin/videos/upload",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const fileData = String(req.body?.fileData || "");
    const parsed = parseDataUrl(fileData);
    if (!parsed || !String(parsed.mime || "").startsWith("video/")) {
      return bad(res, "Please upload a valid video file");
    }
    const uploaded = await uploadToCloudinary(fileData, "learning/videos", `course_video_${req.userId}`);
    res.status(201).json({ data: { url: uploaded.url, publicId: uploaded.publicId } });
  })
);

router.post(
  "/admin/videos/upload-signature",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
    const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
    const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
    if (!cloudName || !apiKey || !apiSecret) {
      return bad(res, "Cloudinary is not configured on server", 503);
    }
    const folder = "learning/videos";
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.random().toString(36).slice(2, 10);
    const publicId = `course_video_${req.userId}_${timestamp}_${nonce}`;
    const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = (await import("node:crypto")).createHash("sha1").update(paramsToSign).digest("hex");
    res.json({
      data: {
        cloudName,
        apiKey,
        timestamp,
        folder,
        publicId,
        signature,
      },
    });
  })
);

router.get(
  "/admin/enrollments",
  ...adminChain,
  asyncHandler(async (_req, res) => {
    const rows = await sql`
      select
        e.*,
        c.title as course_title,
        c.price as course_price,
        c.currency as course_currency,
        p.name as user_name,
        p.email as user_email,
        p.primary_role as user_role
      from learning_course_enrollments e
      join learning_courses c on c.id = e.course_id
      left join profiles p on p.id = e.user_id
      order by e.created_at desc
      limit 500
    `;
    res.json({ data: rows });
  })
);

router.post(
  "/admin/enrollments",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const courseId = req.body?.course_id;
    const userId = req.body?.user_id;
    if (!isUuid(courseId) || !isUuid(userId)) return bad(res, "Course and user are required");
    const [row] = await sql`
      insert into learning_course_enrollments ${sql({
        course_id: courseId,
        user_id: userId,
        status: String(req.body?.status || "active"),
        access_source: String(req.body?.access_source || "admin_grant"),
        valid_until: req.body?.valid_until || null,
        granted_by: req.userId,
        payment_status: String(req.body?.payment_status || "approved"),
        payment_amount: Number(req.body?.payment_amount || 0),
        payment_currency: String(req.body?.payment_currency || "BDT"),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })}
      on conflict (course_id, user_id) do update set
        status = excluded.status,
        access_source = excluded.access_source,
        valid_until = excluded.valid_until,
        granted_by = excluded.granted_by,
        payment_status = excluded.payment_status,
        payment_amount = excluded.payment_amount,
        payment_currency = excluded.payment_currency,
        updated_at = now()
      returning *
    `;
    res.status(201).json({ data: row });
  })
);

router.patch(
  "/admin/enrollments/:id",
  ...adminChain,
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res, "Invalid enrollment id");
    const patch = {
      updated_at: new Date().toISOString(),
    };
    if (req.body?.status !== undefined) patch.status = String(req.body.status);
    if (req.body?.valid_until !== undefined) patch.valid_until = req.body.valid_until || null;
    if (req.body?.access_source !== undefined) patch.access_source = String(req.body.access_source);
    const statusPayment = paymentStatusForEnrollment(String(req.body?.status || ""));
    if (statusPayment) patch.payment_status = statusPayment;
    if (req.body?.status === "active") patch.granted_by = req.userId;
    const [row] = await sql`update learning_course_enrollments set ${sql(patch)} where id = ${req.params.id} returning *`;
    if (!row) return bad(res, "Enrollment not found", 404);
    res.json({ data: row });
  })
);

export default router;
