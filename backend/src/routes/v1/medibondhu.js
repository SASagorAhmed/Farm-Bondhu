/**
 * MediBondhu API — human doctor appointments (tables: medibondhu_*).
 * Veterinary consultations use /v1/vetbondhu only.
 */
import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { getRequestRoleSet, requestHasAnyRole } from "../../services/medibondhuAccess.js";
import { getOrSetCachedValue, invalidateByPrefix, makeCacheKey } from "../../services/responseCache.js";
import { uploadToCloudinary } from "../../services/cloudinaryUpload.js";

const router = Router();
const CACHE_PREFIX = "medibondhu_human";

router.use(requireDatabase);

router.use((req, res, next) => {
  if (req.method === "GET") return next();
  res.on("finish", () => {
    if (res.statusCode >= 400 || !req.userId) return;
    invalidateByPrefix(`${CACHE_PREFIX}|u:${req.userId}|`);
  });
  next();
});

function readLimit(v, fb = 50, mx = 200) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fb;
  return Math.min(Math.max(Math.trunc(n), 1), mx);
}

function readOffset(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(Math.trunc(n), 0);
}

function toTextOrNull(value) {
  const text = value == null ? "" : String(value).trim();
  return text ? text : null;
}

function toMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

/** @param {unknown} u */
function isUuid(u) {
  return typeof u === "string" && /^[0-9a-f-]{36}$/i.test(u);
}

const VERIFICATION_DOC_TYPES = new Set([
  "medical_degree",
  "registration_certificate",
  "cv",
  "national_id",
  "other",
]);

/** @param {unknown} raw */
function normalizeVerificationDocuments(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.filter(
    (x) => x && typeof x === "object" && typeof /** @type {{ type?: unknown }} */ (x).type === "string" && typeof /** @type {{ url?: unknown }} */ (x).url === "string",
  );
}

async function doctorMayApplyMediProfile(req) {
  return (
    (await requestHasAnyRole(req, ["admin"])) ||
    (await requestHasAnyRole(req, ["doctor"])) ||
    (await requestHasAnyRole(req, ["vet"]))
  );
}

async function isAdminReq(req) {
  return await requestHasAnyRole(req, ["admin"]);
}

async function isDoctorApprovedUser(userId) {
  const [row] = await sql`
    select id from medibondhu_doctors
    where user_id = ${userId} and approval_status = 'approved'
    limit 1
  `;
  return row?.id ? String(row.id) : null;
}

async function computeDoctorEarningsSummary(doctorUserId) {
  const [grossRow] = await sql`
    select
      coalesce(sum(coalesce(d.consultation_fee, 0)), 0) as gross_earnings,
      count(*)::int as consultation_count
    from medibondhu_appointments a
    join medibondhu_doctors d on d.id = a.doctor_id
    where d.user_id = ${doctorUserId}
      and a.status = 'completed'
  `;
  const [monthlyRow] = await sql`
    select
      coalesce(sum(coalesce(d.consultation_fee, 0)), 0) as monthly_gross
    from medibondhu_appointments a
    join medibondhu_doctors d on d.id = a.doctor_id
    where d.user_id = ${doctorUserId}
      and a.status = 'completed'
      and date_trunc('month', a.updated_at) = date_trunc('month', now())
  `;
  let withdrawRow = null;
  try {
    [withdrawRow] = await sql`
      select
        coalesce(sum(case when status in ('approved', 'paid') then request_amount else 0 end), 0) as withdrawn_total,
        coalesce(sum(case when status = 'pending' then request_amount else 0 end), 0) as pending_withdraw_total
      from medibondhu_doctor_withdrawals
      where doctor_user_id = ${doctorUserId}
    `;
  } catch (e) {
    const code = /** @type {{ code?: string }} */ (e)?.code;
    if (code !== "42P01") throw e;
    withdrawRow = { withdrawn_total: 0, pending_withdraw_total: 0 };
  }
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

async function createDoctorWithdrawalReviewNotification(doctorUserId, requestId, status, reviewNote) {
  const title = status === "approved" ? "Doctor withdrawal approved" : "Doctor withdrawal rejected";
  const message = reviewNote
    ? `Your doctor withdrawal request has been ${status}. Reason: ${reviewNote}`
    : `Your doctor withdrawal request has been ${status}.`;
  await sql`
    insert into notifications ${sql({
      user_id: doctorUserId,
      title,
      message,
      type: "medibondhu_doctor_withdrawal_review",
      link: "/medibondhu/doctor/earnings",
      created_at: new Date().toISOString(),
    })}
  `;
}

async function hasMediDoctorWithdrawalsTable() {
  const [row] = await sql`select to_regclass('public.medibondhu_doctor_withdrawals') as table_name`;
  return Boolean(row?.table_name);
}

/** Calendar YYYY-MM-DD in Asia/Dhaka for an instant — must match MediBondhu patient booking date picker. */
function slotDateYmdBangladeshFromUtcMs(utcMs) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(utcMs));
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return new Date(utcMs).toISOString().slice(0, 10);
  return `${y}-${m}-${d}`;
}

const MEDI_HUMAN_ZEGO_PREFIX = "medi-human-";

/** @param {string} apptId */
function mediHumanZegoRoomId(apptId) {
  return `${MEDI_HUMAN_ZEGO_PREFIX}${apptId}`;
}

/** @param {unknown} status */
function terminalMediAppointmentStatus(status) {
  const s = String(status || "").toLowerCase();
  return s === "completed" || s === "cancelled" || s === "rejected";
}

/**
 * Allow joining / starting a few minutes before slot start and after slot end (grace).
 * @param {Date|string|null|undefined} slotStart
 * @param {Date|string|null|undefined} slotEnd
 * @param {number} [nowMs]
 */
function isWithinMediTeleconsultWindow(slotStart, slotEnd, nowMs = Date.now()) {
  if (!slotStart) return true;
  const startMs = new Date(slotStart).getTime();
  if (!Number.isFinite(startMs)) return true;
  const endParsed = slotEnd ? new Date(slotEnd).getTime() : NaN;
  const endMs = Number.isFinite(endParsed) ? endParsed : startMs + 60 * 60 * 1000;
  const beforeMs = 15 * 60 * 1000;
  const afterGraceMs = 120 * 60 * 1000;
  return nowMs >= startMs - beforeMs && nowMs <= endMs + afterGraceMs;
}

// ─── Public-ish (auth optional for directory) — still require logged user for MVP safety
router.get(
  "/hospitals",
  requireUser,
  asyncHandler(async (_req, res) => {
    const rows = await sql`
      select id, name, address, phone from medibondhu_hospitals order by name asc limit 200
    `;
    res.json({ data: rows });
  })
);

router.get(
  "/specialties",
  requireUser,
  asyncHandler(async (_req, res) => {
    const rows = await sql`
      select id, name, slug, sort_order
      from medibondhu_specialties
      where is_active = true
      order by sort_order asc, name asc
    `;
    res.json({ data: rows });
  })
);

