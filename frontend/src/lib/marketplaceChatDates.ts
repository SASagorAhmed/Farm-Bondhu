export interface ChatDateLabels {
  today: string;
  yesterday: string;
}

export interface ChatMessageDateGroup<T> {
  dateKey: string;
  messages: T[];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar day key YYYY-MM-DD from an ISO timestamp. */
export function toLocalDateKey(iso: string | undefined | null, now = new Date()): string {
  const d = iso ? new Date(iso) : now;
  if (Number.isNaN(d.getTime())) {
    return toLocalDateKey(now.toISOString(), now);
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatChatThreadDateLabel(
  dateKey: string,
  labels: ChatDateLabels,
  now = new Date()
): string {
  const todayKey = toLocalDateKey(now.toISOString(), now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday.toISOString(), now);

  if (dateKey === todayKey) return labels.today;
  if (dateKey === yesterdayKey) return labels.yesterday;

  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Group ordered thread messages by local calendar day (preserves message order). */
export function groupMessagesByDate<T extends { created_at?: string | null }>(
  messages: T[]
): ChatMessageDateGroup<T>[] {
  const groups: ChatMessageDateGroup<T>[] = [];
  for (const message of messages) {
    const dateKey = toLocalDateKey(message.created_at);
    const last = groups[groups.length - 1];
    if (last?.dateKey === dateKey) {
      last.messages.push(message);
    } else {
      groups.push({ dateKey, messages: [message] });
    }
  }
  return groups;
}
