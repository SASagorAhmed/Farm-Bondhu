import { Router } from "express";
import { config } from "../config.js";
import { dbHealthCheck } from "../db.js";
import { checkAllConnections } from "../services/connectivity.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "farmbondhu-api",
    time: new Date().toISOString(),
    env: config.nodeEnv,
    databaseConfigured: config.databaseConfigured,
  });
});

router.get("/db", async (req, res, next) => {
  if (!config.databaseConfigured) {
    res.status(503).json({
      ok: false,
      error: "DATABASE_URL not configured",
    });
    return;
  }
  try {
    const ok = await dbHealthCheck();
    res.json({ ok, database: ok ? "reachable" : "failed" });
  } catch (e) {
    next(e);
  }
});

router.get("/services", async (req, res, next) => {
  try {
    const summary = await checkAllConnections();
    res.status(summary.ok ? 200 : 503).json(summary);
  } catch (e) {
    next(e);
  }
});

export default router;