// Product note: discrete availability slots remain; online bookings use pending→in_progress for Vet-like accept flow.
router.get(
  "/doctors",
  requireUser,
  asyncHandler(async (req, res) => {
    const limit = readLimit(req.query.limit, 40);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const specialtyId =
      typeof req.query.specialty_id === "string" && isUuid(req.query.specialty_id) ? req.query.specialty_id : null;
    const specFrag = specialtyId ? sql`and d.specialty_id = ${specialtyId}::uuid` : sql``;
    const qPat = q ? `%${q}%` : null;
    const searchFrag =
      qPat == null
        ? sql``
        : sql`and (
            d.full_name ilike ${qPat}
            or coalesce(d.qualification,'') ilike ${qPat}
            or coalesce(s.name,'') ilike ${qPat}
          )`;

    const rows = await sql`
      select d.id,
        d.full_name,
        d.qualification,
        d.experience_years,
        d.consultation_fee,
        d.profile_photo_url,
        d.about,
        d.online_consultation,
        d.chamber_consultation,
        d.rating_avg,
        d.specialty_id,
        d.is_available,
        s.name as specialty_name,
        coalesce(h.name, '') as hospital_name,
        coalesce(h.address, '') as hospital_address,
        coalesce(d.chamber_address,'') as chamber_address,
        exists (
          select 1 from medibondhu_doctor_time_slots ts
          where ts.doctor_id = d.id
            and ts.slot_end > now()
        ) as has_open_slots
      from medibondhu_doctors d
      left join medibondhu_specialties s on s.id = d.specialty_id
      left join medibondhu_hospitals h on h.id = d.hospital_id
      where d.approval_status = 'approved' and d.is_available = true
      ${specFrag}
      ${searchFrag}
      order by d.rating_avg desc nulls last, d.full_name asc
      limit ${limit}
    `;
    res.json({ data: rows });
  })
);

router.get(
  "/doctors/:id",
  requireUser,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || "");
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid doctor id" });
    const [row] = await sql`
      select d.id,
        d.full_name,
        d.qualification,
        d.experience_years,
        d.consultation_fee,
        d.profile_photo_url,
        d.about,
        d.online_consultation,
        d.chamber_consultation,
        d.rating_avg,
        d.rating_count,
        d.specialty_id,
        d.hospital_id,
        d.chamber_address,
        d.medical_reg_number,
        d.registration_body,
        d.is_available,
        s.name as specialty_name,
        h.name as hospital_name,
        h.address as hospital_address,
        exists (
          select 1 from medibondhu_doctor_time_slots ts
          where ts.doctor_id = d.id
            and ts.slot_end > now()
        ) as has_open_slots
      from medibondhu_doctors d
      left join medibondhu_specialties s on s.id = d.specialty_id
      left join medibondhu_hospitals h on h.id = d.hospital_id
      where d.id = ${id}::uuid and d.approval_status = 'approved'
      limit 1
    `;
    if (!row) return res.status(404).json({ error: "Doctor not found" });
    res.json({ data: row });
  })
);

router.get(
  "/doctors/:id/slots",
  requireUser,
  asyncHandler(async (req, res) => {
    const doctorId = String(req.params.id || "");
    const dateRaw = typeof req.query.date === "string" ? req.query.date.trim() : "";
    if (!isUuid(doctorId)) return res.status(400).json({ error: "Invalid doctor id" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return res.status(400).json({ error: "date required (YYYY-MM-DD)" });

    /** BD calendar day from `slot_start`; bookable until window end (aligned with `has_open_slots`). */
    const rows = await sql`
      select id, doctor_id, slot_date, slot_start, slot_end, booked
      from medibondhu_doctor_time_slots
      where doctor_id = ${doctorId}::uuid
        and ((slot_start at time zone 'Asia/Dhaka')::date = ${dateRaw}::date)
        and slot_end > now()
      order by slot_start asc
    `;
    res.json({ data: rows });
  })
);

router.post(
  "/appointments",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const { doctor_id, slot_id, consultation_type, chief_complaint } = req.body || {};
    if (!isUuid(doctor_id) || !isUuid(slot_id)) return res.status(400).json({ error: "doctor_id and slot_id required" });

    const ctype = consultation_type === "chamber" ? "chamber" : "online";
    const complain = chief_complaint == null ? null : String(chief_complaint).slice(0, 2000);

    try {
      const result = await sql.begin(async (tx) => {
        const [slot] = await tx`
          select ts.id, ts.doctor_id, ts.slot_end, d.specialty_id
          from medibondhu_doctor_time_slots ts
          join medibondhu_doctors d on d.id = ts.doctor_id
          where ts.id = ${slot_id}::uuid
            and ts.doctor_id = ${doctor_id}::uuid
            for update
        `;
        if (!slot) throw new Error("SLOT_NOT_FOUND");
        const endMs =
          slot.slot_end instanceof Date
            ? slot.slot_end.getTime()
            : Number.isFinite(Date.parse(slot.slot_end))
              ? Date.parse(slot.slot_end)
              : NaN;
        if (Number.isFinite(endMs) && endMs <= Date.now()) throw new Error("SLOT_WINDOW_ENDED");

        const [dupActive] = await tx`
          select id from medibondhu_appointments
          where slot_id = ${slot_id}::uuid
            and patient_user_id = ${uid}::uuid
            and status in ('pending', 'confirmed', 'in_progress')
          limit 1
        `;
        if (dupActive) throw new Error("DUPLICATE_ACTIVE_BOOKING");

        // Online visits start pending until the doctor accepts (join video → in_progress), like VetBondhu.
        const initialStatus = ctype === "chamber" ? "confirmed" : "pending";
        const [appt] = await tx`
          insert into medibondhu_appointments ${sql({
            patient_user_id: uid,
            doctor_id,
            slot_id,
            specialty_id: slot.specialty_id,
            consultation_type: ctype,
            status: initialStatus,
            payment_status: "unpaid",
            chief_complaint: complain,
        updated_at: new Date().toISOString(),
      })}
          returning *
        `;
        return appt;
      });
      /** Patient bootstrap keyed by booking user; doctor inbox by practitioner user — both must invalidate. */
      const [docRow] = await sql`
        select user_id from medibondhu_doctors where id = ${doctor_id}::uuid limit 1
      `;
      invalidateByPrefix(`${CACHE_PREFIX}|u:${uid}|`);
      if (docRow?.user_id) invalidateByPrefix(`${CACHE_PREFIX}|u:${String(docRow.user_id)}|`);

      res.status(201).json({
        data: {
          ...result,
          doctor_user_id: docRow?.user_id ? String(docRow.user_id) : null,
        },
      });
    } catch (e) {
      const m = String((e && e.message) || e);
      if (m.includes("DUPLICATE_ACTIVE_BOOKING")) {
        return res.status(409).json({ error: "You already have an active booking for this time window" });
      }
      if (m.includes("SLOT_WINDOW_ENDED")) return res.status(400).json({ error: "This time slot has ended; choose another" });
      if (m.includes("SLOT_NOT_FOUND")) return res.status(404).json({ error: "Slot not found" });
      throw e;
    }
  })
);

