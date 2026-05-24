const FALLBACK_DEFAULT = "google/gemini-2.0-flash-001";

/** Comma-separated OPENROUTER_CHAT_MODELS, else single OPENROUTER_MODEL / fallback. */
export function parseChatModelAllowlist() {
  const raw = process.env.OPENROUTER_CHAT_MODELS?.trim();
  if (raw) {
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length) return ids;
  }
  const def = process.env.OPENROUTER_MODEL?.trim() || FALLBACK_DEFAULT;
  return [def];
}

function parseModelLabelsMap() {
  const raw = process.env.OPENROUTER_CHAT_MODEL_LABELS?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function labelForModelId(id, labels) {
  if (labels[id] && typeof labels[id] === "string") return labels[id];
  const slug = id.split("/").pop() || id;
  return slug.replace(/:free$/i, " (free)");
}

export function defaultChatModelId() {
  const allowlist = parseChatModelAllowlist();
  const envDefault = process.env.OPENROUTER_MODEL?.trim();
  if (envDefault && allowlist.includes(envDefault)) return envDefault;
  return allowlist[0] || FALLBACK_DEFAULT;
}

/** Catalog for GET /v1/ai/chat-models */
export function getChatModelsCatalog() {
  const allowlist = parseChatModelAllowlist();
  const labels = parseModelLabelsMap();
  const defaultModel = defaultChatModelId();
  return {
    defaultModel,
    models: allowlist.map((id) => ({ id, label: labelForModelId(id, labels) })),
  };
}

/** Resolve model for POST /farm-chat; rejects ids outside allowlist. */
export function resolveChatModel(requested) {
  const allowlist = parseChatModelAllowlist();
  const defaultModel = defaultChatModelId();
  const id = typeof requested === "string" ? requested.trim() : "";
  if (!id) return { ok: true, model: defaultModel };
  if (!allowlist.includes(id)) {
    return { ok: false, error: "Model not allowed", allowed: allowlist };
  }
  return { ok: true, model: id };
}
