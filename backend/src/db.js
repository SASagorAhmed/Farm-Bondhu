import postgres from "postgres";

/**
 * `DATABASE_URL` from the environment (see `.env.example`). If unset, `sql` is null so the app
 * can still boot for health checks; routes that need Postgres return 503 until it is configured.
 */
const connectionString = process.env.DATABASE_URL?.trim();

const sql = connectionString
  ? postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  : null;

export default sql;

export async function dbHealthCheck() {
  if (!sql) return false;
  await sql`SELECT 1`;
  return true;
}