router.get(
  "/appointments/bootstrap",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const view = typeof req.query.view === "string" ? req.query.view : "patient";
    const offset = readOffset(req.query.offset);
    const lim = readLimit(req.query.limit, 50, 100);

    if (view === "doctor") {
      const doctorPk = await isDoctorApprovedUser(uid);
      if (!doctorPk) return res.status(403).json({ error: "Not an approved MediBondhu doctor" });

      const cacheKey = makeCacheKey(CACHE_PREFIX, {
        userId: uid,
        parts: ["appt-doctor", doctorPk, String(offset), String(lim)],
      });
      const { value: payload } = await getOrSetCachedValue(cacheKey, 1500, async () => {
        const appointments = await sql`
          select a.*,
            p.name as patient_name,
            p.email as patient_email,
            coalesce(d.full_name,'') as doctor_display_name,
            ts.slot_date,
            ts.slot_start,
            ts.slot_end
          from medibondhu_appointments a
          join profiles p on p.id = a.patient_user_id
          join medibondhu_doctors d on d.id = a.doctor_id
          left join medibondhu_doctor_time_slots ts on ts.id = a.slot_id
          where a.doctor_id = ${doctorPk}::uuid
          order by coalesce(ts.slot_start, a.created_at) desc
          limit ${lim + 1} offset ${offset}
        `;
        const hasMore = appointments.length > lim;
        const slice = hasMore ? appointments.slice(0, lim) : appointments;
        return { appointments: slice, page: { hasMore, nextOffset: hasMore ? offset + lim : null } };
      });

      res.set("Cache-Control", "private, no-store");
      return res.json({ data: payload });
    }

    const cacheKeyPatient = makeCacheKey(CACHE_PREFIX, {
      userId: uid,
      parts: ["appt-patient", String(offset), String(lim)],
    });
    const { value: payload } = await getOrSetCachedValue(cacheKeyPatient, 1500, async () => {
      const appointments = await sql`
        select a.*,
          d.full_name as doctor_name,
          d.profile_photo_url as doctor_photo_url,
          s.name as specialty_name,
          ts.slot_date,
          ts.slot_start,
          ts.slot_end
        from medibondhu_appointments a
        join medibondhu_doctors d on d.id = a.doctor_id
        left join medibondhu_specialties s on s.id = a.specialty_id
        left join medibondhu_doctor_time_slots ts on ts.id = a.slot_id
        where a.patient_user_id = ${uid}::uuid
        order by coalesce(ts.slot_start, a.created_at) desc
        limit ${lim + 1} offset ${offset}
      `;
      const hasMore = appointments.length > lim;
      const slice = hasMore ? appointments.slice(0, lim) : appointments;
      return { appointments: slice, page: { hasMore, nextOffset: hasMore ? offset + lim : null } };
    });

    res.set("Cache-Control", "private, no-store");
    res.json({ data: payload });
  })
);

router.get(
  "/appointments/:id/room-bootstrap",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const apptId = String(req.params.id || "");
    if (!isUuid(apptId)) return res.status(400).json({ error: "Invalid appointment id" });

    const messageLimit = readLimit(req.query.message_limit, 80, 160);
    const doctorPk = await isDoctorApprovedUser(uid);

    const [row] = await sql`
      select a.*,
        d.full_name as doctor_name,
        d.profile_photo_url as doctor_photo_url,
        d.user_id as doctor_user_id,
        s.name as specialty_name,
        ts.slot_date,
        ts.slot_start,
        ts.slot_end
      from medibondhu_appointments a
      join medibondhu_doctors d on d.id = a.doctor_id
      left join medibondhu_specialties s on s.id = a.specialty_id
      left join medibondhu_doctor_time_slots ts on ts.id = a.slot_id
      where a.id = ${apptId}::uuid
      limit 1
    `;
    if (!row) return res.status(404).json({ error: "Not found" });

    const isPatient = String(row.patient_user_id) === uid;
    const isDoctor = Boolean(doctorPk && String(row.doctor_id) === doctorPk);
    const admin = await isAdminReq(req);
    if (!isPatient && !isDoctor && !admin) return res.status(403).json({ error: "Forbidden" });

    const ctype = String(row.consultation_type || "").toLowerCase();
    if (ctype !== "online") {
      return res.status(400).json({ error: "Video consultations are only available for online appointments" });
    }

    const st = String(row.status || "").toLowerCase();
    const terminal = terminalMediAppointmentStatus(st);
    const slotOk = isWithinMediTeleconsultWindow(row.slot_start, row.slot_end);
    /** Video after doctor accepts (in_progress). Slot window is advisory only — VetBondhu does not block active visits. */
    const canJoinVideo = !terminal && st === "in_progress";

    const participantIds = [
      String(row.patient_user_id || ""),
      String(row.doctor_user_id || ""),
    ].filter(Boolean);

    const messages = await sql`
      select m.id, m.appointment_id, m.sender_id, coalesce(p.name, '') as sender_name,
             m.message, m.created_at
      from medibondhu_appointment_messages m
      left join profiles p on p.id = m.sender_id
      where m.appointment_id = ${apptId}::uuid
      order by m.created_at asc
      limit ${messageLimit}
    `;

    const participants =
      participantIds.length === 0
        ? []
        : await sql`
          select id, name, email, phone, primary_role, avatar_url
          from profiles
          where id in ${sql(participantIds)}
        `;

    const roleSet = await getRequestRoleSet(req);
    res.set("Cache-Control", "private, no-store");
    res.json({
      data: {
        appointment: row,
        messages,
        participants,
        permissions: {
          isPatient,
          isDoctor,
          isAdmin: roleSet.has("admin"),
          canJoinVideo,
          slotWithinWindow: slotOk,
          zegoRoomId: mediHumanZegoRoomId(apptId),
        },
      },
    });
  })
);

router.post(
  "/appointments/:id/messages",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const apptId = String(req.params.id || "");
    const { message } = req.body || {};
    if (!isUuid(apptId)) return res.status(400).json({ error: "Invalid appointment id" });
    const text = typeof message === "string" ? message.trim().slice(0, 8000) : "";
    if (!text) return res.status(400).json({ error: "Message required" });

    const doctorPk = await isDoctorApprovedUser(uid);
    const [row] = await sql`
      select * from medibondhu_appointments where id = ${apptId}::uuid limit 1
    `;
    if (!row) return res.status(404).json({ error: "Not found" });

    const isPatient = String(row.patient_user_id) === uid;
    const isDoctor = Boolean(doctorPk && String(row.doctor_id) === doctorPk);
    const admin = await isAdminReq(req);
    if (!isPatient && !isDoctor && !admin) return res.status(403).json({ error: "Forbidden" });

    if (terminalMediAppointmentStatus(row.status)) {
      return res.status(409).json({ error: "This appointment is closed" });
    }

    const [inserted] = await sql`
      insert into medibondhu_appointment_messages ${sql({
        appointment_id: apptId,
        sender_id: uid,
        message: text,
      })}
      returning id, appointment_id, sender_id, message, created_at
    `;
    const [senderProf] = await sql`select coalesce(name, '') as name from profiles where id = ${uid}::uuid limit 1`;
    const sender_name = String(senderProf?.name || "");
    res.status(201).json({ data: { ...inserted, sender_name } });
  })
);

router.get(
  "/appointments/:id",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const apptId = String(req.params.id || "");
    if (!isUuid(apptId)) return res.status(400).json({ error: "Invalid appointment id" });

    const doctorPk = await isDoctorApprovedUser(uid);
    const [row] = await sql`
      select a.*,
        d.full_name as doctor_name,
        d.profile_photo_url as doctor_photo_url,
        s.name as specialty_name,
        ts.slot_date,
        ts.slot_start,
        ts.slot_end
      from medibondhu_appointments a
      join medibondhu_doctors d on d.id = a.doctor_id
      left join medibondhu_specialties s on s.id = a.specialty_id
      left join medibondhu_doctor_time_slots ts on ts.id = a.slot_id
      where a.id = ${apptId}::uuid
      limit 1
    `;
    if (!row) return res.status(404).json({ error: "Not found" });

    const isPatient = String(row.patient_user_id) === uid;
    const isDoc = doctorPk && String(row.doctor_id) === doctorPk;
    const admin = await isAdminReq(req);
    if (!isPatient && !isDoc && !admin) return res.status(403).json({ error: "Forbidden" });

    res.json({ data: row });
  })
);

