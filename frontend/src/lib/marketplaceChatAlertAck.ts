const STORAGE_PREFIX = "farmbondhu_chat_alert_ack:";

export type ChatAlertAckMap = Record<string, string>;

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${String(userId || "").trim()}`;
}

export function readChatAlertAckMap(userId: string): ChatAlertAckMap {
  if (typeof sessionStorage === "undefined" || !userId) return {};
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ChatAlertAckMap;
  } catch {
    return {};
  }
}

export function writeChatAlertAckMap(userId: string, map: ChatAlertAckMap): void {
  if (typeof sessionStorage === "undefined" || !userId) return;
  try {
    sessionStorage.setItem(storageKey(userId), JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

export function getChatAlertAck(userId: string, conversationId: string): string | undefined {
  if (!conversationId) return undefined;
  return readChatAlertAckMap(userId)[conversationId];
}

export function setChatAlertAck(
  userId: string,
  conversationId: string,
  lastMessageAt: string | null | undefined
): void {
  if (!userId || !conversationId || !lastMessageAt) return;
  const map = readChatAlertAckMap(userId);
  map[conversationId] = lastMessageAt;
  writeChatAlertAckMap(userId, map);
}

/** True when this inbox row was already notified for its current last message. */
export function isChatAlertAlreadyAcked(
  userId: string,
  conversationId: string,
  lastMessageAt: string | null | undefined
): boolean {
  if (!lastMessageAt) return false;
  return getChatAlertAck(userId, conversationId) === lastMessageAt;
}

/** Seed ack for read threads on first poll so refresh/login stays silent. */
export function seedChatAlertAcksForReadRows(
  userId: string,
  rows: Array<{ id?: string; last_message_at?: string | null; has_unread?: boolean }>
): void {
  if (!userId) return;
  const map = readChatAlertAckMap(userId);
  let dirty = false;
  for (const row of rows) {
    if (!row.id || row.has_unread) continue;
    const at = row.last_message_at;
    if (!at) continue;
    if (map[row.id] !== at) {
      map[row.id] = at;
      dirty = true;
    }
  }
  if (dirty) writeChatAlertAckMap(userId, map);
}
