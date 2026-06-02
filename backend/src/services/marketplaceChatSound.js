export const DEFAULT_CHAT_SOUND_ID = "marimba";

export const DEPRECATED_CHAT_SOUND_IDS = ["gentle-pop", "bubble", "digital-beep", "wood-block"];

const deprecatedSoundIds = new Set(DEPRECATED_CHAT_SOUND_IDS);

export const CHAT_SOUND_CATALOG = [
  { id: "classic-ding", labelEn: "Classic ding", labelBn: "ক্লাসিক ডিং" },
  { id: "soft-chime", labelEn: "Soft chime", labelBn: "নরম ঝনঝন" },
  { id: "bright-bell", labelEn: "Bright bell", labelBn: "উজ্জ্বল ঘণ্টা" },
  { id: "double-tap", labelEn: "Double chime", labelBn: "দুই নোট ঝনঝন" },
  { id: "gentle-pop", labelEn: "Light tap", labelBn: "হালকা ট্যাপ" },
  { id: "marimba", labelEn: "Marimba", labelBn: "ম্যারিম্বা" },
  { id: "digital-beep", labelEn: "Soft ping", labelBn: "নরম পিং" },
  { id: "bubble", labelEn: "Gentle rise", labelBn: "নরম উত্থান" },
  { id: "wood-block", labelEn: "Short note", labelBn: "ছোট নোট" },
  { id: "alert-tone", labelEn: "Soft alert", labelBn: "নরম সতর্ক" },
  { id: "message-ping", labelEn: "Message ping", labelBn: "বার্তা পিং" },
  { id: "farm-bell", labelEn: "Farm bell", labelBn: "খামারের ঘণ্টা" },
];

const catalogIds = new Set(CHAT_SOUND_CATALOG.map((entry) => entry.id));

export function isValidChatSoundId(id) {
  return catalogIds.has(String(id || "").trim());
}

export function getAllChatSoundIds() {
  return CHAT_SOUND_CATALOG.map((entry) => entry.id);
}

export function getDefaultEnabledChatSoundIds() {
  return getAllChatSoundIds().filter((id) => !deprecatedSoundIds.has(id));
}

export function getPublicChatSoundCatalog() {
  return CHAT_SOUND_CATALOG.map(({ id, labelEn, labelBn }) => ({ id, labelEn, labelBn }));
}

export function resolveChatSoundId(preferredId, enabledIds) {
  const enabled = (Array.isArray(enabledIds) ? enabledIds : getDefaultEnabledChatSoundIds()).filter(isValidChatSoundId);
  const pool = enabled.length > 0 ? enabled : getDefaultEnabledChatSoundIds();
  const preferred = String(preferredId || "").trim();
  if (preferred && pool.includes(preferred)) return preferred;
  if (preferred && deprecatedSoundIds.has(preferred) && !pool.includes(preferred)) {
    if (pool.includes(DEFAULT_CHAT_SOUND_ID)) return DEFAULT_CHAT_SOUND_ID;
    return pool[0] || DEFAULT_CHAT_SOUND_ID;
  }
  if (pool.includes(DEFAULT_CHAT_SOUND_ID)) return DEFAULT_CHAT_SOUND_ID;
  return pool[0] || DEFAULT_CHAT_SOUND_ID;
}

export function normalizeEnabledSoundIds(ids) {
  if (!Array.isArray(ids)) return getDefaultEnabledChatSoundIds();
  const unique = [...new Set(ids.map((id) => String(id || "").trim()).filter(isValidChatSoundId))];
  return unique.length > 0 ? unique : getDefaultEnabledChatSoundIds();
}

export function validateChatSoundSettings({ defaultId, enabledIds }) {
  const enabled = normalizeEnabledSoundIds(enabledIds);
  const resolvedDefault = resolveChatSoundId(defaultId, enabled);
  if (!enabled.includes(resolvedDefault)) {
    return { error: "Default sound must be one of the enabled sounds" };
  }
  return { value: { default_id: resolvedDefault, enabled_ids: enabled } };
}
