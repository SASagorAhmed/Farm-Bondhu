export const TRANSIENT_AI_STATUSES = new Set([404, 408, 429, 502, 503]);

export function safeAiDetail(text, limit = 500) {
  return String(text || "")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]")
    .replace(/(key|api[_-]?key)["':=\s]+[A-Za-z0-9._~+/=-]{12,}/gi, "$1=[REDACTED]")
    .slice(0, limit);
}

export function providerSetting(name, fallback = "openrouter") {
  const value = String(process.env[name] || fallback).trim().toLowerCase();
  if (value === "gemini" || value === "openrouter" || value === "off") return value;
  return fallback;
}

export function shouldTryFallback(status) {
  return TRANSIENT_AI_STATUSES.has(Number(status));
}

export function uniqueAttempts(attempts) {
  const seen = new Set();
  return attempts.filter((attempt) => {
    const key = `${attempt.provider}:${attempt.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
