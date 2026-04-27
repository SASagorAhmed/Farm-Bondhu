import "dotenv/config";
import app from "./app.js";
import sql from "./db.js";
import { config } from "./config.js";
import { ensureSchema } from "./db/ensureSchema.js";
import { checkAllConnections } from "./services/connectivity.js";
import { registrationSecretConfigError } from "./services/registrationCrypto.js";

const server = app.listen(config.port, async () => {
  console.log(
    `[farmbondhu-api] listening on http://localhost:${config.port} (${config.nodeEnv})`
  );
  if (sql && config.autoCreateSchema) {
    try {
      await ensureSchema(sql);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[farmbondhu-api] Schema bootstrap failed:", msg);
    }
  } else if (sql && !config.autoCreateSchema) {
    console.log("[farmbondhu-api] AUTO_CREATE_SCHEMA=false — skipping DDL bootstrap");
  }
  // Full connectivity diagnostics are useful in local dev, but add startup overhead in production.
  if (config.nodeEnv !== "production") {
    void logStartupConnectivity();
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[farmbondhu-api] Port ${config.port} is still in use.\n` +
        `  Run: npm run dev (predev clears this port), or close the other process on ${config.port}.`
    );
    process.exit(1);
  }
  throw err;
});

/** Order and human-readable OK lines for startup console */
const SERVICE_ORDER = [
  "database",
  "supabase",
  "cloudinary",
  "openrouter",
  "brevo",
  "zego",
];

function formatServiceConsoleLine(name, service) {
  if (service.ok) {
    const okText = {
      database: "connected (PostgreSQL reachable)",
      supabase: "REST reachable (optional; auth does not use it)",
      cloudinary: "connected",
      openrouter: "connected",
      brevo: "connected",
      zego:
        "credentials present (ready; runtime token endpoint can be added next)",
    };
    return `${name}: ${service.details || okText[name] || "connected"}`;
  }
  const reason = service.error || "failed";
  if (!service.configured) {
    return `${name}: not configured — ${reason}`;
  }
  return `${name}: FAILED — ${reason}`;
}

async function logStartupConnectivity() {
  if (!config.databaseConfigured) {
    console.warn(
      "[farmbondhu-api] DATABASE_URL not set — database and /api/health/db will be unavailable until configured."
    );
  }

  const jwtSecret =
    process.env.AUTH_JWT_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    process.env.SUPABASE_JWT_SECRET?.trim();
  if (!jwtSecret) {
    console.error(
      "[farmbondhu-api] AUTH_JWT_SECRET is empty — GET /api/v1/me and other Bearer routes will fail.\n" +
        "  Set AUTH_JWT_SECRET in .env (min 16 characters; used to sign access/refresh tokens)."
    );
  }

  const regSecretErr = registrationSecretConfigError();
  if (regSecretErr) {
    console.error(
      `[farmbondhu-api] ${regSecretErr}\n` +
        "  Registration send-otp / verify-otp will return 503 until REGISTRATION_SECRET is set."
    );
  }

  try {
    const result = await checkAllConnections();
    console.log("[farmbondhu-api] Connectivity (npm run dev):");
    for (const name of SERVICE_ORDER) {
      const service = result.services[name];
      if (!service) continue;
      const line = formatServiceConsoleLine(name, service);
      if (service.ok) {
        console.log(`[farmbondhu-api]   ${line}`);
      } else {
        console.error(`[farmbondhu-api]   ${line}`);
      }
    }
    if (!result.ok) {
      console.warn(
        "[farmbondhu-api] One or more services failed — fix .env or network, then restart. Full JSON: GET /api/health/services"
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[farmbondhu-api] Connectivity check crashed:", msg);
  }
}

const shutdown = (signal) => {
  console.log(`[farmbondhu-api] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
