import postgres from "postgres";

/**
 * `DATABASE_URL` from the environment (see `.env.example`). If unset, `sql` is null so the app
 * can still boot for health checks; routes that need Postgres return 503 until it is configured.
 */
const connectionString = process.env.DATABASE_URL?.trim();
const poolMax = Math.max(1, Number(process.env.DB_POOL_MAX || 1));
const idleTimeoutSec = Math.max(1, Number(process.env.DB_IDLE_TIMEOUT_SEC || 20));
const connectTimeoutSec = Math.max(1, Number(process.env.DB_CONNECT_TIMEOUT_SEC || 10));

const sql = connectionString
  ? postgres(connectionString, {
      // Vercel serverless can create many runtimes; keep pool conservative by default.
      max: poolMax,
      idle_timeout: idleTimeoutSec,
      connect_timeout: connectTimeoutSec,
    })
  : null;

export default sql;

export async function dbHealthCheck() {
  if (!sql) return false;
  await sql`SELECT 1`;
  return true;
}
