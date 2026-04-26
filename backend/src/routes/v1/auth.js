import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireUser } from "../../middleware/requireUser.js";
import sql from "../../db.js";
import {
  ensureProfileAndRoleAfterAuth,
  extractUserFromSession,
} from "../../services/ensureAppUser.js";
import { encryptPassword, registrationSecretConfigError } from "../../services/registrationCrypto.js";
import {
  isMailConfigured,
  sendRegistrationOtpEmail,
  sendPasswordResetOtpEmail,
} from "../../services/mailSmtp.js";
import { createAuthSession, refreshAuthSession } from "../../services/localAuth.js";

const router = Router();

const OTP_TTL_MIN = 15;
const RESEND_COOLDOWN_SEC = 60;
const MAX_OTP_ATTEMPTS = 5;

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function randomSixDigitOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

router.post(
  "/sign-in",
  asyncHandler(async (req, res) => {
    if (!sql) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    const em = normalizeEmail(email);
    const [row] = await sql`
      select p.id, p.email, c.password_hash
      from profiles p
      inner join auth_credentials c on c.user_id = p.id
      where lower(trim(p.email)) = ${em}
      limit 1
    `;
    if (!row) {
      res.status(401).json({ error: "Invalid email or password. Use Forgot password if you need to reset your password." });
      return;
    }
    const match = await bcrypt.compare(String(password), row.password_hash);
    if (!match) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const session = await createAuthSession(row.id, row.email);
    const user = extractUserFromSession(session);
    if (user) await ensureProfileAndRoleAfterAuth(user, {});
    res.json(session);
  })
);

router.post(
  "/sign-up",
  asyncHandler(async (req, res) => {
    res.status(400).json({
      error:
        "Use email verification: POST /api/v1/auth/register/send-otp then register/verify-otp with the code sent to your inbox.",
    });
  })
);

router.post(
  "/register/send-otp",
  asyncHandler(async (req, res) => {
    if (!sql) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }
    const regSecretErr = registrationSecretConfigError();
    if (regSecretErr) {
      res.status(503).json({ error: regSecretErr });
      return;
    }
    if (!isMailConfigured()) {
      res.status(503).json({
        error:
          "Email is not configured. Set BREVO_API_KEY + MAIL_FROM, or SMTP_USER + SMTP_PASS + MAIL_FROM.",
      });
      return;
    }

    const { email, password, data } = req.body || {};
    const em = normalizeEmail(email);
    if (!em || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    if (String(password).length < 6) {
      res.status(400).json({ error: "password must be at least 6 characters" });
      return;
    }

    const [alreadyRegistered] = await sql`
      select id
      from profiles
      where lower(trim(email)) = ${em}
      limit 1
    `;
    if (alreadyRegistered) {
      res.status(409).json({ error: "This email is already registered. Try signing in." });
      return;
    }

    let enc;
    try {
      enc = encryptPassword(String(password));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(503).json({ error: msg });
      return;
    }

    const [existing] = await sql`
      select last_sent_at from registration_pending where email = ${em} limit 1
    `;
    if (existing?.last_sent_at) {
      const delta = Date.now() - new Date(existing.last_sent_at).getTime();
      if (delta < RESEND_COOLDOWN_SEC * 1000) {
        const wait = Math.ceil((RESEND_COOLDOWN_SEC * 1000 - delta) / 1000);
        res.status(429).json({ error: `Please wait ${wait}s before requesting another code.` });
        return;
      }
    }

    const otp = randomSixDigitOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);
    const profileData = typeof data === "object" && data !== null ? data : {};

    await sql`
      insert into registration_pending ${sql({
        email: em,
        password_cipher: enc.cipher,
        password_iv: enc.iv,
        password_tag: enc.tag,
        profile_data: profileData,
        otp_hash: otpHash,
        expires_at: expiresAt,
        verify_attempts: 0,
        last_sent_at: new Date(),
      })}
      on conflict (email) do update set
        password_cipher = excluded.password_cipher,
        password_iv = excluded.password_iv,
        password_tag = excluded.password_tag,
        profile_data = excluded.profile_data,
        otp_hash = excluded.otp_hash,
        expires_at = excluded.expires_at,
        verify_attempts = 0,
        last_sent_at = excluded.last_sent_at
    `;

    try {
      await sendRegistrationOtpEmail({ to: em, code: otp, minutesValid: OTP_TTL_MIN });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[auth] send OTP email failed:", msg);
      await sql`delete from registration_pending where email = ${em}`;
      res.status(502).json({ error: `Failed to send verification email: ${msg}` });
      return;
    }

    res.status(202).json({ ok: true, email: em });
  })
);

