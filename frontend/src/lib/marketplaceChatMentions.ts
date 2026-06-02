export type ChatMentionTagId = "product" | "report";

export interface ChatMentionTagDefinition {
  id: ChatMentionTagId;
  token: string;
  label: string;
  description: string;
}

export const MARKETPLACE_CHAT_MENTION_TAGS: ChatMentionTagDefinition[] = [
  {
    id: "product",
    token: "@product",
    label: "Product",
    description: "Attach a shop product bubble",
  },
  {
    id: "report",
    token: "@report",
    label: "Report",
    description: "Report this conversation to FarmBondhu support",
  },
];

/** @deprecated use tag registry — kept for existing imports */
export const PRODUCT_MENTION_REGEX = /(^|\s)@product(\s|$)/i;

export interface ActiveMentionQuery {
  query: string;
  start: number;
  end: number;
}

function tagNameFromToken(token: string): string {
  return token.startsWith("@") ? token.slice(1) : token;
}

function resolveMentionTags(tags?: ChatMentionTagDefinition[]): ChatMentionTagDefinition[] {
  return tags?.length ? tags : MARKETPLACE_CHAT_MENTION_TAGS;
}

function buildTagRegex(tag: ChatMentionTagDefinition): RegExp {
  const name = tagNameFromToken(tag.token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)@${name}(\\s|$)`, "i");
}

export function getChatMentionTags(options?: { allowReport?: boolean }): ChatMentionTagDefinition[] {
  if (options?.allowReport === false) {
    return MARKETPLACE_CHAT_MENTION_TAGS.filter((tag) => tag.id !== "report");
  }
  return MARKETPLACE_CHAT_MENTION_TAGS;
}

export function containsMentionTag(text: string, id: ChatMentionTagId): boolean {
  const tag = MARKETPLACE_CHAT_MENTION_TAGS.find((t) => t.id === id);
  if (!tag) return false;
  return buildTagRegex(tag).test(text.trim());
}

export function containsProductMention(text: string): boolean {
  return containsMentionTag(text, "product");
}

export function containsReportMention(text: string): boolean {
  return containsMentionTag(text, "report");
}

export function stripAllMentionTags(text: string, tags?: ChatMentionTagDefinition[]): string {
  let result = text;
  for (const tag of resolveMentionTags(tags)) {
    result = result.replace(buildTagRegex(tag), " ");
  }
  return result.replace(/\s+/g, " ").trim();
}

export function stripProductMention(text: string): string {
  return stripAllMentionTags(text);
}

/** Text to send after removing mention tags; empty string means skip text message. */
export function messageTextForSend(rawText: string): string {
  return stripAllMentionTags(rawText.trim());
}

export function findActiveMentionQuery(
  text: string,
  cursorIndex: number,
  tags?: ChatMentionTagDefinition[]
): ActiveMentionQuery | null {
  const activeTags = resolveMentionTags(tags);
  const before = text.slice(0, Math.max(0, cursorIndex));
  const match = before.match(/(^|\s)@(\w*)$/);
  if (!match) return null;
  const query = match[2] ?? "";
  const exactTag = activeTags.find(
    (tag) => tagNameFromToken(tag.token).toLowerCase() === query.toLowerCase()
  );
  if (exactTag) return null;
  const atIndex = before.lastIndexOf("@");
  if (atIndex < 0) return null;
  return {
    query,
    start: atIndex,
    end: cursorIndex,
  };
}

export function filterMentionTags(
  query: string,
  tags?: ChatMentionTagDefinition[]
): ChatMentionTagDefinition[] {
  const q = query.toLowerCase();
  return resolveMentionTags(tags).filter((tag) =>
    tagNameFromToken(tag.token).toLowerCase().startsWith(q)
  );
}

export function insertMentionTag(
  text: string,
  range: { start: number; end: number },
  tag: ChatMentionTagDefinition
): { text: string; cursor: number } {
  const insertion = `${tag.token} `;
  const newText = text.slice(0, range.start) + insertion + text.slice(range.end);
  return { text: newText, cursor: range.start + insertion.length };
}

export function detectNewlyCompletedMentionTag(
  prevText: string,
  nextText: string,
  id: ChatMentionTagId
): boolean {
  return !containsMentionTag(prevText, id) && containsMentionTag(nextText, id);
}

export interface ChatMentionProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  category?: string | null;
  stock?: number | null;
}

export interface MentionTextSegment {
  type: "text" | "tag";
  value: string;
  tagId?: ChatMentionTagId;
}

/** Split composer text into plain text and completed mention tag tokens. */
export function splitTextWithMentionTags(
  text: string,
  tags?: ChatMentionTagDefinition[]
): MentionTextSegment[] {
  if (!text) return [];

  const activeTags = resolveMentionTags(tags);
  const alternation = activeTags
    .map((tag) => tagNameFromToken(tag.token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  if (!alternation) return [{ type: "text", value: text }];

  const re = new RegExp(`@(?:${alternation})(?=\\s|$)`, "gi");
  const segments: MentionTextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const token = match[0];
    const tag = activeTags.find((t) => t.token.toLowerCase() === token.toLowerCase());
    segments.push({ type: "tag", value: token, tagId: tag?.id });
    lastIndex = re.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}
