import "dotenv/config";
import app from "../src/app.js";
import { ensureSchema } from "../src/db/ensureSchema.js";
import sql from "../src/db.js";
import { config } from "../src/config.js";

let schemaReady;

async function ensureSchemaOnce() {
  if (!sql || !config.autoCreateSchema) return;
  if (!schemaReady) {
    schemaReady = ensureSchema(sql).catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

export default async function handler(req, res) {
  try {
    await ensureSchemaOnce();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[farmbondhu-api] Vercel schema bootstrap failed:", message);
  }
  return app(req, res);
}