router.patch(
  "/appointments/:id",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const apptId = String(req.params.id || "");
    const { status, cancellation_reason } = req.body || {};
    if (!isUuid(apptId)) return res.status(400).json({ error: "Invalid appointment id" });

    const [row] = await sql`
      select a.*, ts.slot_start, ts.slot_end
      from medibondhu_appointments a
      left join medibondhu_doctor_time_slots ts on ts.id = a.slot_id
      where a.id = ${apptId}::uuid limit 1
    `;
    if (!row) return res.status(404).json({ error: "Appointment not found" });

    const admin = await isAdminReq(req);

    if (status === "cancelled") {
      const isPatient = String(row.patient_user_id) === uid;
      const doctorPk = await isDoctorApprovedUser(uid);
      const isDoctorOwn = doctorPk && String(row.doctor_id) === doctorPk;
      if (!isPatient && !isDoctorOwn && !admin) return res.status(403).json({ error: "Forbidden" });

      await sql.begin(async (tx) => {
        await tx`
          update medibondhu_appointments set
            status = 'cancelled',
            cancelled_by = ${isPatient ? "patient" : isDoctorOwn ? "doctor" : "admin"},
            updated_at = now()
          where id = ${apptId}::uuid
        `;
      });

      const [nextRow] = await sql`select * from medibondhu_appointments where id = ${apptId}::uuid`;
      return res.json({ data: nextRow });
    }

    /** Doctor updates */
    const allowedNext = ["confirmed", "rejected", "completed", "in_progress"];
    const st = typeof status === "string" ? status : "";
    if (!allowedNext.includes(st)) return res.status(400).json({ error: "Invalid status" });

    const doctorPk = await isDoctorApprovedUser(uid);
    if (!doctorPk || String(row.doctor_id) !== doctorPk) return res.status(403).json({ error: "Forbidden" });

    const consultationType = String(row.consultation_type || "").toLowerCase();
    const prevStatus = String(row.status || "").toLowerCase();

    if (st === "in_progress") {
      if (consultationType !== "online") {
        return res.status(400).json({ error: "In-person visits do not use a video room. Mark complete after the clinic visit." });
      }
      if (prevStatus !== "confirmed" && prevStatus !== "pending") {
        return res.status(400).json({ error: "Can only start a teleconsult from a pending or confirmed appointment" });
      }
    }

    if (st === "completed" && !["confirmed", "pending", "in_progress"].includes(prevStatus)) {
      return res.status(400).json({ error: "Cannot complete this appointment" });
    }

    let updated;
    try {
      [updated] = await sql`
        update medibondhu_appointments
        set
          status = ${st},
          talk_started_at = case
            when ${st} = 'in_progress' and talk_started_at is null then now()
            else talk_started_at
          end,
          talk_ended_at = case
            when ${st} = 'completed' then coalesce(talk_ended_at, now())
            else talk_ended_at
          end,
          updated_at = now()
        where id = ${apptId}::uuid and doctor_id = ${doctorPk}::uuid
        returning *
      `;
    } catch (e) {
      const code = /** @type {{ code?: string; message?: string }} */ (e)?.code;
      const msg = e instanceof Error ? e.message : String(e);
      const missingTalkColumns =
        code === "42703" &&
        (msg.includes("talk_started_at") || msg.includes("talk_ended_at"));
      if (!missingTalkColumns) throw e;

      [updated] = await sql`
        update medibondhu_appointments
        set
          status = ${st},
          updated_at = now()
        where id = ${apptId}::uuid and doctor_id = ${doctorPk}::uuid
        returning *
      `;
    }
    if (!updated) return res.status(404).json({ error: "Not updated" });

    res.json({
      data: updated,
      note: cancellation_reason ? String(cancellation_reason).slice(0, 500) : undefined,
    });
  })
);

// ─── Doctor profile & slots ─────────────────────────────────────────────

router.get(
  "/doctor/me",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const [d] = await sql`
      select d.*,
        s.name as specialty_name,
        h.name as hospital_name
      from medibondhu_doctors d
      left join medibondhu_specialties s on s.id = d.specialty_id
      left join medibondhu_hospitals h on h.id = d.hospital_id
      where d.user_id = ${uid}::uuid limit 1
    `;
    res.json({ data: d || null });
  })
);

router.post(
  "/doctor/profile",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const b = req.body || {};
    if (!(await doctorMayApplyMediProfile(req))) {
      return res.status(403).json({ error: "Not allowed to submit doctor profile" });
    }

    const [existing] = await sql`
      select id, verification_documents from medibondhu_doctors where user_id = ${uid}::uuid limit 1
    `;

    const verification_documents = Array.isArray(b.verification_documents)
      ? normalizeVerificationDocuments(b.verification_documents)
      : normalizeVerificationDocuments(existing?.verification_documents);

    const medical_reg_number =
      b.medical_reg_number == null ? null : String(b.medical_reg_number).trim().slice(0, 120) || null;
    const registration_body =
      b.registration_body == null ? null : String(b.registration_body).trim().slice(0, 400) || null;

    const full_name = String(b.full_name || "Doctor").slice(0, 200);
    const qualification = String(b.qualification || "").slice(0, 400) || null;
    const experience_years = Math.max(0, Math.min(70, Number(b.experience_years) || 0));
    const chamber_address = b.chamber_address == null ? null : String(b.chamber_address).slice(0, 600);
    const consultation_fee = Math.max(0, Number(b.consultation_fee) || 0);
    const profile_photo_url = b.profile_photo_url == null ? null : String(b.profile_photo_url).slice(0, 2048);
    const about = b.about == null ? null : String(b.about).slice(0, 4000);
    const online_consultation = Boolean(b.online_consultation ?? true);
    const chamber_consultation = Boolean(b.chamber_consultation ?? true);
    const specialty_id = isUuid(b.specialty_id) ? String(b.specialty_id) : null;
    const hospital_id = isUuid(b.hospital_id) ? String(b.hospital_id) : null;
    const updated_at = new Date().toISOString();

    if (existing?.id) {
      const id = existing.id;
      const [upd] = await sql`
        update medibondhu_doctors set
          specialty_id = ${specialty_id},
          hospital_id = ${hospital_id},
          full_name = ${full_name},
          qualification = ${qualification},
          experience_years = ${experience_years},
          chamber_address = ${chamber_address},
          consultation_fee = ${consultation_fee},
          profile_photo_url = ${profile_photo_url},
          about = ${about},
          online_consultation = ${online_consultation},
          chamber_consultation = ${chamber_consultation},
          medical_reg_number = ${medical_reg_number},
          registration_body = ${registration_body},
          verification_documents = ${sql.json(verification_documents)},
          approval_status = 'pending',
          updated_at = ${updated_at}
        where id = ${String(id)}::uuid
        returning *
      `;
      return res.json({ data: upd });
    }

    const [ins] = await sql`
      insert into medibondhu_doctors (
        user_id, specialty_id, hospital_id, full_name, qualification, experience_years,
        chamber_address, consultation_fee, profile_photo_url, about,
        online_consultation, chamber_consultation, medical_reg_number, registration_body,
        verification_documents, approval_status, updated_at
      ) values (
        ${uid}::uuid,
        ${specialty_id},
        ${hospital_id},
        ${full_name},
        ${qualification},
        ${experience_years},
        ${chamber_address},
        ${consultation_fee},
        ${profile_photo_url},
        ${about},
        ${online_consultation},
        ${chamber_consultation},
        ${medical_reg_number},
        ${registration_body},
        ${sql.json(verification_documents)},
        'pending',
        ${updated_at}
      )
      returning *
    `;
    res.status(201).json({ data: ins });
  })
);