router.post(
  "/register/resend-otp",
  asyncHandler(async (req, res) => {
    if (!sql) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }
    if (!isMailConfigured()) {
      res.status(503).json({ error: "Email is not configured (Brevo API or SMTP + MAIL_FROM)." });
      return;
    }

    const em = normalizeEmail(req.body?.email);
    if (!em) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    const [row] = await sql`
      select last_sent_at from registration_pending where email = ${em} limit 1
    `;
    if (!row) {
      res.status(404).json({ error: "No pending registration for this email. Start again from send-otp." });
      return;
    }
    const delta = Date.now() - new Date(row.last_sent_at).getTime();
    if (delta < RESEND_COOLDOWN_SEC * 1000) {
      const wait = Math.ceil((RESEND_COOLDOWN_SEC * 1000 - delta) / 1000);
      res.status(429).json({ error: `Please wait ${wait}s before resending.` });
      return;
    }

    const otp = randomSixDigitOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);

    await sql`
      update registration_pending
      set otp_hash = ${otpHash},
          expires_at = ${expiresAt},
          verify_attempts = 0,
          last_sent_at = now()
      where email = ${em}
    `;

    try {
      await sendRegistrationOtpEmail({ to: em, code: otp, minutesValid: OTP_TTL_MIN });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[auth] resend OTP email failed:", msg);
      res.status(502).json({ error: "Failed to send email." });
      return;
    }

    res.status(202).json({ ok: true });
  })
);

router.post(
  "/register/verify-otp",
  asyncHandler(async (req, res) => {
    if (!sql) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }
    const regSecretErrVerify = registrationSecretConfigError();
    if (regSecretErrVerify) {
      res.status(503).json({ error: regSecretErrVerify });
      return;
    }
    const em = normalizeEmail(req.body?.email);
    const code = String(req.body?.otp ?? req.body?.code ?? "").trim();
    if (!em || !/^\d{6}$/.test(code)) {
      res.status(400).json({ error: "email and a 6-digit otp are required" });
      return;
    }

    const [row] = await sql`
      select *
      from registration_pending
      where email = ${em}
      limit 1
    `;
    if (!row) {
      res.status(400).json({ error: "No pending registration. Request a new code." });
      return;
    }
    if (new Date(row.expires_at) < new Date()) {
      await sql`delete from registration_pending where email = ${em}`;
      res.status(400).json({ error: "Code expired. Request a new code." });
      return;
    }
    if (row.verify_attempts >= MAX_OTP_ATTEMPTS) {
      await sql`delete from registration_pending where email = ${em}`;
      res.status(400).json({ error: "Too many failed attempts. Start registration again." });
      return;
    }

    const ok = await bcrypt.compare(code, row.otp_hash);
    if (!ok) {
      await sql`
        update registration_pending
        set verify_attempts = verify_attempts + 1
        where email = ${em}
      `;
      res.status(400).json({ error: "Invalid verification code." });
      return;
    }

    const { decryptPassword } = await import("../../services/registrationCrypto.js");
    let plainPassword;
    try {
      plainPassword = decryptPassword({
        cipher: row.password_cipher,
        iv: row.password_iv,
        tag: row.password_tag,
      });
    } catch (e) {
      console.error("[auth] decrypt pending password failed:", e);
      await sql`delete from registration_pending where email = ${em}`;
      res.status(500).json({ error: "Registration state is invalid. Please start again." });
      return;
    }

    const profileData =
      row.profile_data && typeof row.profile_data === "object" ? row.profile_data : {};

    const [dup] = await sql`
      select id from profiles where lower(trim(email)) = ${em} limit 1
    `;
    if (dup) {
      await sql`delete from registration_pending where email = ${em}`;
      res.status(409).json({ error: "This email is already registered. Try signing in." });
      return;
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const meta = profileData;
    const name =
      String(meta.name || (em ? em.split("@")[0] : "User"))
        .trim()
        .slice(0, 200) || "User";
    const primary_role = String(meta.primary_role || "farmer").toLowerCase();
    const phone = meta.phone != null && meta.phone !== "" ? String(meta.phone) : null;
    const location = meta.location != null && meta.location !== "" ? String(meta.location) : null;
    const roleSet = new Set(["farmer", "buyer", "vendor", "vet", "admin"]);
    const pr = roleSet.has(primary_role) ? primary_role : "farmer";

    try {
      await sql`
        insert into profiles (id, email, name, primary_role, phone, location, created_at, updated_at)
        values (${userId}, ${em}, ${name}, ${pr}, ${phone}, ${location}, now(), now())
      `;
      await sql`
        insert into auth_credentials (user_id, password_hash, updated_at)
        values (${userId}, ${passwordHash}, now())
      `;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[auth] create local user failed:", msg);
      await sql`delete from profiles where id = ${userId}`;
      res.status(500).json({ error: "Could not create account." });
      return;
    }

    await sql`delete from registration_pending where email = ${em}`;

    const userStub = { id: userId, email: em, user_metadata: profileData };
    await ensureProfileAndRoleAfterAuth(/** @type {any} */ (userStub), profileData);

    let session;
    try {
      session = await createAuthSession(userId, em);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[auth] issue session after register failed:", msg);
      res.status(500).json({ error: msg || "Account created but session failed. Set AUTH_JWT_SECRET and try signing in." });
      return;
    }

    const user = extractUserFromSession(session);
    if (user) await ensureProfileAndRoleAfterAuth(user, profileData);
    res.status(201).json(session);
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refresh_token: refreshToken } = req.body || {};
    if (!refreshToken) {
      res.status(400).json({ error: "refresh_token is required" });
      return;
    }
    try {
      const session = await refreshAuthSession(refreshToken);
      res.json(session);
    } catch (e) {
      const status = /** @type {{ status?: number }} */ (e).status || 401;
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("AUTH_JWT_SECRET") || msg.includes("JWT_SECRET")) {
        res.status(503).json({ error: "Server auth is not configured (AUTH_JWT_SECRET)." });
        return;
      }
      res.status(status).json({ error: msg || "Invalid refresh token" });
    }
  })
);

