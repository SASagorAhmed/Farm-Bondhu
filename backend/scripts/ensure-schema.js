/**
 * One-off DDL: create/patch core tables (includes MediBondhu human tables).
 * Use when AUTO_CREATE_SCHEMA=false but the database is missing tables.
 *
 *   cd backend && npm run db:ensure
 */
import "dotenv/config";
import sql from "../src/db.js";
import { ensureSchema } from "../src/db/ensureSchema.js";

async function main() {
  if (!sql) {
    console.error("[db:ensure] DATABASE_URL is not set.");
    process.exit(1);
  }
  try {
    await ensureSchema(sql);
    console.log("[db:ensure] Done.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[db:ensure] Failed:", msg);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