router.patch(
  "/doctor/profile",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    if (!(await doctorMayApplyMediProfile(req))) {
      return res.status(403).json({ error: "Not allowed to update doctor profile" });
    }

    const [existing] = await sql`select id from medibondhu_doctors where user_id = ${uid}::uuid limit 1`;
    if (!existing?.id) return res.status(404).json({ error: "Doctor profile not found" });

    const b = req.body || {};
    const patch = {};
    if (b.full_name !== undefined) patch.full_name = String(b.full_name || "").slice(0, 200) || "Doctor";
    if (b.qualification !== undefined) patch.qualification = String(b.qualification || "").slice(0, 400) || null;
    if (b.experience_years !== undefined) {
      patch.experience_years = Math.max(0, Math.min(70, Number(b.experience_years) || 0));
    }
    if (b.chamber_address !== undefined) {
      patch.chamber_address = b.chamber_address == null ? null : String(b.chamber_address).slice(0, 600);
    }
    if (b.consultation_fee !== undefined) patch.consultation_fee = Math.max(0, Number(b.consultation_fee) || 0);
    if (b.profile_photo_url !== undefined) {
      patch.profile_photo_url = b.profile_photo_url == null ? null : String(b.profile_photo_url).slice(0, 2048);
    }
    if (b.about !== undefined) patch.about = b.about == null ? null : String(b.about).slice(0, 4000);
    if (b.online_consultation !== undefined) patch.online_consultation = Boolean(b.online_consultation);
    if (b.chamber_consultation !== undefined) patch.chamber_consultation = Boolean(b.chamber_consultation);
    if (b.specialty_id !== undefined) {
      patch.specialty_id = isUuid(b.specialty_id) ? String(b.specialty_id) : null;
    }
    if (b.hospital_id !== undefined) {
      patch.hospital_id = isUuid(b.hospital_id) ? String(b.hospital_id) : null;
    }
    if (b.medical_reg_number !== undefined) {
      patch.medical_reg_number =
        b.medical_reg_number == null ? null : String(b.medical_reg_number).trim().slice(0, 120) || null;
    }
    if (b.registration_body !== undefined) {
      patch.registration_body =
        b.registration_body == null ? null : String(b.registration_body).trim().slice(0, 400) || null;
    }
    if (b.verification_documents !== undefined) {
      patch.verification_documents = sql.json(normalizeVerificationDocuments(b.verification_documents));
    }

    if (!Object.keys(patch).length) return res.status(400).json({ error: "No fields to update" });

    patch.approval_status = "pending";
    patch.updated_at = new Date().toISOString();

    const [upd] = await sql`
      update medibondhu_doctors set ${sql(patch)}
      where id = ${String(existing.id)}::uuid
      returning *
    `;
    res.json({ data: upd });
  })
);

router.post(
  "/doctor/verification/upload",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    if (!(await doctorMayApplyMediProfile(req))) {
      return res.status(403).json({ error: "Not allowed to upload verification documents" });
    }

    const documentType = String(req.body?.document_type || req.body?.documentType || "").toLowerCase();
    if (!VERIFICATION_DOC_TYPES.has(documentType)) {
      return res.status(400).json({
        error: `document_type must be one of: ${[...VERIFICATION_DOC_TYPES].join(", ")}`,
      });
    }

    const fileData = String(req.body?.file_data || "");
    if (!fileData) return res.status(400).json({ error: "file_data is required" });

    let uploaded;
    try {
      uploaded = await uploadToCloudinary(
        fileData,
        "medibondhu/doctor/verification",
        `medi_doc_${documentType}_${uid}`,
      );
    } catch (error) {
      const message = String(/** @type {Error & { status?: number }} */ (error)?.message || "");
      const low = message.toLowerCase();
      if (low.includes("cloudinary is not configured")) {
        uploaded = { url: fileData, publicId: "", storage: "inline_data_url" };
      } else if (low.includes("invalid file payload")) {
        return res.status(400).json({ error: "Invalid file: choose a PDF or image from the file picker." });
      } else throw error;
    }

    try {
      let [docRow] = await sql`
        select id, verification_documents from medibondhu_doctors where user_id = ${uid}::uuid limit 1
      `;

      if (!docRow?.id) {
        const [p] = await sql`select name from profiles where id = ${uid}::uuid limit 1`;
        const fullName = String(p?.name || "Doctor").trim().slice(0, 200) || "Doctor";
        const [ins] = await sql`
          insert into medibondhu_doctors (
            user_id,
            full_name,
            approval_status,
            verification_documents,
            updated_at
          )
          values (
            ${uid}::uuid,
            ${fullName},
            'pending',
            ${sql.json([])},
            now()
          )
          returning id, verification_documents
        `;
        docRow = ins;
      }

      const prev = normalizeVerificationDocuments(docRow.verification_documents);
      const entry = {
        type: documentType,
        url: uploaded.url,
        public_id: uploaded.publicId || "",
        uploaded_at: new Date().toISOString(),
      };
      const next = [...prev.filter((d) => String(/** @type {{ type?: string }} */ (d).type) !== documentType), entry];

      const [upd] = await sql`
        update medibondhu_doctors
        set verification_documents = ${sql.json(next)},
            approval_status = 'pending',
            updated_at = now()
        where user_id = ${uid}::uuid
        returning id, verification_documents
      `;

      res.status(201).json({ data: { ...entry, doctor_id: upd?.id } });
    } catch (e) {
      const code = /** @type {{ code?: string; message?: string }} */ (e)?.code;
      const msg = e instanceof Error ? e.message : String(e);
      if (
        code === "42703" ||
        (msg.includes("verification_documents") && msg.toLowerCase().includes("column"))
      ) {
        return res.status(503).json({
          error:
            "Database is missing MediBondhu doctor columns (e.g. verification_documents). From the backend folder run: npm run db:ensure",
        });
      }
      throw e;
    }
  })
);

router.get(
  "/doctor/time-slots",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const doctorPk = await isDoctorApprovedUser(uid);
    if (!doctorPk) return res.status(403).json({ error: "Only approved doctors can view slots" });

    const fromRaw = typeof req.query.from === "string" ? req.query.from.trim() : "";
    const toRaw = typeof req.query.to === "string" ? req.query.to.trim() : "";
    const defaultFrom = slotDateYmdBangladeshFromUtcMs(Date.now());
    const defaultTo = slotDateYmdBangladeshFromUtcMs(Date.now() + 42 * 86400000 * 1000);
    const fromD = /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : defaultFrom;
    const toD = /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw : defaultTo;

    let rows;
    try {
      rows = await sql`
        select
          ts.*,
          ap.id as appointment_id,
          ap.consultation_type,
          ap.status as appointment_status,
          ap.patient_user_id,
          ap.talk_started_at,
          ap.talk_ended_at,
          p.name as patient_name,
          p.email as patient_email,
          case
            when ap.id is null then null
            when ap.talk_started_at is not null then greatest(
              0,
              floor(extract(epoch from (coalesce(ap.talk_ended_at, now()) - ap.talk_started_at)) / 60)::int
            )
            else greatest(0, floor(extract(epoch from (ts.slot_end - ts.slot_start)) / 60)::int)
          end as consultation_minutes,
          (
            select count(*)::int from medibondhu_appointments a
            where a.slot_id = ts.id
              and a.status in ('pending', 'confirmed', 'in_progress')
          ) as active_appointment_count,
          (
            select count(*)::int from medibondhu_appointments a
            where a.slot_id = ts.id
              and a.status not in ('cancelled', 'rejected')
          ) as total_appointment_count
        from medibondhu_doctor_time_slots ts
        left join lateral (
          select a.*
          from medibondhu_appointments a
          where a.slot_id = ts.id
          order by a.created_at desc
          limit 1
        ) ap on true
        left join profiles p on p.id = ap.patient_user_id
        where ts.doctor_id = ${doctorPk}::uuid
          and ((ts.slot_start at time zone 'Asia/Dhaka')::date between ${fromD}::date and ${toD}::date)
        order by ts.slot_start asc
        limit 500
      `;
    } catch (e) {
      const code = /** @type {{ code?: string; message?: string }} */ (e)?.code;
      const msg = e instanceof Error ? e.message : String(e);
      const missingTalkColumns =
        code === "42703" &&
        (msg.includes("talk_started_at") || msg.includes("talk_ended_at"));
      if (!missingTalkColumns) throw e;

      // Backward compatible fallback for environments where schema migration has not run yet.
      rows = await sql`
        select
          ts.*,
          ap.id as appointment_id,
          ap.consultation_type,
          ap.status as appointment_status,
          ap.patient_user_id,
          null::timestamptz as talk_started_at,
          null::timestamptz as talk_ended_at,
          p.name as patient_name,
          p.email as patient_email,
          case
            when ap.id is null then null
            else greatest(0, floor(extract(epoch from (ts.slot_end - ts.slot_start)) / 60)::int)
          end as consultation_minutes,
          (
            select count(*)::int from medibondhu_appointments a
            where a.slot_id = ts.id
              and a.status in ('pending', 'confirmed', 'in_progress')
          ) as active_appointment_count,
          (
            select count(*)::int from medibondhu_appointments a
            where a.slot_id = ts.id
              and a.status not in ('cancelled', 'rejected')
          ) as total_appointment_count
        from medibondhu_doctor_time_slots ts
        left join lateral (
          select a.*
          from medibondhu_appointments a
          where a.slot_id = ts.id
          order by a.created_at desc
          limit 1
        ) ap on true
        left join profiles p on p.id = ap.patient_user_id
        where ts.doctor_id = ${doctorPk}::uuid
          and ((ts.slot_start at time zone 'Asia/Dhaka')::date between ${fromD}::date and ${toD}::date)
        order by ts.slot_start asc
        limit 500
      `;
    }
    res.json({ data: rows });
  })
);

