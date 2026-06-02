import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import {
  listModerationReports,
  resolveMarketplaceReport,
} from "../../services/adminModerationReports.js";

const router = Router();
const UUID_RE = /^[0-9a-f-]{36}$/i;

router.get(
  "/moderation-reports",
  requireDatabase,
  requireUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const type = String(req.query.type || "all").toLowerCase();
    const status = String(req.query.status || "pending").toLowerCase();
    const data = await listModerationReports(sql, { type, status });
    res.json({ data });
  })
);

router.patch(
  "/moderation-reports/marketplace/:id",
  requireDatabase,
  requireUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || "");
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: "Invalid report id" });
      return;
    }
    const updated = await resolveMarketplaceReport(sql, id);
    if (!updated) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    res.json({ data: updated });
  })
);

export default router;
