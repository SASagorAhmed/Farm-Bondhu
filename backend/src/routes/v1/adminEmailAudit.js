import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";

const router = Router();
const chain = [requireDatabase, requireUser, requireAdmin];

router.get(
  "/email-audit/stats",
  ...chain,
  asyncHandler(async (_req, res) => {
    const rows = await sql`
      select
        email_type,
        count(*) filter (where status = 'sent')::int as sent,
        count(*) filter (where status = 'failed')::int as failed,
        count(*)::int as total
      from email_audit_log
      where created_at >= now() - interval '7 days'
      group by email_type
      order by total desc
    `;
    const [{ total_24h }] = await sql`
      select count(*)::int as total_24h
      from email_audit_log
      where created_at >= now() - interval '24 hours'
    `;
    res.json({ data: { byType: rows, total24h: total_24h ?? 0 } });
  })
);

router.get(
  "/email-audit",
  ...chain,
  asyncHandler(async (req, res) => {
    const type = String(req.query.type || "").trim();
    const status = String(req.query.status || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const rows = await sql`
      select
        id,
        created_at,
        email_type,
        category,
        recipient_email,
        subject,
        status,
        error_message,
        body_preview,
        sensitive_fields,
        metadata,
        provider
      from email_audit_log
      where (${type} = '' or email_type = ${type})
        and (${status} = '' or status = ${status})
      order by created_at desc
      limit ${limit}
      offset ${offset}
    `;

    const [{ count }] = await sql`
      select count(*)::int as count
      from email_audit_log
      where (${type} = '' or email_type = ${type})
        and (${status} = '' or status = ${status})
    `;

    res.json({ data: rows, total: count ?? 0, limit, offset });
  })
);

export default router;