router.post(
  "/doctor/time-slots/bulk",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const doctorPk = await isDoctorApprovedUser(uid);
    if (!doctorPk) return res.status(403).json({ error: "Only approved doctors can add slots" });

    const slots = Array.isArray(req.body?.slots) ? req.body.slots : [];
    if (!slots.length || slots.length > 200) return res.status(400).json({ error: "slots[] required (max 200)" });

    const nowMs = Date.now();
    let pastSkipped = 0;
    const rows = slots
      .map((s) => {
        const ss = typeof s.slot_start === "string" ? s.slot_start : "";
        const se = typeof s.slot_end === "string" ? s.slot_end : "";
        const ds = Date.parse(ss);
        const de = Date.parse(se);
        if (!Number.isFinite(ds) || !Number.isFinite(de) || de <= ds) return null;
        if (de <= nowMs) {
          pastSkipped += 1;
          return null;
        }
        const slot_start = new Date(ds).toISOString();
        const slot_end = new Date(de).toISOString();
        const slot_date = slotDateYmdBangladeshFromUtcMs(ds);
        return {
          doctor_id: doctorPk,
          slot_date,
          slot_start,
          slot_end,
          booked: false,
        };
      })
      .filter(Boolean);

    if (!rows.length) {
      return res.status(201).json({
        data: {
          inserted_count: 0,
          requested_count: slots.length,
          duplicates_skipped: 0,
          past_skipped: pastSkipped,
        },
      });
    }

    const inserted = await sql`
      insert into medibondhu_doctor_time_slots ${sql(rows)}
      on conflict (doctor_id, slot_start) do nothing
      returning id
    `;
    const insertedCount = inserted.length;
    const requestedCount = rows.length;
    res.status(201).json({
      data: {
        inserted_count: insertedCount,
        requested_count: slots.length,
        duplicates_skipped: Math.max(0, requestedCount - insertedCount),
        past_skipped: pastSkipped,
      },
    });
  })
);

router.delete(
  "/doctor/time-slots/:id",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const sid = String(req.params.id || "");
    const doctorPk = await isDoctorApprovedUser(uid);
    if (!doctorPk || !isUuid(sid)) return res.status(400).json({ error: "Invalid" });

    const [slotRow] = await sql`
      select ts.id, ts.slot_end,
        (
          select count(*)::int from medibondhu_appointments a
          where a.slot_id = ts.id
            and a.status in ('pending', 'confirmed', 'in_progress')
        ) as active_appointment_count
      from medibondhu_doctor_time_slots ts
      where ts.id = ${sid}::uuid and ts.doctor_id = ${doctorPk}::uuid
      limit 1
    `;
    if (!slotRow) return res.status(404).json({ error: "Slot not found" });
    const activeCount = Number(slotRow.active_appointment_count || 0);
    if (activeCount > 0) {
      return res.status(409).json({ error: "Cannot remove slot while patients are still booked" });
    }
    const endMs =
      slotRow.slot_end instanceof Date
        ? slotRow.slot_end.getTime()
        : Number.isFinite(Date.parse(slotRow.slot_end))
          ? Date.parse(slotRow.slot_end)
          : NaN;
    if (Number.isFinite(endMs) && endMs <= Date.now()) {
      return res.status(400).json({ error: "Past slots cannot be removed" });
    }

    const [del] = await sql`
      delete from medibondhu_doctor_time_slots
      where id = ${sid}::uuid and doctor_id = ${doctorPk}::uuid
      returning id
    `;
    if (!del) return res.status(404).json({ error: "Slot not found" });
    res.json({ data: { ok: true } });
  })
);

// ─── Prescriptions (human module) ───────────────────────────────────────

router.get(
  "/prescriptions/bootstrap",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const mode = req.query.mode === "doctor" ? "doctor" : "patient";

    if (mode === "doctor") {
      const doctorPk = await isDoctorApprovedUser(uid);
      if (!doctorPk) return res.status(403).json({ error: "Not an approved MediBondhu doctor" });
      const rows = await sql`
        select pr.*,
          coalesce(ap.chief_complaint,'') as chief_complaint
        from medibondhu_prescriptions pr
        left join medibondhu_appointments ap on ap.id = pr.appointment_id
        where pr.doctor_id = ${doctorPk}::uuid
        order by pr.created_at desc
        limit 80
      `;
      return res.json({ data: { prescriptions: rows, page: { hasMore: false, nextOffset: null } } });
    }

    const rows = await sql`
      select pr.*,
        d.full_name as doctor_name,
        ap.status as appointment_status,
        ts.slot_start
      from medibondhu_prescriptions pr
      join medibondhu_doctors d on d.id = pr.doctor_id
      left join medibondhu_appointments ap on ap.id = pr.appointment_id
      left join medibondhu_doctor_time_slots ts on ts.id = ap.slot_id
      where pr.patient_user_id = ${uid}::uuid
      order by pr.created_at desc
      limit 80
    `;
    res.json({ data: { prescriptions: rows, page: { hasMore: false, nextOffset: null } } });
  })
);

router.get(
  "/prescriptions/:id",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const pid = String(req.params.id || "");
    if (!isUuid(pid)) return res.status(400).json({ error: "Invalid id" });

    const doctorPk = await isDoctorApprovedUser(uid);
    const [pr] = await sql`
      select * from medibondhu_prescriptions where id = ${pid}::uuid limit 1
    `;
    if (!pr) return res.status(404).json({ error: "Not found" });
    const isPatient = String(pr.patient_user_id) === uid;
    const isDoc = doctorPk && String(pr.doctor_id) === doctorPk;
    const admin = await isAdminReq(req);
    if (!isPatient && !isDoc && !admin) return res.status(403).json({ error: "Forbidden" });

    const items = await sql`
      select * from medibondhu_prescription_items where prescription_id = ${pid}::uuid order by created_at asc
    `;
    res.json({ data: { ...pr, items } });
  })
);