router.post(
  "/sign-out",
  asyncHandler(async (_req, res) => {
    res.status(204).end();
  })
);

router.post(
  "/recover/send-otp",
  asyncHandler(async (req, res) => {
    if (!sql) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }
    if (!isMailConfigured()) {
      res.status(503).json({
        error: "Email is not configured. Set BREVO_API_KEY + MAIL_FROM, or SMTP + MAIL_FROM.",
      });
      return;
    }

    const em = normalizeEmail(req.body?.email);
    if (!em) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    const [acct] = await sql`
      select p.id as user_id
      from profiles p
      inner join auth_credentials c on c.user_id = p.id
      where lower(trim(p.email)) = ${em}
      limit 1
    `;
    const userId = acct?.user_id || null;

    if (userId) {
      const [existing] = await sql`
        select last_sent_at from password_reset_pending where email = ${em} limit 1
      `;
      if (existing?.last_sent_at) {
        const delta = Date.now() - new Date(existing.last_sent_at).getTime();
        if (delta < RESEND_COOLDOWN_SEC * 1000) {
          const wait = Math.ceil((RESEND_COOLDOWN_SEC * 1000 - delta) / 1000);
          res.status(429).json({ error: `Please wait ${wait}s before requesting another code.` });
          return;
        }
      }

      const otp = randomSixDigitOtp();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);

      await sql`
        insert into password_reset_pending ${sql({
          email: em,
          user_id: userId,
          otp_hash: otpHash,
          expires_at: expiresAt,
          verify_attempts: 0,
          last_sent_at: new Date(),
        })}
        on conflict (email) do update set
          user_id = excluded.user_id,
          otp_hash = excluded.otp_hash,
          expires_at = excluded.expires_at,
          verify_attempts = 0,
          last_sent_at = excluded.last_sent_at
      `;

      try {
        await sendPasswordResetOtpEmail({ to: em, code: otp, minutesValid: OTP_TTL_MIN });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[auth] password reset email failed:", msg);
        await sql`delete from password_reset_pending where email = ${em}`;
        res.status(502).json({ error: `Failed to send reset email: ${msg}` });
        return;
      }
    }

    const delayMs = userId ? 60 : 220 + Math.floor(Math.random() * 180);
    await new Promise((r) => setTimeout(r, delayMs));
    res.status(202).json({ ok: true });
  })
);

