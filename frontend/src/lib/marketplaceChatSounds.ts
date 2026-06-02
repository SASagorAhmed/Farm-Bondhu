export type ChatSoundCatalogEntry = {
  id: string;
  labelEn: string;
  labelBn: string;
  fileName: string;
};

export const DEFAULT_CHAT_SOUND_ID = "marimba";

/** Pop-style sounds kept for backward compat but excluded from default enabled set. */
export const DEPRECATED_CHAT_SOUND_IDS = [
  "gentle-pop",
  "bubble",
  "digital-beep",
  "wood-block",
] as const;

const deprecatedSoundIds = new Set<string>(DEPRECATED_CHAT_SOUND_IDS);

export const CHAT_SOUND_CATALOG: ChatSoundCatalogEntry[] = [
  { id: "classic-ding", labelEn: "Classic ding", labelBn: "ক্লাসিক ডিং", fileName: "classic-ding.wav" },
  { id: "soft-chime", labelEn: "Soft chime", labelBn: "নরম ঝনঝন", fileName: "soft-chime.wav" },
  { id: "bright-bell", labelEn: "Bright bell", labelBn: "উজ্জ্বল ঘণ্টা", fileName: "bright-bell.wav" },
  { id: "double-tap", labelEn: "Double chime", labelBn: "দুই নোট ঝনঝন", fileName: "double-tap.wav" },
  { id: "gentle-pop", labelEn: "Light tap", labelBn: "হালকা ট্যাপ", fileName: "gentle-pop.wav" },
  { id: "marimba", labelEn: "Marimba", labelBn: "ম্যারিম্বা", fileName: "marimba.wav" },
  { id: "digital-beep", labelEn: "Soft ping", labelBn: "নরম পিং", fileName: "digital-beep.wav" },
  { id: "bubble", labelEn: "Gentle rise", labelBn: "নরম উত্থান", fileName: "bubble.wav" },
  { id: "wood-block", labelEn: "Short note", labelBn: "ছোট নোট", fileName: "wood-block.wav" },
  { id: "alert-tone", labelEn: "Soft alert", labelBn: "নরম সতর্ক", fileName: "alert-tone.wav" },
  { id: "message-ping", labelEn: "Message ping", labelBn: "বার্তা পিং", fileName: "message-ping.wav" },
  { id: "farm-bell", labelEn: "Farm bell", labelBn: "খামারের ঘণ্টা", fileName: "farm-bell.wav" },
];

const catalogById = new Map(CHAT_SOUND_CATALOG.map((entry) => [entry.id, entry]));

export function isValidChatSoundId(id: string): boolean {
  return catalogById.has(String(id || "").trim());
}

export function getChatSoundEntry(id: string | null | undefined): ChatSoundCatalogEntry {
  const key = String(id || "").trim();
  return catalogById.get(key) || catalogById.get(DEFAULT_CHAT_SOUND_ID)!;
}

export function getChatSoundUrl(id: string | null | undefined): string {
  const entry = getChatSoundEntry(id);
  return `${import.meta.env.BASE_URL}sounds/chat/${entry.fileName}`;
}

export function getAllChatSoundIds(): string[] {
  return CHAT_SOUND_CATALOG.map((entry) => entry.id);
}

export function getDefaultEnabledChatSoundIds(): string[] {
  return getAllChatSoundIds().filter((id) => !deprecatedSoundIds.has(id));
}

export function resolveChatSoundId(
  preferredId: string | null | undefined,
  enabledIds: string[] | null | undefined
): string {
  const enabled = (enabledIds || getDefaultEnabledChatSoundIds()).filter(isValidChatSoundId);
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

export function resolveUserChatSoundId(preferredId: string | null | undefined): string {
  return resolveChatSoundId(preferredId, getAllChatSoundIds());
}

export function getChatSoundLabel(
  id: string,
  locale: "en" | "bn" = "en"
): string {
  const entry = getChatSoundEntry(id);
  return locale === "bn" ? entry.labelBn : entry.labelEn;
}