router.post(
  "/prescriptions",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const doctorPk = await isDoctorApprovedUser(uid);
    if (!doctorPk) return res.status(403).json({ error: "Not an approved doctor" });

    const { appointment_id, patient_user_id, diagnosis, advice, follow_up_date, items } = req.body || {};
    if (!isUuid(patient_user_id)) return res.status(400).json({ error: "patient_user_id required" });

    if (appointment_id && isUuid(appointment_id)) {
      const [ap] = await sql`
        select * from medibondhu_appointments
        where id = ${appointment_id}::uuid and doctor_id = ${doctorPk}::uuid limit 1
      `;
      if (!ap) return res.status(400).json({ error: "Appointment does not belong to this doctor" });
    }

    const itemRows = Array.isArray(items) ? items.slice(0, 50) : [];

    const prRow = await sql.begin(async (tx) => {
      const ins = await tx`
        insert into medibondhu_prescriptions ${sql({
          appointment_id: appointment_id && isUuid(appointment_id) ? appointment_id : null,
          doctor_id: doctorPk,
          patient_user_id,
          diagnosis: diagnosis == null ? null : String(diagnosis).slice(0, 4000),
          advice: advice == null ? null : String(advice).slice(0, 4000),
          follow_up_date: follow_up_date && /^\d{4}-\d{2}-\d{2}$/.test(String(follow_up_date)) ? String(follow_up_date) : null,
          status: "issued",
      updated_at: new Date().toISOString(),
        })}
      returning *
    `;
      const row = ins[0];
      if (!row?.id) throw new Error("PRESCRIPTION_INSERT_FAILED");

      for (const it of itemRows) {
        const medication_name = String(it?.medication_name || it?.name || "").trim().slice(0, 400);
        if (!medication_name) continue;
        await tx`
          insert into medibondhu_prescription_items ${sql({
            prescription_id: row.id,
            medication_name,
            dosage: it?.dosage == null ? null : String(it.dosage).slice(0, 400),
            notes: it?.notes == null ? null : String(it.notes).slice(0, 2000),
          })}
        `;
      }
      return row;
    });

    res.status(201).json({ data: prRow });
  })
);

router.get(
  "/doctor-earnings/summary",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const admin = await isAdminReq(req);
    const doctorPk = await isDoctorApprovedUser(uid);
    if (!doctorPk && !admin) return res.status(403).json({ error: "Not an approved MediBondhu doctor" });

    const actorUserId = doctorPk ? uid : String(req.query.doctor_user_id || "");
    if (!isUuid(actorUserId)) return res.status(400).json({ error: "doctor_user_id required for admin view" });

    const summary = await computeDoctorEarningsSummary(actorUserId);
    const historyLimit = Math.min(Math.max(Number(req.query.history_limit) || 30, 1), 100);
    const historyRows = await sql`
      select
        a.id,
        coalesce(pp.name, pp.email, 'Patient') as patient_name,
        coalesce(d.consultation_fee, 0) as fee,
        a.created_at,
        a.updated_at as completed_at
      from medibondhu_appointments a
      join medibondhu_doctors d on d.id = a.doctor_id
      left join profiles pp on pp.id = a.patient_user_id
      where d.user_id = ${actorUserId}
        and a.status = 'completed'
      order by a.updated_at desc
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
          animal_type: null,
        })),
      },
    });
  })
);

router.get(
  "/doctor-withdrawals",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const doctorPk = await isDoctorApprovedUser(uid);
    if (!doctorPk) return res.status(403).json({ error: "Not an approved MediBondhu doctor" });
    try {
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
        from medibondhu_doctor_withdrawals
        where doctor_user_id = ${uid}
        order by created_at desc
        limit 200
      `;
      res.json({ data: rows.map((r) => ({ ...r, request_amount: toMoney(r.request_amount || 0) })) });
    } catch (e) {
      const code = /** @type {{ code?: string }} */ (e)?.code;
      if (code !== "42P01") throw e;
      res.json({
        data: [],
        note: "Doctor withdrawals table is missing. Run backend schema ensure to enable withdrawals.",
      });
    }
  })
);

router.post(
  "/doctor-withdrawals",
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = String(req.userId || "");
    const doctorPk = await isDoctorApprovedUser(uid);
    if (!doctorPk) return res.status(403).json({ error: "Not an approved MediBondhu doctor" });
    const requestAmount = Number(req.body?.request_amount);
    const note = toTextOrNull(req.body?.note);
    if (!Number.isFinite(requestAmount) || requestAmount <= 0) {
      res.status(400).json({ error: "request_amount must be a positive number" });
      return;
    }
    const amount = toMoney(requestAmount);
    const summary = await computeDoctorEarningsSummary(uid);
    if (amount > summary.available_balance) {
      res.status(400).json({ error: "Requested amount exceeds available balance" });
      return;
    }
    if (!(await hasMediDoctorWithdrawalsTable())) {
      return res.status(503).json({
        error: "Doctor withdrawals table is missing. Run backend schema ensure to enable withdrawals.",
      });
    }
    const [created] = await sql`
      insert into medibondhu_doctor_withdrawals ${sql({
        doctor_user_id: uid,
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
  "/admin/doctor-withdrawals",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!(await isAdminReq(req))) return res.status(403).json({ error: "Admin access required" });
    if (!(await hasMediDoctorWithdrawalsTable())) {
      return res.status(503).json({
        error: "Doctor withdrawals table is missing. Run backend schema ensure to enable withdrawals.",
      });
    }
    const status = toTextOrNull(req.query.status);
    const rows = await sql`
      select
        dw.*,
        p.name as doctor_name,
        p.email as doctor_email
      from medibondhu_doctor_withdrawals dw
      left join profiles p on p.id = dw.doctor_user_id
      where (${status ? sql`dw.status = ${status}` : sql`true`})
      order by dw.created_at desc
      limit 300
    `;
    res.json({ data: rows.map((r) => ({ ...r, request_amount: toMoney(r.request_amount || 0) })) });
  })
);

router.get(
  "/admin/doctor-withdrawals/:id/details",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!(await isAdminReq(req))) return res.status(403).json({ error: "Admin access required" });
    if (!(await hasMediDoctorWithdrawalsTable())) {
      return res.status(503).json({
        error: "Doctor withdrawals table is missing. Run backend schema ensure to enable withdrawals.",
      });
    }
    const [request] = await sql`
      select dw.*, p.name as doctor_name, p.email as doctor_email, p.phone as doctor_phone, p.location as doctor_location
      from medibondhu_doctor_withdrawals dw
      left join profiles p on p.id = dw.doctor_user_id
      where dw.id = ${req.params.id}
      limit 1
    `;
    if (!request) return res.status(404).json({ error: "Withdrawal request not found" });

    const summary = await computeDoctorEarningsSummary(request.doctor_user_id);
    const consultations = await sql`
      select
        a.id,
        coalesce(pp.name, pp.email, 'Patient') as patient_name,
        coalesce(d.consultation_fee, 0) as fee,
        a.created_at,
        a.updated_at as completed_at
      from medibondhu_appointments a
      join medibondhu_doctors d on d.id = a.doctor_id
      left join profiles pp on pp.id = a.patient_user_id
      where d.user_id = ${request.doctor_user_id}
        and a.status = 'completed'
      order by a.updated_at desc
      limit 120
    `;
    const [doctorProfile] = await sql`
      select
        d.id,
        d.user_id,
        d.full_name,
        d.medical_reg_number,
        d.registration_body,
        d.approval_status,
        d.chamber_address,
        d.consultation_fee,
        d.qualification,
        d.experience_years,
        p.email,
        p.phone,
        p.location
      from medibondhu_doctors d
      left join profiles p on p.id = d.user_id
      where d.user_id = ${request.doctor_user_id}
      order by d.updated_at desc
      limit 1
    `;
    const requestHistory = await sql`
      select id, request_amount, status, note, review_note, created_at, reviewed_at
      from medibondhu_doctor_withdrawals
      where doctor_user_id = ${request.doctor_user_id}
      order by created_at desc
      limit 30
    `;
    res.json({
      data: {
        request,
        summary,
        consultations: consultations.map((c) => ({ ...c, fee: toMoney(c.fee || 0) })),
        doctor_profile: doctorProfile || null,
        request_history: requestHistory.map((r) => ({ ...r, request_amount: toMoney(r.request_amount || 0) })),
      },
    });
  })
);

router.post(
  "/admin/doctor-withdrawals/:id/approve",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!(await isAdminReq(req))) return res.status(403).json({ error: "Admin access required" });
    if (!(await hasMediDoctorWithdrawalsTable())) {
      return res.status(503).json({
        error: "Doctor withdrawals table is missing. Run backend schema ensure to enable withdrawals.",
      });
    }
    const [current] = await sql`select * from medibondhu_doctor_withdrawals where id = ${req.params.id} limit 1`;
    if (!current) return res.status(404).json({ error: "Withdrawal request not found" });
    if (String(current.status) !== "pending") return res.status(409).json({ error: "Only pending requests can be approved" });
    const note = toTextOrNull(req.body?.note) || toTextOrNull(current.note);
    const [updated] = await sql`
      update medibondhu_doctor_withdrawals
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
    await createDoctorWithdrawalReviewNotification(updated.doctor_user_id, updated.id, "approved", updated.review_note);
    res.json({ data: updated });
  })
);

