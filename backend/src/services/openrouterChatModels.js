const FALLBACK_DEFAULT = "deepseek/deepseek-v4-flash";
export const GEMINI_DIRECT_PREFIX = "gemini:";

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

function geminiChatModelId() {
  return `${GEMINI_DIRECT_PREFIX}${process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-flash-latest"}`;
}

function geminiChatEnabled() {
  const enabled = String(process.env.ENABLE_GEMINI_CHAT_MODEL || "").trim().toLowerCase();
  return Boolean(process.env.GEMINI_API_KEY?.trim()) || enabled === "true";
}

function labelForModelId(id, labels) {
  if (labels[id] && typeof labels[id] === "string") return labels[id];
  if (id.startsWith(GEMINI_DIRECT_PREFIX)) {
    const model = id.slice(GEMINI_DIRECT_PREFIX.length);
    return `${model} (Direct Gemini)`;
  }
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
  const allowlist = [
    ...parseChatModelAllowlist(),
    ...(geminiChatEnabled() ? [geminiChatModelId()] : []),
  ];
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
  if (id.startsWith(GEMINI_DIRECT_PREFIX) && geminiChatEnabled()) {
    return { ok: true, model: id };
  }
  if (!allowlist.includes(id)) {
    return {
      ok: false,
      error: "Model not allowed",
      allowed: [
        ...allowlist,
        ...(geminiChatEnabled() ? [geminiChatModelId()] : []),
      ],
    };
  }
  return { ok: true, model: id };
}
