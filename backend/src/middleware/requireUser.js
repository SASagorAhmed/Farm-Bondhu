import { verifyAccessTokenPayload } from "../services/localAuth.js";

/**
 * Verifies app-issued access JWT (HS256) using AUTH_JWT_SECRET (or JWT_SECRET / legacy SUPABASE_JWT_SECRET).
 * Sets req.userId and req.authPayload.
 */
export async function requireUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization: Bearer <access_token>" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = await verifyAccessTokenPayload(token);
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) {
      res.status(401).json({ error: "Invalid token: missing subject" });
      return;
    }
    req.userId = sub;
    req.authPayload = payload;
    next();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("AUTH_JWT_SECRET") || msg.includes("JWT_SECRET")) {
      res.status(503).json({ error: "Server auth is not configured (set AUTH_JWT_SECRET)." });
      return;
    }
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}
