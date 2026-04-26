/**
 * Central config (load dotenv in server.js before importing app).
 */
export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  /**
   * Fixed HTTP port for this API (default 3001).
   * Use BACKEND_PORT in .env — not shell PORT — so IDE PORT=3000 does not override .env.
   */
  port: Number(process.env.BACKEND_PORT || process.env.PORT) || 3001,
  /** Comma-separated origins for CORS (e.g. http://localhost:5173,https://your-app.vercel.app) */
  corsOrigins: (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /** True when DATABASE_URL is set — enables /api/health/db */
  databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
  /**
   * On startup, ensure core `public.*` tables exist (CREATE IF NOT EXISTS + column patches).
   * Set AUTO_CREATE_SCHEMA=false when a migration tool owns DDL (e.g. strict production).
   */
  autoCreateSchema: process.env.AUTO_CREATE_SCHEMA !== "false",
  /** Optional: public URL of this API (e.g. for links / webhooks) */
  apiPublicUrl: process.env.API_PUBLIC_URL?.trim() || "",
};
