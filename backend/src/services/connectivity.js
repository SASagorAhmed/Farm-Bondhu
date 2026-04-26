import { dbHealthCheck } from "../db.js";
import { isSmtpConfigured } from "./mailSmtp.js";

const REQUEST_TIMEOUT_MS = 8000;

function withTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  );
}

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function checkDatabase() {
  const configured = Boolean(trim(process.env.DATABASE_URL));
  if (!configured) {
    return { configured, ok: false, error: "DATABASE_URL is missing" };
  }
  try {
    const ok = await dbHealthCheck();
    return { configured, ok, details: ok ? "PostgreSQL reachable" : undefined };
  } catch (error) {
    return {
      configured,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkSupabase() {
  const url = trim(process.env.SUPABASE_URL);
  const key =
    trim(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    trim(process.env.SUPABASE_ANON_KEY);
  if (!url || !key) {
    return {
      configured: false,
      ok: true,
      details: "Not used — API auth is Postgres + JWT (AUTH_JWT_SECRET); only DATABASE_URL is required.",
    };
  }
  const configured = true;
  try {
    const response = await withTimeout(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!response.ok) {
      return {
        configured,
        ok: false,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }
    return { configured, ok: true, details: "Supabase REST is reachable (optional)" };
  } catch (error) {
    return {
      configured,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkCloudinary() {
  const cloudName = trim(process.env.CLOUDINARY_CLOUD_NAME);
  const apiKey = trim(process.env.CLOUDINARY_API_KEY);
  const apiSecret = trim(process.env.CLOUDINARY_API_SECRET);
  const configured = Boolean(cloudName && apiKey && apiSecret);
  if (!configured) {
    return {
      configured,
      ok: false,
      error: "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET are required",
    };
  }
  try {
    const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
    const response = await withTimeout(
      `https://api.cloudinary.com/v1_1/${cloudName}/ping`,
      {
        headers: { Authorization: authHeader },
      }
    );
    if (!response.ok) {
      return {
        configured,
        ok: false,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }
    return { configured, ok: true, details: "Cloudinary API is reachable" };
  } catch (error) {
    return {
      configured,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkOpenRouter() {
  const apiKey = trim(process.env.OPENROUTER_API_KEY);
  const configured = Boolean(apiKey);
  if (!configured) {
    return { configured, ok: false, error: "OPENROUTER_API_KEY is missing" };
  }
  try {
    const response = await withTimeout("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) {
      return {
        configured,
        ok: false,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }
    return { configured, ok: true, details: "OpenRouter API is reachable" };
  } catch (error) {
    return {
      configured,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkBrevo() {
  if (isSmtpConfigured()) {
    return {
      configured: true,
      ok: true,
      details: "SMTP is configured (e.g. Brevo SMTP) for OTP / transactional mail",
    };
  }
  const apiKey = trim(process.env.BREVO_API_KEY);
  const configured = Boolean(apiKey && trim(process.env.MAIL_FROM));
  if (!configured) {
    return {
      configured: false,
      ok: false,
      error: "Transactional mail: set BREVO_API_KEY + MAIL_FROM, or SMTP_USER + SMTP_PASS + MAIL_FROM",
    };
  }
  try {
    const response = await withTimeout("https://api.brevo.com/v3/account", {
      headers: {
        "api-key": apiKey,
      },
    });
    if (!response.ok) {
      return {
        configured,
        ok: false,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }
    return { configured, ok: true, details: "Brevo API key OK (transactional email)" };
  } catch (error) {
    return {
      configured,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkZegoConfig() {
  const appId = trim(process.env.ZEGOCLOUD_APP_ID);
  const serverSecret = trim(process.env.ZEGOCLOUD_SERVER_SECRET);
  const configured = Boolean(appId && serverSecret);
  if (!configured) {
    return {
      configured,
      ok: false,
      error: "ZEGOCLOUD_APP_ID and ZEGOCLOUD_SERVER_SECRET are required",
    };
  }
  return {
    configured,
    ok: true,
    details:
      "Credentials are present. Runtime token verification endpoint can be added next.",
  };
}

export async function checkAllConnections() {
  const [database, supabase, cloudinary, openrouter, brevo] = await Promise.all([
    checkDatabase(),
    checkSupabase(),
    checkCloudinary(),
    checkOpenRouter(),
    checkBrevo(),
  ]);

  const zego = checkZegoConfig();
  const services = { database, supabase, cloudinary, openrouter, brevo, zego };
  const ok = Object.values(services).every((service) => service.ok);
  return {
    ok,
    checkedAt: new Date().toISOString(),
    services,
  };
}
