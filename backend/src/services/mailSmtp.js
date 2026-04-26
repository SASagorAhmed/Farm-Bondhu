import nodemailer from "nodemailer";

function smtpConfig() {
  const host = (process.env.SMTP_HOST || "smtp-relay.brevo.com").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user =
    process.env.SMTP_USER?.trim() ||
    process.env.SMTP_LOGIN?.trim() ||
    process.env.BREVO_SMTP_USER?.trim();
  const pass =
    process.env.SMTP_PASS?.trim() ||
    process.env.SMTP_KEY?.trim() ||
    process.env.SMTP_PASSWORD?.trim() ||
    process.env.BREVO_SMTP_PASSWORD?.trim();
  const from = process.env.MAIL_FROM?.trim();
  return { host, port, user, pass, from };
}

export function isSmtpConfigured() {
  const { user, pass, from } = smtpConfig();
  return Boolean(user && pass && from);
}

/** True if we can send mail via SMTP or Brevo Transactional API. */
export function isMailConfigured() {
  if (isSmtpConfigured()) return true;
  const key = process.env.BREVO_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  return Boolean(key && from);
}

/** @returns {import("nodemailer").Transporter | null} */
export function createMailer() {
  const { host, port, user, pass } = smtpConfig();
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/** @param {string} mailFrom */
function parseSender(mailFrom) {
  const s = String(mailFrom).trim();
  const lt = s.indexOf("<");
  const gt = s.indexOf(">", lt + 1);
  if (lt !== -1 && gt !== -1) {
    const email = s.slice(lt + 1, gt).trim();
    const name = s.slice(0, lt).replace(/"/g, "").trim() || "FarmBondhu";
    return { name, email };
  }
  return { name: "FarmBondhu", email: s };
}

/**
 * @param {{ to: string; subject: string; text: string; html?: string }} opts
 */
async function sendWithBrevoTransactionalApi(opts) {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const mailFrom = process.env.MAIL_FROM?.trim();
  if (!apiKey || !mailFrom) {
    throw new Error("BREVO_API_KEY and MAIL_FROM are required for Brevo API email");
  }
  const sender = parseSender(mailFrom);
  const html = opts.html || opts.text.replace(/\n/g, "<br/>");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: sender.name, email: sender.email },
      to: [{ email: opts.to }],
      subject: opts.subject,
      textContent: opts.text,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Brevo API HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
}

/**
 * @param {{ to: string; subject: string; text: string; html?: string }} opts
 */
export async function sendMailMessage(opts) {
  const { from } = smtpConfig();
  if (!from) throw new Error("MAIL_FROM is not configured");

  if (isSmtpConfigured()) {
    const transport = createMailer();
    if (!transport) throw new Error("SMTP is misconfigured");
    await transport.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html || opts.text.replace(/\n/g, "<br/>"),
    });
    return;
  }

  if (process.env.BREVO_API_KEY?.trim()) {
    await sendWithBrevoTransactionalApi(opts);
    return;
  }

  throw new Error(
    "Email not configured: set SMTP_USER + SMTP_PASS + MAIL_FROM, or BREVO_API_KEY + MAIL_FROM (verified sender)."
  );
}

/**
 * @param {{ to: string; code: string; minutesValid: number }} p
 */
export async function sendRegistrationOtpEmail(p) {
  const { to, code, minutesValid } = p;
  await sendMailMessage({
    to,
    subject: "Your FarmBondhu verification code",
    text: [
      "Use this code to finish creating your FarmBondhu account:",
      "",
      `  ${code}`,
      "",
      `This code expires in ${minutesValid} minutes.`,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
  });
}

/**
 * @param {{ to: string; code: string; minutesValid: number }} p
 */
export async function sendPasswordResetOtpEmail(p) {
  const { to, code, minutesValid } = p;
  await sendMailMessage({
    to,
    subject: "Your FarmBondhu password reset code",
    text: [
      "Use this code to reset your FarmBondhu password:",
      "",
      `  ${code}`,
      "",
      `This code expires in ${minutesValid} minutes.`,
      "",
      "If you did not request a password reset, you can ignore this email.",
    ].join("\n"),
  });
}
