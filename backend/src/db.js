import postgres from "postgres";

/**
 * `DATABASE_URL` from the environment (see `.env.example`). If unset, `sql` is null so the app
 * can still boot for health checks; routes that need Postgres return 503 until it is configured.
 */
const connectionString = process.env.DATABASE_URL?.trim();
const isVercel = process.env.VERCEL === "1";
const poolMaxDefault = isVercel ? 2 : 5;
const idleTimeoutDefault = isVercel ? 10 : 20;
const connectTimeoutDefault = isVercel ? 5 : 10;
const maxLifetimeDefault = isVercel ? 60 : 0;
const poolMax = Math.max(1, Number(process.env.DB_POOL_MAX || poolMaxDefault));
const idleTimeoutSec = Math.max(1, Number(process.env.DB_IDLE_TIMEOUT_SEC || idleTimeoutDefault));
const connectTimeoutSec = Math.max(1, Number(process.env.DB_CONNECT_TIMEOUT_SEC || connectTimeoutDefault));
const maxLifetimeSec = Math.max(0, Number(process.env.DB_MAX_LIFETIME_SEC || maxLifetimeDefault));

const sql = connectionString
  ? postgres(connectionString, {
      // Vercel serverless can create many runtimes; keep pool conservative by default.
      max: poolMax,
      idle_timeout: idleTimeoutSec,
      connect_timeout: connectTimeoutSec,
      max_lifetime: maxLifetimeSec,
    })
  : null;

export default sql;

export async function dbHealthCheck() {
  if (!sql) return false;
  await sql`SELECT 1`;
  return true;
}