router.post(
  "/recover/resend-otp",
  asyncHandler(async (req, res) => {
    if (!sql) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }
    if (!isMailConfigured()) {
      res.status(503).json({ error: "Email is not configured." });
      return;
    }

    const em = normalizeEmail(req.body?.email);
    if (!em) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    const [row] = await sql`
      select last_sent_at, user_id from password_reset_pending where email = ${em} limit 1
    `;
    if (!row?.user_id) {
      await new Promise((r) => setTimeout(r, 200));
      res.status(202).json({ ok: true });
      return;
    }
    const delta = Date.now() - new Date(row.last_sent_at).getTime();
    if (delta < RESEND_COOLDOWN_SEC * 1000) {
      const wait = Math.ceil((RESEND_COOLDOWN_SEC * 1000 - delta) / 1000);
      res.status(429).json({ error: `Please wait ${wait}s before resending.` });
      return;
    }

    const otp = randomSixDigitOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);

    await sql`
      update password_reset_pending
      set otp_hash = ${otpHash},
          expires_at = ${expiresAt},
          verify_attempts = 0,
          last_sent_at = now()
      where email = ${em}
    `;

    try {
      await sendPasswordResetOtpEmail({ to: em, code: otp, minutesValid: OTP_TTL_MIN });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[auth] password reset resend failed:", msg);
      res.status(502).json({ error: "Failed to send email." });
      return;
    }

    res.status(202).json({ ok: true });
  })
);

router.post(
  "/recover/verify-otp",
  asyncHandler(async (req, res) => {
    if (!sql) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }

    const em = normalizeEmail(req.body?.email);
    const code = String(req.body?.otp ?? req.body?.code ?? "").trim();
    const newPassword = req.body?.new_password ?? req.body?.password;
    if (!em || !/^\d{6}$/.test(code)) {
      res.status(400).json({ error: "email and a 6-digit otp are required" });
      return;
    }
    if (!newPassword || String(newPassword).length < 6) {
      res.status(400).json({ error: "new_password must be at least 6 characters" });
      return;
    }

    const [row] = await sql`
      select * from password_reset_pending where email = ${em} limit 1
    `;
    if (!row) {
      res.status(400).json({ error: "No active reset for this email. Request a new code." });
      return;
    }
    if (new Date(row.expires_at) < new Date()) {
      await sql`delete from password_reset_pending where email = ${em}`;
      res.status(400).json({ error: "Code expired. Request a new code." });
      return;
    }
    if (row.verify_attempts >= MAX_OTP_ATTEMPTS) {
      await sql`delete from password_reset_pending where email = ${em}`;
      res.status(400).json({ error: "Too many failed attempts. Start password reset again." });
      return;
    }

    const ok = await bcrypt.compare(code, row.otp_hash);
    if (!ok) {
      await sql`
        update password_reset_pending
        set verify_attempts = verify_attempts + 1
        where email = ${em}
      `;
      res.status(400).json({ error: "Invalid verification code." });
      return;
    }

    const hash = await bcrypt.hash(String(newPassword), 10);
    await sql`
      update auth_credentials
      set password_hash = ${hash}, updated_at = now()
      where user_id = ${row.user_id}
    `;

    await sql`delete from password_reset_pending where email = ${em}`;
    res.status(204).end();
  })
);

router.post(
  "/recover",
  asyncHandler(async (_req, res) => {
    res.status(400).json({
      error:
        "Use the password reset flow: POST /api/v1/auth/recover/send-otp then recover/verify-otp with the code from your email.",
    });
  })
);

router.put(
  "/user",
  requireUser,
  asyncHandler(async (req, res) => {
    if (!sql) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }
    const { password, data } = req.body || {};
    if (password !== undefined) {
      if (String(password).length < 6) {
        res.status(400).json({ error: "password must be at least 6 characters" });
        return;
      }
      const hash = await bcrypt.hash(String(password), 10);
      await sql`
        update auth_credentials set password_hash = ${hash}, updated_at = now()
        where user_id = ${req.userId}
      `;
    }
    if (data !== undefined && typeof data === "object" && data !== null) {
      const patch = {};
      for (const k of ["name", "phone", "location", "primary_role", "avatar_url"]) {
        if (data[k] !== undefined) patch[k] = data[k];
      }
      if (Object.keys(patch).length > 0) {
        patch.updated_at = new Date().toISOString();
        await sql`update profiles set ${sql(patch)} where id = ${req.userId}`;
      }
    }
    if (password === undefined && (data === undefined || typeof data !== "object")) {
      res.status(400).json({ error: "Provide password and/or data" });
      return;
    }
    res.json({ user: { id: req.userId } });
  })
);

export default router;