router.post(
  "/admin/doctor-withdrawals/:id/reject",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!(await isAdminReq(req))) return res.status(403).json({ error: "Admin access required" });
    if (!(await hasMediDoctorWithdrawalsTable())) {
      return res.status(503).json({
        error: "Doctor withdrawals table is missing. Run backend schema ensure to enable withdrawals.",
      });
    }
    const [current] = await sql`select * from medibondhu_doctor_withdrawals where id = ${req.params.id} limit 1`;
    if (!current) return res.status(404).json({ error: "Withdrawal request not found" });
    if (String(current.status) !== "pending") return res.status(409).json({ error: "Only pending requests can be rejected" });
    const note = toTextOrNull(req.body?.note) || "Rejected by admin";
    const [updated] = await sql`
      update medibondhu_doctor_withdrawals
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
    await createDoctorWithdrawalReviewNotification(updated.doctor_user_id, updated.id, "rejected", updated.review_note);
    res.json({ data: updated });
  })
);

// ─── Admin (human MediBondhu) ───────────────────────────────────────────

router.get(
  "/admin/hospitals",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!(await isAdminReq(req))) return res.status(403).json({ error: "Admin access required" });
    const rows = await sql`select * from medibondhu_hospitals order by name asc limit 200`;
    res.json({ data: rows });
  })
);

router.get(
  "/admin/specialties",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!(await isAdminReq(req))) return res.status(403).json({ error: "Admin access required" });
    const rows = await sql`select * from medibondhu_specialties order by sort_order asc, name asc`;
    res.json({ data: rows });
  })
);

router.post(
  "/admin/hospitals",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!(await isAdminReq(req))) return res.status(403).json({ error: "Admin access required" });
    const b = req.body || {};
    const name = String(b.name || "").trim();
    if (!name) return res.status(400).json({ error: "name required" });
    const [row] = await sql`
      insert into medibondhu_hospitals ${sql({
        name,
        address: b.address == null ? null : String(b.address).slice(0, 1000),
        phone: b.phone == null ? null : String(b.phone).slice(0, 40),
        updated_at: new Date().toISOString(),
      })}
      returning *
    `;
    res.status(201).json({ data: row });
  })
);

router.post(
  "/admin/specialties",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!(await isAdminReq(req))) return res.status(403).json({ error: "Admin access required" });
    const b = req.body || {};
    const name = String(b.name || "").trim();
    if (!name) return res.status(400).json({ error: "name required" });
    const slug = String(b.slug || name.toLowerCase().replace(/\s+/g, "-")).slice(0, 120);
    const [row] = await sql`
      insert into medibondhu_specialties ${sql({
        name,
        slug,
        sort_order: Number(b.sort_order) || 0,
        is_active: b.is_active !== false,
      })}
      on conflict (slug) do update set
        name = excluded.name,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active
      returning *
    `;
    res.status(201).json({ data: row });
  })
);

router.get(
  "/admin/doctors",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!(await isAdminReq(req))) return res.status(403).json({ error: "Admin access required" });
    const st = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const rows = await sql`
      select d.*, s.name as specialty_name, p.email as account_email
      from medibondhu_doctors d
      left join medibondhu_specialties s on s.id = d.specialty_id
      left join profiles p on p.id = d.user_id
      where (${st ? sql`d.approval_status = ${st}` : sql`true`})
      order by d.created_at desc
      limit 300
    `;
    res.json({ data: rows });
  })
);

router.post(
  "/admin/doctors/:id/approve",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!(await isAdminReq(req))) return res.status(403).json({ error: "Admin access required" });
    const id = String(req.params.id || "");
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid id" });

    const [updated] = await sql`
      update medibondhu_doctors
      set ${sql({
        approval_status: "approved",
        rejection_reason: null,
        verified_by: req.userId,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })}
      where id = ${id}::uuid
      returning *
    `;
    if (!updated) return res.status(404).json({ error: "Doctor not found" });

    if (updated.user_id) {
      await sql`
        insert into user_roles ${sql({ user_id: updated.user_id, role: "doctor" })}
        on conflict (user_id, role) do nothing
      `;
      await sql`
        insert into user_capabilities ${sql({
          user_id: updated.user_id,
          capability_code: "can_practice_human",
          is_enabled: true,
          granted_by: req.userId,
        })}
        on conflict (user_id, capability_code) do update
        set is_enabled = true, granted_by = ${req.userId}
      `;
    }

    res.json({ data: updated });
  })
);

router.post(
  "/admin/doctors/:id/reject",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!(await isAdminReq(req))) return res.status(403).json({ error: "Admin access required" });
    const id = String(req.params.id || "");
    const reason = String(req.body?.rejection_reason || "Rejected").slice(0, 500);
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid id" });

    const [updated] = await sql`
      update medibondhu_doctors
      set ${sql({
        approval_status: "rejected",
        rejection_reason: reason,
        verified_by: req.userId,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })}
      where id = ${id}::uuid
      returning *
    `;
    if (!updated) return res.status(404).json({ error: "Doctor not found" });
    res.json({ data: updated });
  })
);

router.get(
  "/admin/appointments",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!(await isAdminReq(req))) return res.status(403).json({ error: "Admin access required" });
    const lim = readLimit(req.query.limit, 100, 300);
    const rows = await sql`
      select a.*,
        d.full_name as doctor_name,
        p.name as patient_name,
        p.email as patient_email
      from medibondhu_appointments a
      join medibondhu_doctors d on d.id = a.doctor_id
      join profiles p on p.id = a.patient_user_id
      order by a.created_at desc
      limit ${lim}
    `;
    res.json({ data: rows });
  })
);

export default router;