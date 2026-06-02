import sql from "../db.js";

const PREVIEW_MAX = 500;

/**
 * @param {string} text
 * @param {Record<string, string>} [secretValues]
 */
export function sanitizeBodyPreview(text, secretValues = {}) {
  let out = String(text || "");
  for (const value of Object.values(secretValues)) {
    if (value && String(value).length >= 4) {
      out = out.split(String(value)).join("[REDACTED]");
    }
  }
  out = out.replace(/\b\d{6}\b/g, "[REDACTED]");
  if (out.length > PREVIEW_MAX) {
    return `${out.slice(0, PREVIEW_MAX).trim()}…`;
  }
  return out.trim();
}

/**
 * @param {{
 *   emailType: string;
 *   category: string;
 *   to: string;
 *   subject: string;
 *   text?: string;
 *   status: "sent" | "failed";
 *   error?: string | null;
 *   sensitiveFields?: Record<string, string>;
 *   metadata?: Record<string, unknown>;
 *   provider?: string | null;
 *   secretValues?: Record<string, string>;
 * }} opts
 */
export async function logEmailAudit(opts) {
  try {
    const sensitiveFields = opts.sensitiveFields || {};
    const metadata = opts.metadata || {};
    const bodyPreview = sanitizeBodyPreview(opts.text || "", opts.secretValues || {});

    await sql`
      insert into email_audit_log ${sql({
        email_type: opts.emailType,
        category: opts.category,
        recipient_email: String(opts.to || "").trim(),
        subject: String(opts.subject || "").trim(),
        status: opts.status,
        error_message: opts.error ? String(opts.error).slice(0, 500) : null,
        body_preview: bodyPreview || null,
        sensitive_fields: sensitiveFields,
        metadata,
        provider: opts.provider || null,
        created_at: new Date().toISOString(),
      })}
    `;
  } catch (err) {
    console.error("[emailAuditLog] insert failed:", err?.message || err);
  }
}
