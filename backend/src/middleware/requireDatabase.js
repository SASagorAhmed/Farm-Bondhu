import sql from "../db.js";

/**
 * Ensures Postgres is configured before handlers that need `sql`.
 */
export function requireDatabase(req, res, next) {
  if (!sql) {
    res.status(503).json({ error: "DATABASE_URL not configured" });
    return;
  }
  next();
}
