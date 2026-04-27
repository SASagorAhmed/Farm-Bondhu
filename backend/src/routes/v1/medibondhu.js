import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import {
  assertApprovedVetAccess,
  assertBookingParticipant,
  assertVetAccess,
  getBookingById,
  resolveVetUserId,
  userHasAnyRole,
} from "../../services/medibondhuAccess.js";

const router = Router();

/** @param {unknown} v */
function isUuid(v) {
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
}

/**
 * @param {string} hhmm
 */
function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/**
 * @param {number} mins
 */
function toTimeLabel(mins) {
  const h24 = Math.floor(mins / 60);
  const mm = mins % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${suffix}`;
}

/**
 * Accepts both "HH:mm" and "hh:mm AM/PM" and returns canonical "hh:mm AM/PM".
 * @param {unknown} value
 */
function normalizeSlotLabel(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.toLowerCase() === "now") return null;
  const h24 = toMinutes(raw);
  if (h24 != null) return toTimeLabel(h24);
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(raw);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const suffix = String(m[3]).toUpperCase();
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
  const hour24 = suffix === "PM" ? (hh % 12) + 12 : hh % 12;
  return toTimeLabel(hour24 * 60 + mm);
}

/**
 * @param {Record<string, unknown>} booking
 */
function normalizeBooking(booking) {
  return {
    ...booking,
    vet_user_id: booking.vet_user_id || booking.computed_vet_user_id || null,
  };
}

const BOOKING_STATUS = new Set(["pending", "confirmed", "in_progress", "completed", "cancelled"]);

function toTextOrNull(value) {
  const text = value == null ? "" : String(value).trim();
  return text ? text : null;
}

function toMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

async function computeVetEarningsSummary(vetUserId) {
  const [grossRow] = await sql`
    select
      coalesce(sum(coalesce(fee, 0)), 0) as gross_earnings,
      count(*)::int as consultation_count
    from consultation_bookings
    where vet_user_id = ${vetUserId}
      and status = 'completed'
  `;
  const [monthlyRow] = await sql`
    select
      coalesce(sum(coalesce(fee, 0)), 0) as monthly_gross
    from consultation_bookings
    where vet_user_id = ${vetUserId}
      and status = 'completed'
      and date_trunc('month', coalesce(completed_at, created_at)) = date_trunc('month', now())
  `;
  const [withdrawRow] = await sql`
    select
      coalesce(sum(case when status in ('approved', 'paid') then request_amount else 0 end), 0) as withdrawn_total,
      coalesce(sum(case when status = 'pending' then request_amount else 0 end), 0) as pending_withdraw_total
    from vet_withdrawals
    where vet_user_id = ${vetUserId}
  `;
  const gross = toMoney(grossRow?.gross_earnings || 0);
  const monthlyGross = toMoney(monthlyRow?.monthly_gross || 0);
  const platformFee = toMoney(gross * 0.15);
  const net = toMoney(gross - platformFee);
  const withdrawnTotal = toMoney(withdrawRow?.withdrawn_total || 0);
  const pendingWithdrawTotal = toMoney(withdrawRow?.pending_withdraw_total || 0);
  const availableBalance = toMoney(Math.max(0, net - withdrawnTotal - pendingWithdrawTotal));

  return {
    gross_earnings: gross,
    consultation_count: Number(grossRow?.consultation_count || 0),
    monthly_gross: monthlyGross,
    platform_fee_rate: 0.15,
    platform_fee: platformFee,
    net_earnings: net,
    withdrawn_total: withdrawnTotal,
    pending_withdraw_total: pendingWithdrawTotal,
    available_balance: availableBalance,
  };
}

async function createWithdrawalReviewNotification(vetUserId, requestId, status, reviewNote) {
  const title = status === "approved" ? "Withdrawal approved" : "Withdrawal rejected";
  const message = reviewNote
    ? `Your withdrawal request has been ${status}. Reason: ${reviewNote}`
    : `Your withdrawal request has been ${status}.`;
  await sql`
    insert into notifications ${sql({
      user_id: vetUserId,
      title,
      message,
      type: "vet_withdrawal_review",
      link: "/vet/earnings",
      created_at: new Date().toISOString(),
    })}
  `;
}

/**
 * @param {Record<string, unknown>} row
 */
function isVetProfileComplete(row) {
  return Boolean(
    toTextOrNull(row.full_name || row.name) &&
      toTextOrNull(row.phone) &&
      toTextOrNull(row.email) &&
      toTextOrNull(row.district || row.location) &&
      toTextOrNull(row.address || row.location) &&
      toTextOrNull(row.specialization) &&
      Number.isFinite(Number(row.experience_years ?? row.experience)) &&
      Number(row.experience_years ?? row.experience) >= 0 &&
      Number.isFinite(Number(row.consultation_fee ?? row.fee)) &&
      Number(row.consultation_fee ?? row.fee) >= 0 &&
      toTextOrNull(row.profile_image_url || row.avatar) &&
      toTextOrNull(row.verification_document_url)
  );
}

/**
 * @param {Record<string, unknown>} row
 */
function normalizeVetRow(row) {
  return {
    ...row,
    user_id: row.user_id || row.id || null,
    full_name: toTextOrNull(row.full_name) || toTextOrNull(row.name) || "Vet Doctor",
    name: toTextOrNull(row.name) || toTextOrNull(row.full_name) || "Vet Doctor",
    phone: toTextOrNull(row.phone) || null,
    email: toTextOrNull(row.email) || null,
    district: toTextOrNull(row.district) || toTextOrNull(row.location) || null,
    address: toTextOrNull(row.address) || toTextOrNull(row.location) || null,
    specialization: toTextOrNull(row.specialization) || "General Veterinary",
    animal_types: Array.isArray(row.animal_types) ? row.animal_types.map((v) => String(v).trim()).filter(Boolean) : [],
    experience: Number.isFinite(Number(row.experience_years))
      ? Number(row.experience_years)
      : Number.isFinite(Number(row.experience))
        ? Number(row.experience)
        : 0,
    experience_years: Number.isFinite(Number(row.experience_years))
      ? Number(row.experience_years)
      : Number.isFinite(Number(row.experience))
        ? Number(row.experience)
        : 0,
    fee: Number.isFinite(Number(row.fee)) ? Number(row.fee) : Number.isFinite(Number(row.consultation_fee)) ? Number(row.consultation_fee) : 500,
    consultation_fee: Number.isFinite(Number(row.consultation_fee))
      ? Number(row.consultation_fee)
      : Number.isFinite(Number(row.fee))
        ? Number(row.fee)
        : 500,
    location: toTextOrNull(row.location) || "Bangladesh",
    available: row.available == null ? true : Boolean(row.available),
    degree: toTextOrNull(row.degree) || "DVM",
    avatar: toTextOrNull(row.avatar) || toTextOrNull(row.profile_image_url) || "",
    profile_image_url: toTextOrNull(row.profile_image_url) || toTextOrNull(row.avatar) || "",
    verification_document_url: toTextOrNull(row.verification_document_url) || null,
    verification_status: toTextOrNull(row.verification_status) || "pending",
    rejection_reason: toTextOrNull(row.rejection_reason) || null,
    verified_by: row.verified_by || null,
    verified_at: row.verified_at || null,
    is_profile_complete: isVetProfileComplete(row),
  };
}

async function resolveCanonicalVetUserId(actorId) {
  const [profileByUser] = await sql`
    select user_id from vet_profiles
    where user_id = ${actorId}
    limit 1
  `;
  if (profileByUser?.user_id) return String(profileByUser.user_id);

  const [profileById] = await sql`
    select user_id, id from vet_profiles
    where id = ${actorId}
    limit 1
  `;
  if (profileById?.user_id) return String(profileById.user_id);
  if (profileById?.id) return String(profileById.id);

  const [vetByUser] = await sql`
    select user_id from vets
    where user_id = ${actorId}
    limit 1
  `;
  if (vetByUser?.user_id) return String(vetByUser.user_id);

  const [vetById] = await sql`
    select user_id, id from vets
    where id = ${actorId}
    limit 1
  `;
  if (vetById?.user_id) return String(vetById.user_id);
  if (vetById?.id) return String(vetById.id);

  return String(actorId);
}

async function getVetProfileRecordByActorId(actorId) {
  const canonicalUserId = await resolveCanonicalVetUserId(actorId);
  const [profileRow] = await sql`
    select * from vet_profiles
    where user_id = ${canonicalUserId}
    limit 1
  `;
  if (profileRow) return profileRow;
  const [vetRow] = await sql`
    select * from vets
    where user_id = ${canonicalUserId}
    limit 1
  `;
  return vetRow || null;
}

async function upsertVetProfileAndDirectory(userId, patch) {
  const canonicalUserId = await resolveCanonicalVetUserId(userId);
  const nowIso = new Date().toISOString();
  const [existingProfile] = await sql`
    select * from vet_profiles where user_id = ${canonicalUserId} limit 1
  `;
  const [legacyProfile] = existingProfile
    ? [null]
    : await sql`select * from vet_profiles where id = ${userId} limit 1`;
  const [existingVet] = await sql`
    select * from vets where user_id = ${canonicalUserId} limit 1
  `;
  const [legacyVet] = existingVet ? [null] : await sql`select * from vets where id = ${userId} limit 1`;
  const profileSource = existingProfile || legacyProfile;
  const vetSource = existingVet || legacyVet;
  const profilePatch = {
    user_id: canonicalUserId,
    full_name: patch.full_name ?? patch.name ?? profileSource?.full_name ?? vetSource?.full_name ?? vetSource?.name ?? null,
    phone: patch.phone ?? profileSource?.phone ?? vetSource?.phone ?? null,
    email: patch.email ?? profileSource?.email ?? vetSource?.email ?? null,
    district: patch.district ?? profileSource?.district ?? vetSource?.district ?? vetSource?.location ?? null,
    address: patch.address ?? profileSource?.address ?? vetSource?.address ?? vetSource?.location ?? null,
    specialization: patch.specialization ?? profileSource?.specialization ?? vetSource?.specialization ?? null,
    experience_years: patch.experience_years ?? patch.experience ?? profileSource?.experience_years ?? vetSource?.experience_years ?? vetSource?.experience ?? 0,
    consultation_fee: patch.consultation_fee ?? patch.fee ?? profileSource?.consultation_fee ?? vetSource?.consultation_fee ?? vetSource?.fee ?? 500,
    profile_image_url: patch.profile_image_url ?? patch.avatar ?? profileSource?.profile_image_url ?? vetSource?.profile_image_url ?? vetSource?.avatar ?? null,
    verification_document_url: patch.verification_document_url ?? profileSource?.verification_document_url ?? vetSource?.verification_document_url ?? null,
    verification_status: patch.verification_status ?? profileSource?.verification_status ?? vetSource?.verification_status ?? "pending",
    rejection_reason: patch.rejection_reason ?? null,
    verified_by: patch.verified_by ?? null,
    verified_at: patch.verified_at ?? null,
    updated_at: nowIso,
  };
  const [savedProfile] = profileSource
    ? await sql`
        update vet_profiles
        set ${sql(profilePatch)}
        where id = ${profileSource.id}
        returning *
      `
    : await sql`
        insert into vet_profiles ${sql({ id: canonicalUserId, ...profilePatch, created_at: nowIso })}
        returning *
      `;

  const vetPatch = {
    user_id: canonicalUserId,
    name: profilePatch.full_name,
    full_name: profilePatch.full_name,
    phone: profilePatch.phone,
    email: profilePatch.email,
    district: profilePatch.district,
    address: profilePatch.address,
    location: patch.location || vetSource?.location || profilePatch.district || profilePatch.address || "Bangladesh",
    specialization: profilePatch.specialization,
    experience: profilePatch.experience_years,
    experience_years: profilePatch.experience_years,
    fee: profilePatch.consultation_fee,
    consultation_fee: profilePatch.consultation_fee,
    avatar: profilePatch.profile_image_url || "",
    profile_image_url: profilePatch.profile_image_url || "",
    verification_document_url: profilePatch.verification_document_url,
    verification_status: profilePatch.verification_status,
    rejection_reason: profilePatch.rejection_reason,
    verified_by: profilePatch.verified_by,
    verified_at: profilePatch.verified_at,
    updated_at: nowIso,
  };
  await (vetSource
    ? sql`
        update vets
        set ${sql(vetPatch)}
        where id = ${vetSource.id}
      `
    : sql`
        insert into vets ${sql({ id: canonicalUserId, ...vetPatch, created_at: nowIso })}
      `);

  return savedProfile;
}

/**
 * Keep approval queue rows synchronized with vet verification lifecycle.
 * @param {string} userId
 * @param {"pending"|"approved"|"rejected"} status
 * @param {{ reviewedBy?: string | null; reviewNotes?: string | null; details?: Record<string, unknown> }} opts
 */
async function syncVetApprovalRequest(userId, status, opts = {}) {
  const [latest] = await sql`
    select id, details, payload
    from approval_requests
    where user_id = ${userId}
      and request_type = 'vet_verification'
    order by created_at desc
    limit 1
  `;
  const nowIso = new Date().toISOString();
  const normalizedNotes = toTextOrNull(opts.reviewNotes);
  const normalizedDetails = opts.details && typeof opts.details === "object" ? opts.details : {};
  const existingDetails =
    latest?.details && typeof latest.details === "object"
      ? latest.details
      : latest?.payload && typeof latest.payload === "object"
        ? latest.payload
        : {};
  const mergedDetails = { ...existingDetails, ...normalizedDetails };

  if (latest?.id) {
    const patch = {
      status,
      updated_at: nowIso,
      details: mergedDetails,
      payload: mergedDetails,
      notes: normalizedNotes ?? (status === "approved" ? "Approved by admin" : status === "rejected" ? "Rejected by admin" : null),
      review_notes: normalizedNotes ?? null,
      reviewed_by: opts.reviewedBy || null,
    };
    await sql`
      update approval_requests
      set ${sql(patch)}
      where id = ${latest.id}
    `;
    return;
  }

  const row = {
    user_id: userId,
    request_type: "vet_verification",
    status,
    details: mergedDetails,
    payload: mergedDetails,
    notes: normalizedNotes ?? null,
    review_notes: normalizedNotes ?? null,
    reviewed_by: opts.reviewedBy || null,
    created_at: nowIso,
    updated_at: nowIso,
  };
  await sql`insert into approval_requests ${sql(row)}`;
}

function parseDataUrl(input) {
  const raw = String(input || "");
  const m = /^data:([^;]+);base64,(.+)$/i.exec(raw);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

async function uploadToCloudinary(dataUrl, folder, publicIdPrefix = "file") {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  if (!cloudName || !apiKey || !apiSecret) {
    const err = new Error("Cloudinary is not configured on server");
    err.status = 503;
    throw err;
  }
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    const err = new Error("Invalid file payload");
    err.status = 400;
    throw err;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = Math.random().toString(36).slice(2, 10);
  const publicId = `${publicIdPrefix}_${timestamp}_${nonce}`;
  const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = (await import("node:crypto")).createHash("sha1").update(paramsToSign).digest("hex");
  const form = new FormData();
  form.append("file", dataUrl);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("resource_type", "auto");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.secure_url) {
    const err = new Error(String(body?.error?.message || "Cloudinary upload failed"));
    err.status = 502;
    throw err;
  }
  return {
    url: String(body.secure_url),
    publicId: String(body.public_id || ""),
  };
}

router.get(
  "/vets",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const availableOnly = String(req.query.available || "").toLowerCase() === "true";
    const isAdmin = await userHasAnyRole(req.userId, ["admin"]);
    const limit = Math.min(Number(req.query.limit) || 500, 1000);
    const rows = availableOnly
      ? await sql`
          select * from vets
          where coalesce(available, true) = true
            and (${isAdmin ? sql`true` : sql`coalesce(verification_status, 'pending') = 'approved'`})
          order by created_at desc
          limit ${limit}
        `
      : await sql`
          select * from vets
          where (${isAdmin ? sql`true` : sql`coalesce(verification_status, 'pending') = 'approved'`})
          order by created_at desc
          limit ${limit}
        `;
    res.json({ data: rows.map(normalizeVetRow) });
  })
);

router.get(
  "/vets/:id",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const isAdmin = await userHasAnyRole(req.userId, ["admin"]);
    const [row] = await sql`select * from vets where id = ${req.params.id} limit 1`;
    if (!row) {
      res.status(404).json({ error: "Vet not found" });
      return;
    }
    if (!isAdmin && String(row.verification_status || "pending") !== "approved") {
      res.status(404).json({ error: "Vet not found" });
      return;
    }
    res.json({ data: normalizeVetRow(row) });
  })
);

router.get(
  "/vet-profile/me",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    await assertVetAccess(req.userId);
    const vet = await getVetProfileRecordByActorId(req.userId);
    if (!vet) {
      res.status(404).json({ error: "Vet profile not found" });
      return;
    }
    const normalized = normalizeVetRow(vet);
    res.json({ data: normalized });
  })
);

router.put(
  "/vet-profile/me",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    await assertVetAccess(req.userId);
    const body = req.body || {};
    const fullName = toTextOrNull(body.full_name) || toTextOrNull(body.name);
    const phone = toTextOrNull(body.phone);
    const incomingEmail = toTextOrNull(body.email);
    const district = toTextOrNull(body.district);
    const address = toTextOrNull(body.address);
    const specialization = toTextOrNull(body.specialization);
    const experienceYears = Number(body.experience_years);
    const consultationFee = Number(body.consultation_fee);
    const profileImageUrl = toTextOrNull(body.profile_image_url);
    const verificationDocumentUrl = toTextOrNull(body.verification_document_url);

    if (!fullName || !phone || !district || !specialization) {
      res.status(400).json({ error: "full_name, phone, email, district and specialization are required" });
      return;
    }
    if (!Number.isFinite(experienceYears) || experienceYears < 0) {
      res.status(400).json({ error: "experience_years must be a non-negative number" });
      return;
    }
    if (!Number.isFinite(consultationFee) || consultationFee < 0) {
      res.status(400).json({ error: "consultation_fee must be a non-negative number" });
      return;
    }
    if (!profileImageUrl || !verificationDocumentUrl) {
      res.status(400).json({ error: "profile_image_url and verification_document_url are required" });
      return;
    }

    const [profile] = await sql`
      select id, location, email from profiles where id = ${req.userId} limit 1
    `;
    const email = toTextOrNull(profile?.email) || incomingEmail;
    if (!email) {
      res.status(400).json({ error: "Account email is required" });
      return;
    }
    const patch = {
      user_id: req.userId,
      name: fullName,
      full_name: fullName,
      phone,
      email,
      district,
      address,
      location: district || address || profile?.location || "Bangladesh",
      specialization,
      experience: Math.floor(experienceYears),
      experience_years: Math.floor(experienceYears),
      fee: consultationFee,
      consultation_fee: consultationFee,
      avatar: profileImageUrl,
      profile_image_url: profileImageUrl,
      verification_document_url: verificationDocumentUrl,
      verification_status: "pending",
      rejection_reason: null,
      verified_by: null,
      verified_at: null,
      updated_at: new Date().toISOString(),
    };
    const saved = await upsertVetProfileAndDirectory(req.userId, patch);
    await syncVetApprovalRequest(req.userId, "pending", {
      details: {
        profile_id: saved.id,
        specialization: saved.specialization || null,
        experience_years: saved.experience_years ?? saved.experience ?? 0,
        consultation_fee: saved.consultation_fee ?? saved.fee ?? 0,
        profile_image_url: saved.profile_image_url || null,
        verification_document_url: saved.verification_document_url || null,
      },
    });
    res.json({ data: normalizeVetRow(saved) });
  })
);

router.post(
  "/vet-profile/upload",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    await assertVetAccess(req.userId);
    const purpose = String(req.body?.purpose || "document").toLowerCase();
    const fileData = String(req.body?.file_data || "");
    if (!fileData) {
      res.status(400).json({ error: "file_data is required" });
      return;
    }
    const folder = purpose === "profile_image" ? "vet/profile" : "vet/document";
    const prefix = purpose === "profile_image" ? "profile" : "document";
    try {
      const uploaded = await uploadToCloudinary(fileData, folder, `vet_${prefix}_${req.userId}`);
      res.status(201).json({ data: uploaded });
      return;
    } catch (error) {
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("cloudinary is not configured")) {
        // Dev-safe fallback: keep profile updates working when cloud storage
        // credentials are not set in local environment.
        res.status(201).json({
          data: {
            url: fileData,
            publicId: "",
            storage: "inline_data_url",
          },
        });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/admin/vet-profiles",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const isAdmin = await userHasAnyRole(req.userId, ["admin"]);
    if (!isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const status = toTextOrNull(req.query.status);
    const rows = await sql`
      select
        vp.*,
        p.name as account_name,
        p.email as account_email
      from vet_profiles vp
      left join profiles p on p.id = vp.user_id
      where (${status ? sql`vp.verification_status = ${status}` : sql`true`})
      order by vp.created_at desc
    `;
    res.json({ data: rows.map(normalizeVetRow) });
  })
);

router.post(
  "/admin/vet-profiles/:id/approve",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const isAdmin = await userHasAnyRole(req.userId, ["admin"]);
    if (!isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const current = await getVetProfileRecordByActorId(req.params.id);
    if (!current) {
      res.status(404).json({ error: "Vet profile not found" });
      return;
    }
    const targetUserId = current.user_id || current.id;
    const updated = await upsertVetProfileAndDirectory(targetUserId, {
      verification_status: "approved",
      rejection_reason: null,
      verified_by: req.userId,
      verified_at: new Date().toISOString(),
    });
    if (!updated) {
      res.status(404).json({ error: "Vet profile not found" });
      return;
    }
    await sql`
      insert into user_capabilities ${sql({
        user_id: updated.user_id || updated.id,
        capability_code: "can_consult_as_vet",
        is_enabled: true,
        granted_by: req.userId,
      })}
      on conflict (user_id, capability_code) do update
      set is_enabled = true, granted_by = ${req.userId}
    `;
    await sql`
      insert into user_roles ${sql({
        user_id: updated.user_id || updated.id,
        role: "vet",
      })}
      on conflict (user_id, role) do nothing
    `;
    await sql`
      update profiles
      set ${sql({
        primary_role: "vet",
        updated_at: new Date().toISOString(),
      })}
      where id = ${updated.user_id || updated.id}
    `;
    await syncVetApprovalRequest(updated.user_id || updated.id, "approved", {
      reviewedBy: req.userId,
      reviewNotes: "Vet profile approved",
    });
    res.json({ data: normalizeVetRow(updated) });
  })
);

router.post(
  "/admin/vet-profiles/:id/reject",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const isAdmin = await userHasAnyRole(req.userId, ["admin"]);
    if (!isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const current = await getVetProfileRecordByActorId(req.params.id);
    if (!current) {
      res.status(404).json({ error: "Vet profile not found" });
      return;
    }
    const reason = toTextOrNull(req.body?.rejection_reason) || "Profile verification was rejected";
    const targetUserId = current.user_id || current.id;
    const updated = await upsertVetProfileAndDirectory(targetUserId, {
      verification_status: "rejected",
      rejection_reason: reason,
      verified_by: req.userId,
      verified_at: new Date().toISOString(),
    });
    if (!updated) {
      res.status(404).json({ error: "Vet profile not found" });
      return;
    }
    await sql`
      insert into user_capabilities ${sql({
        user_id: updated.user_id || updated.id,
        capability_code: "can_consult_as_vet",
        is_enabled: false,
        granted_by: req.userId,
      })}
      on conflict (user_id, capability_code) do update
      set is_enabled = false, granted_by = ${req.userId}
    `;
    await syncVetApprovalRequest(updated.user_id || updated.id, "rejected", {
      reviewedBy: req.userId,
      reviewNotes: reason,
    });
    res.json({ data: normalizeVetRow(updated) });
  })
);

router.get(
  "/vets/:id/available-slots",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || "").trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "date query is required (YYYY-MM-DD)" });
      return;
    }

    const [vet] = await sql`select id, user_id from vets where id = ${req.params.id} limit 1`;
    if (!vet) {
      res.status(404).json({ error: "Vet not found" });
      return;
    }
    const vetUserRef = vet.user_id || vet.id;

    const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
    const availability = await sql`
      select day_of_week, start_time, end_time, is_active
      from vet_availability
      where user_id = ${vetUserRef}
        and coalesce(is_active, true) = true
        and day_of_week = ${dayOfWeek}
      order by start_time asc
    `;

    const bookedRows = await sql`
      select scheduled_time
      from consultation_bookings
      where vet_mock_id = ${vet.id}
        and scheduled_date = ${date}
        and status in ('pending', 'confirmed', 'in_progress')
    `;
    const booked = new Set(bookedRows.map((r) => normalizeSlotLabel(r.scheduled_time)).filter(Boolean));

    const slots = [];
    for (const row of availability) {
      const start = toMinutes(String(row.start_time || ""));
      const end = toMinutes(String(row.end_time || ""));
      if (start == null || end == null || end <= start) continue;
      for (let m = start; m + 30 <= end; m += 30) {
        const label = toTimeLabel(m);
        if (!booked.has(label)) slots.push(label);
      }
    }

    const uniq = Array.from(new Set(slots));
    res.json({ data: uniq, meta: { day_of_week: dayOfWeek } });
  })
);

router.get(
  "/vet-earnings/summary",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    await assertVetAccess(req.userId);
    const summary = await computeVetEarningsSummary(req.userId);
    const historyLimit = Math.min(Math.max(Number(req.query.history_limit) || 30, 1), 100);
    const historyRows = await sql`
      select id, patient_name, fee, created_at, completed_at, animal_type
      from consultation_bookings
      where vet_user_id = ${req.userId}
        and status = 'completed'
      order by coalesce(completed_at, created_at) desc
      limit ${historyLimit}
    `;
    res.json({
      data: {
        ...summary,
        history: historyRows.map((r) => ({
          id: r.id,
          patient_name: toTextOrNull(r.patient_name) || "Patient",
          fee: toMoney(r.fee || 0),
          created_at: r.created_at,
          completed_at: r.completed_at,
          animal_type: r.animal_type || null,
        })),
      },
    });
  })
);

router.get(
  "/vet-withdrawals",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    await assertVetAccess(req.userId);
    const rows = await sql`
      select
        id,
        request_amount,
        gross_earnings,
        platform_fee,
        net_earnings,
        available_balance,
        status,
        note,
        review_note,
        reviewed_by,
        reviewed_at,
        paid_at,
        created_at,
        updated_at
      from vet_withdrawals
      where vet_user_id = ${req.userId}
      order by created_at desc
      limit 200
    `;
    res.json({ data: rows.map((r) => ({ ...r, request_amount: toMoney(r.request_amount || 0) })) });
  })
);

router.post(
  "/vet-withdrawals",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    await assertVetAccess(req.userId);
    const requestAmount = Number(req.body?.request_amount);
    const note = toTextOrNull(req.body?.note);
    if (!Number.isFinite(requestAmount) || requestAmount <= 0) {
      res.status(400).json({ error: "request_amount must be a positive number" });
      return;
    }
    const amount = toMoney(requestAmount);
    const summary = await computeVetEarningsSummary(req.userId);
    if (amount > summary.available_balance) {
      res.status(400).json({ error: "Requested amount exceeds available balance" });
      return;
    }
    const [created] = await sql`
      insert into vet_withdrawals ${sql({
        vet_user_id: req.userId,
        request_amount: amount,
        gross_earnings: summary.gross_earnings,
        platform_fee: summary.platform_fee,
        net_earnings: summary.net_earnings,
        available_balance: summary.available_balance,
        status: "pending",
        note,
        review_note: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })}
      returning *
    `;
    res.status(201).json({ data: created });
  })
);

router.get(
  "/admin/vet-withdrawals",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const isAdmin = await userHasAnyRole(req.userId, ["admin"]);
    if (!isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const status = toTextOrNull(req.query.status);
    const rows = await sql`
      select
        vw.*,
        p.name as vet_name,
        p.email as vet_email
      from vet_withdrawals vw
      left join profiles p on p.id = vw.vet_user_id
      where (${status ? sql`vw.status = ${status}` : sql`true`})
      order by vw.created_at desc
      limit 300
    `;
    res.json({ data: rows.map((r) => ({ ...r, request_amount: toMoney(r.request_amount || 0) })) });
  })
);

router.get(
  "/admin/vet-withdrawals/:id/details",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const isAdmin = await userHasAnyRole(req.userId, ["admin"]);
    if (!isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const [request] = await sql`
      select vw.*, p.name as vet_name, p.email as vet_email, p.phone as vet_phone, p.location as vet_location
      from vet_withdrawals vw
      left join profiles p on p.id = vw.vet_user_id
      where vw.id = ${req.params.id}
      limit 1
    `;
    if (!request) {
      res.status(404).json({ error: "Withdrawal request not found" });
      return;
    }
    const summary = await computeVetEarningsSummary(request.vet_user_id);
    const consultations = await sql`
      select id, patient_name, animal_type, fee, created_at, completed_at
      from consultation_bookings
      where vet_user_id = ${request.vet_user_id}
        and status = 'completed'
      order by coalesce(completed_at, created_at) desc
      limit 120
    `;
    const vetProfileBase = await getVetProfileRecordByActorId(request.vet_user_id);
    const [accountProfile] = await sql`select * from profiles where id = ${request.vet_user_id} limit 1`;
    const vetProfile = vetProfileBase
      ? {
          ...vetProfileBase,
          name: vetProfileBase.name || accountProfile?.name || request.vet_name,
          email: vetProfileBase.email || accountProfile?.email || request.vet_email,
          phone: vetProfileBase.phone || accountProfile?.phone || request.vet_phone,
          location: vetProfileBase.location || accountProfile?.location || request.vet_location,
        }
      : accountProfile || null;
    const requestHistory = await sql`
      select id, request_amount, status, note, review_note, created_at, reviewed_at
      from vet_withdrawals
      where vet_user_id = ${request.vet_user_id}
      order by created_at desc
      limit 30
    `;
    res.json({
      data: {
        request,
        summary,
        consultations: consultations.map((c) => ({ ...c, fee: toMoney(c.fee || 0) })),
        vet_profile: vetProfile ? normalizeVetRow(vetProfile) : null,
        request_history: requestHistory.map((r) => ({ ...r, request_amount: toMoney(r.request_amount || 0) })),
      },
    });
  })
);

router.post(
  "/admin/vet-withdrawals/:id/approve",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const isAdmin = await userHasAnyRole(req.userId, ["admin"]);
    if (!isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const [current] = await sql`select * from vet_withdrawals where id = ${req.params.id} limit 1`;
    if (!current) {
      res.status(404).json({ error: "Withdrawal request not found" });
      return;
    }
    if (String(current.status) !== "pending") {
      res.status(409).json({ error: "Only pending requests can be approved" });
      return;
    }
    const note = toTextOrNull(req.body?.note) || toTextOrNull(current.note);
    const [updated] = await sql`
      update vet_withdrawals
      set ${sql({
        status: "approved",
        review_note: note,
        reviewed_by: req.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })}
      where id = ${req.params.id}
      returning *
    `;
    await createWithdrawalReviewNotification(updated.vet_user_id, updated.id, "approved", updated.review_note);
    res.json({ data: updated });
  })
);

router.post(
  "/admin/vet-withdrawals/:id/reject",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const isAdmin = await userHasAnyRole(req.userId, ["admin"]);
    if (!isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const [current] = await sql`select * from vet_withdrawals where id = ${req.params.id} limit 1`;
    if (!current) {
      res.status(404).json({ error: "Withdrawal request not found" });
      return;
    }
    if (String(current.status) !== "pending") {
      res.status(409).json({ error: "Only pending requests can be rejected" });
      return;
    }
    const note = toTextOrNull(req.body?.note) || "Rejected by admin";
    const [updated] = await sql`
      update vet_withdrawals
      set ${sql({
        status: "rejected",
        review_note: note,
        reviewed_by: req.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })}
      where id = ${req.params.id}
      returning *
    `;
    await createWithdrawalReviewNotification(updated.vet_user_id, updated.id, "rejected", updated.review_note);
    res.json({ data: updated });
  })
);

router.get(
  "/bookings",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = req.userId;
    const isAdmin = await userHasAnyRole(uid, ["admin"]);
    const id = typeof req.query.id === "string" ? req.query.id : "";
    const patientId = typeof req.query.patient_mock_id === "string" ? req.query.patient_mock_id : "";
    const vetMockFilter = typeof req.query.vet_mock_id === "string" ? req.query.vet_mock_id : "";
    const vetUserFilter = typeof req.query.vet_user_id === "string" ? req.query.vet_user_id : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const statusIn =
      typeof req.query.status_in === "string"
        ? req.query.status_in
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const createdGte = typeof req.query.created_gte === "string" ? req.query.created_gte : "";
    const limit = Math.min(Number(req.query.limit) || 500, 1000);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const ascending = String(req.query.ascending || "").toLowerCase() === "true";

    if (id) {
      const row = isAdmin ? await getBookingById(id) : await assertBookingParticipant(id, uid);
      if (!row) {
        res.status(404).json({ error: "Consultation not found" });
        return;
      }
      res.json({ data: normalizeBooking(row) });
      return;
    }

    if (!isAdmin && patientId && patientId !== uid) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const sort = ascending ? sql`asc` : sql`desc`;
    const rows = await sql`
      select b.*, coalesce(b.vet_user_id, v.user_id, b.vet_mock_id) as computed_vet_user_id
      from consultation_bookings b
      left join vets v on v.id = b.vet_mock_id
      where (${patientId ? sql`b.patient_mock_id = ${patientId}` : sql`true`})
        and (${vetMockFilter ? sql`(coalesce(b.vet_user_id, v.user_id, b.vet_mock_id) = ${vetMockFilter} or b.vet_mock_id = ${vetMockFilter})` : sql`true`})
        and (${vetUserFilter ? sql`coalesce(b.vet_user_id, v.user_id, b.vet_mock_id) = ${vetUserFilter}` : sql`true`})
        and (${status ? sql`b.status = ${status}` : sql`true`})
        and (${statusIn.length ? sql`b.status in ${sql(statusIn)}` : sql`true`})
        and (${createdGte ? sql`b.created_at >= ${createdGte}` : sql`true`})
        and (${isAdmin ? sql`true` : sql`(b.patient_mock_id = ${uid} or coalesce(b.vet_user_id, v.user_id, b.vet_mock_id) = ${uid})`})
      order by b.created_at ${sort}
      offset ${offset}
      limit ${limit}
    `;
    res.json({ data: rows.map(normalizeBooking), meta: { limit, offset } });
  })
);

router.get(
  "/spent-summary",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = req.userId;
    const isAdmin = await userHasAnyRole(uid, ["admin"]);
    const patientIdQuery = toTextOrNull(req.query.patient_mock_id);
    const patientId = isAdmin && patientIdQuery ? patientIdQuery : uid;
    const status = toTextOrNull(req.query.status);
    const statusIn = String(req.query.status_in || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => BOOKING_STATUS.has(s));
    const [summary] = await sql`
      select
        coalesce(sum(coalesce(payment_amount, 0)), 0) as total_spent,
        count(*)::int as consultation_count
      from consultation_bookings
      where patient_mock_id = ${patientId}
        and (${status ? sql`status = ${status}` : sql`true`})
        and (${statusIn.length ? sql`status in ${sql(statusIn)}` : sql`true`})
    `;
    res.json({
      data: {
        patient_mock_id: patientId,
        total_spent: Number(summary?.total_spent || 0),
        consultation_count: Number(summary?.consultation_count || 0),
      },
    });
  })
);

router.get(
  "/bookings/:id",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const isAdmin = await userHasAnyRole(req.userId, ["admin"]);
    const row = isAdmin ? await getBookingById(req.params.id) : await assertBookingParticipant(req.params.id, req.userId);
    if (!row) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }
    res.json({ data: normalizeBooking(row) });
  })
);

router.post(
  "/bookings",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const vetMockId = typeof b.vet_mock_id === "string" ? b.vet_mock_id : "";
    if (!isUuid(vetMockId)) {
      res.status(400).json({ error: "vet_mock_id is required" });
      return;
    }
    const rawMethod = String(b.consultation_method || "").trim().toLowerCase();
    const method = rawMethod === "instant" || rawMethod === "scheduled" ? "chat" : rawMethod;
    if (!["video", "audio", "chat"].includes(method)) {
      res.status(400).json({ error: "consultation_method must be video, audio, or chat" });
      return;
    }
    const bookingType = String(b.booking_type || "instant").trim().toLowerCase();
    if (!["instant", "scheduled"].includes(bookingType)) {
      res.status(400).json({ error: "booking_type must be instant or scheduled" });
      return;
    }
    const animalType = toTextOrNull(b.animal_type);
    const symptoms = toTextOrNull(b.symptoms);
    if (!animalType || !symptoms) {
      res.status(400).json({ error: "animal_type and symptoms are required" });
      return;
    }
    const [vetRow] = await sql`select id, user_id from vets where id = ${vetMockId} limit 1`;
    if (!vetRow) {
      res.status(400).json({ error: "Invalid vet_mock_id" });
      return;
    }
    const resolvedVetUserId = vetRow.user_id || (await resolveVetUserId(vetMockId));
    const normalizedStatus = "pending";
    const scheduledDate = toTextOrNull(b.scheduled_date);
    const scheduledTime = toTextOrNull(b.scheduled_time);
    if (bookingType === "scheduled" && (!scheduledDate || !scheduledTime)) {
      res.status(400).json({ error: "scheduled_date and scheduled_time are required for scheduled booking" });
      return;
    }
    const scheduledAt =
      scheduledDate && scheduledTime && scheduledTime.toLowerCase() !== "now"
        ? new Date(`${scheduledDate} ${scheduledTime}`).toString() !== "Invalid Date"
          ? new Date(`${scheduledDate} ${scheduledTime}`).toISOString()
          : null
        : null;
    const row = {
      ...b,
      patient_mock_id: req.userId,
      vet_mock_id: vetMockId,
      consultation_method: method,
      booking_type: bookingType,
      animal_type: animalType,
      symptoms,
      vet_user_id: resolvedVetUserId || null,
      vet_id: resolvedVetUserId || null,
      status: normalizedStatus,
      scheduled_date: scheduledDate || new Date().toISOString().slice(0, 10),
      scheduled_time: scheduledTime || "Now",
      scheduled_at: scheduledAt,
    };
    const [created] = await sql`
      insert into consultation_bookings ${sql(row)}
      returning *
    `;
    res.status(201).json({ data: created });
  })
);

router.patch(
  "/bookings/:id",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = req.userId;
    const isAdmin = await userHasAnyRole(uid, ["admin"]);
    const current = isAdmin ? await getBookingById(req.params.id) : await assertBookingParticipant(req.params.id, uid);
    if (!current) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }
    const body = { ...(req.body || {}) };
    delete body.id;
    delete body.patient_mock_id;
    delete body.vet_user_id;
    delete body.vet_id;
    delete body.vet_mock_id;
    delete body.fee;
    delete body.payment_status;
    delete body.payment_amount;
    delete body.patient_name;
    delete body.vet_name;
    delete body.animal_type;
    delete body.animal_age;
    delete body.animal_gender;
    delete body.symptoms;
    delete body.consultation_method;
    delete body.booking_type;
    delete body.scheduled_date;
    delete body.scheduled_time;
    delete body.scheduled_at;

    const isVetParticipant = current.computed_vet_user_id === uid || current.vet_mock_id === uid;
    const isPatientParticipant = current.patient_mock_id === uid;
    if (!isAdmin && isVetParticipant) {
      // Active consultation lifecycle updates must work for assigned vet accounts,
      // even if profile approval metadata is temporarily out of sync.
      await assertVetAccess(uid);
    }
    const allowedForAdmin = new Set([
      "status",
      "leave_deadline_at",
      "left_user_id",
      "additional_notes",
      "notes",
      "meeting_link",
      "consultation_notes",
      "diagnosis",
      "treatment_plan",
      "updated_at",
    ]);
    const allowedForVet = new Set([
      "status",
      "leave_deadline_at",
      "left_user_id",
      "additional_notes",
      "notes",
      "meeting_link",
      "consultation_notes",
      "diagnosis",
      "treatment_plan",
    ]);
    const allowedForPatient = new Set(["status", "leave_deadline_at", "left_user_id", "additional_notes", "notes"]);
    const patch = {};
    const allowed = isAdmin ? allowedForAdmin : isVetParticipant ? allowedForVet : allowedForPatient;
    for (const [key, value] of Object.entries(body)) {
      if (allowed.has(key)) patch[key] = value;
    }

    if (patch.status) {
      const nextStatus = String(patch.status);
      const prevStatus = String(current.status || "");
      if (!BOOKING_STATUS.has(nextStatus)) {
        res.status(400).json({ error: "Invalid status value" });
        return;
      }
      if (nextStatus === prevStatus) {
        delete patch.status;
      } else {
        let ok = false;
        if (isAdmin) ok = true;
        else if (isVetParticipant) {
          ok =
            ((prevStatus === "pending" || prevStatus === "confirmed") && (nextStatus === "in_progress" || nextStatus === "cancelled")) ||
            (prevStatus === "in_progress" && (nextStatus === "completed" || nextStatus === "cancelled"));
        } else if (isPatientParticipant) {
          ok =
            ((prevStatus === "pending" || prevStatus === "confirmed" || prevStatus === "in_progress") &&
              nextStatus === "cancelled") ||
            (prevStatus === "in_progress" && nextStatus === "completed");
        }
        if (!ok) {
          res.status(403).json({ error: "Invalid status transition" });
          return;
        }
        if (nextStatus === "completed") patch.completed_at = new Date().toISOString();
      }
    }

    if (!Object.keys(patch).length) {
      res.json({ data: current || null });
      return;
    }

    const [updated] = await sql`
      update consultation_bookings
      set ${sql({ ...patch, updated_at: new Date().toISOString() })}
      where id = ${req.params.id}
      returning *
    `;
    res.json({ data: updated || null });
  })
);

router.get(
  "/bookings/:id/messages",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    await assertBookingParticipant(req.params.id, req.userId);
    const rows = await sql`
      select
        m.id,
        m.booking_id,
        m.sender_id,
        coalesce(m.sender_name, p.name) as sender_name,
        coalesce(m.message, m.body) as message,
        m.created_at
      from consultation_messages m
      left join profiles p on p.id = m.sender_id
      where m.booking_id = ${req.params.id}
      order by m.created_at asc
    `;
    res.json({ data: rows });
  })
);

router.post(
  "/bookings/:id/messages",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const booking = await assertBookingParticipant(req.params.id, req.userId);
    const bookingStatus = String(booking.status || "");
    if (bookingStatus === "completed" || bookingStatus === "cancelled") {
      res.status(409).json({ error: "Cannot send messages to terminal consultation" });
      return;
    }
    const b = req.body || {};
    const text = String(b.message || b.body || "").trim();
    if (!text) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    const [p] = await sql`select name from profiles where id = ${req.userId} limit 1`;
    const [created] = await sql`
      insert into consultation_messages ${sql({
        booking_id: req.params.id,
        sender_id: req.userId,
        sender_name: b.sender_name || p?.name || "User",
        message: text,
        body: text,
      })}
      returning *
    `;
    res.status(201).json({ data: created });
  })
);

router.get(
  "/availability",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const userId = typeof req.query.user_id === "string" && req.query.user_id ? req.query.user_id : req.userId;
    const rows = await sql`
      select * from vet_availability
      where user_id = ${userId}
      order by day_of_week asc nulls last, start_time asc, created_at asc
    `;
    res.json({ data: rows });
  })
);

router.post(
  "/availability/bulk",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    await assertApprovedVetAccess(req.userId);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    await sql`delete from vet_availability where user_id = ${req.userId}`;
    for (const r of rows) {
      await sql`
        insert into vet_availability ${sql({
          user_id: req.userId,
          day_of_week: r.day_of_week,
          day:
            Number.isInteger(r.day_of_week) && r.day_of_week >= 0 && r.day_of_week <= 6
              ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][r.day_of_week]
              : null,
          start_time: r.start_time,
          end_time: r.end_time,
          is_active: r.is_active ?? true,
        })}
      `;
    }
    res.json({ data: null });
  })
);

router.delete(
  "/availability/:id",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    await assertApprovedVetAccess(req.userId);
    await sql`delete from vet_availability where id = ${req.params.id} and user_id = ${req.userId}`;
    res.json({ data: null });
  })
);

router.delete(
  "/availability",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    await assertApprovedVetAccess(req.userId);
    await sql`delete from vet_availability where user_id = ${req.userId}`;
    res.json({ data: null });
  })
);

router.get(
  "/prescriptions",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = req.userId;
    const isAdmin = await userHasAnyRole(uid, ["admin"]);
    const id = typeof req.query.id === "string" ? req.query.id : "";
    if (id) {
      const [one] = await sql`select * from prescriptions where id = ${id} limit 1`;
      if (!one) {
        res.status(404).json({ error: "Prescription not found" });
        return;
      }
      if (!isAdmin && one.vet_user_id !== uid && one.farmer_user_id !== uid) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      res.json({ data: one });
      return;
    }

    const vetUserId = typeof req.query.vet_user_id === "string" ? req.query.vet_user_id : "";
    const farmerUserId = typeof req.query.farmer_user_id === "string" ? req.query.farmer_user_id : "";
    const limit = Math.min(Number(req.query.limit) || 500, 1000);
    const rows = await sql`
      select * from prescriptions
      where (${isAdmin ? sql`true` : sql`(vet_user_id = ${uid} or farmer_user_id = ${uid})`})
        and (${vetUserId ? sql`vet_user_id = ${vetUserId}` : sql`true`})
        and (${farmerUserId ? sql`farmer_user_id = ${farmerUserId}` : sql`true`})
      order by created_at desc
      limit ${limit}
    `;
    res.json({ data: rows });
  })
);

async function syncIssuedPrescriptionToEprescription(prescriptionRow) {
  if (!prescriptionRow?.farmer_user_id) return;
  const payload = {
    patient_mock_id: prescriptionRow.farmer_user_id,
    vet_id: prescriptionRow.vet_user_id,
    vet_name: prescriptionRow.vet_name,
    advice: prescriptionRow.care_instructions || prescriptionRow.diagnosis || prescriptionRow.notes || "",
    title: prescriptionRow.diagnosis || "Prescription",
    body: prescriptionRow.symptoms || "",
    status: "active",
    metadata: {
      prescription_id: prescriptionRow.id,
      consultation_id: prescriptionRow.consultation_id || null,
      language: prescriptionRow.language || "en",
    },
  };
  const [existingEp] = await sql`
    select id from e_prescriptions
    where patient_mock_id = ${prescriptionRow.farmer_user_id}
      and metadata->>'prescription_id' = ${prescriptionRow.id}
    limit 1
  `;
  if (existingEp?.id) {
    await sql`
      update e_prescriptions
      set ${sql({ ...payload, updated_at: new Date().toISOString() })}
      where id = ${existingEp.id}
    `;
  } else {
    await sql`
      insert into e_prescriptions ${sql(payload)}
    `;
  }
}

router.post(
  "/prescriptions",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    await assertApprovedVetAccess(req.userId);
    const b = req.body || {};
    const status = String(b.status || "draft").trim().toLowerCase();
    const language = String(b.language || "en").trim().toLowerCase();
    if (!["draft", "issued"].includes(status)) {
      res.status(400).json({ error: "status must be draft or issued" });
      return;
    }
    if (!["en", "bn"].includes(language)) {
      res.status(400).json({ error: "language must be en or bn" });
      return;
    }
    if (b.consultation_id && !isUuid(b.consultation_id)) {
      res.status(400).json({ error: "consultation_id must be a valid UUID" });
      return;
    }

    let consultation = null;
    if (b.consultation_id) {
      consultation = await getBookingById(b.consultation_id);
      if (!consultation) {
        res.status(400).json({ error: "consultation_id not found" });
        return;
      }
    }

    const farmerUserId = consultation?.patient_mock_id || b.farmer_user_id || null;
    if (farmerUserId && !isUuid(farmerUserId)) {
      res.status(400).json({ error: "farmer_user_id must be a valid UUID" });
      return;
    }
    const row = {
      ...b,
      vet_user_id: req.userId,
      vet_id: b.vet_id || req.userId,
      consultation_id: consultation?.id || b.consultation_id || null,
      farmer_user_id: farmerUserId,
      farmer_name: b.farmer_name || consultation?.patient_name || "Farmer",
      animal_type: b.animal_type || consultation?.animal_type || null,
      symptoms: b.symptoms || consultation?.symptoms || null,
      status,
      language,
      updated_at: new Date().toISOString(),
    };
    const [created] = await sql`
      insert into prescriptions ${sql(row)}
      returning *
    `;

    // Keep patient-facing list populated once issued.
    if (created?.status === "issued") {
      await syncIssuedPrescriptionToEprescription(created);
    }

    res.status(201).json({ data: created });
  })
);

router.post(
  "/prescriptions/:id/issue",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = req.userId;
    const isAdmin = await userHasAnyRole(uid, ["admin"]);
    const [row] = await sql`select * from prescriptions where id = ${req.params.id} limit 1`;
    if (!row) {
      res.status(404).json({ error: "Prescription not found" });
      return;
    }
    if (!isAdmin && row.vet_user_id !== uid) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (String(row.status || "").toLowerCase() === "issued") {
      res.json({ data: row });
      return;
    }
    if (String(row.status || "").toLowerCase() !== "draft") {
      res.status(409).json({ error: "Only draft prescriptions can be issued" });
      return;
    }
    const [updated] = await sql`
      update prescriptions
      set ${sql({
        status: "issued",
        updated_at: new Date().toISOString(),
      })}
      where id = ${req.params.id}
      returning *
    `;
    await syncIssuedPrescriptionToEprescription(updated);
    res.json({ data: updated });
  })
);

router.get(
  "/prescriptions/:id",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = req.userId;
    const isAdmin = await userHasAnyRole(uid, ["admin"]);
    const [row] = await sql`select * from prescriptions where id = ${req.params.id} limit 1`;
    if (!row) {
      res.status(404).json({ error: "Prescription not found" });
      return;
    }
    if (!isAdmin && row.vet_user_id !== uid && row.farmer_user_id !== uid) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json({ data: row });
  })
);

router.get(
  "/prescriptions/:id/items",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = req.userId;
    const isAdmin = await userHasAnyRole(uid, ["admin"]);
    const [parent] = await sql`select vet_user_id, farmer_user_id from prescriptions where id = ${req.params.id} limit 1`;
    if (!parent) {
      res.status(404).json({ error: "Prescription not found" });
      return;
    }
    if (!isAdmin && parent.vet_user_id !== uid && parent.farmer_user_id !== uid) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const rows = await sql`
      select * from prescription_items
      where prescription_id = ${req.params.id}
      order by created_at asc
    `;
    res.json({ data: rows });
  })
);

router.post(
  "/prescriptions/:id/items/bulk",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const [parent] = await sql`select vet_user_id from prescriptions where id = ${req.params.id} limit 1`;
    if (!parent) {
      res.status(404).json({ error: "Prescription not found" });
      return;
    }
    const isAdmin = await userHasAnyRole(req.userId, ["admin"]);
    if (!isAdmin) {
      await assertApprovedVetAccess(req.userId);
    }
    if (!isAdmin && parent.vet_user_id !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    for (const r of rows) {
      await sql`
        insert into prescription_items ${sql({
          ...r,
          prescription_id: req.params.id,
          label: r.label || r.medicine_name || null,
        })}
      `;
    }
    res.status(201).json({ data: null });
  })
);

router.get(
  "/e-prescriptions",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = req.userId;
    const isAdmin = await userHasAnyRole(uid, ["admin"]);
    const patientId = typeof req.query.patient_mock_id === "string" ? req.query.patient_mock_id : uid;
    if (!isAdmin && patientId !== uid) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const rows = await sql`
      select * from e_prescriptions
      where patient_mock_id = ${patientId}
      order by created_at desc
    `;
    res.json({ data: rows });
  })
);

export default router;
