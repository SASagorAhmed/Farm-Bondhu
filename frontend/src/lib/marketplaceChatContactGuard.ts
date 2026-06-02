export const CHAT_CONTACT_BLOCKED_MESSAGE =
  "For your safety, sharing phone numbers, links, emails, or outside contact details is not allowed. Please continue inside GREENBondhu.";

export type ChatContactBlockReason =
  | "bd_phone"
  | "digit_run"
  | "hidden_digits"
  | "contact_keyword"
  | "link_or_email"
  | "spelled_digits";

export interface ChatContactScanResult {
  blocked: boolean;
  reason?: ChatContactBlockReason;
}

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

const SPELLED_DIGITS: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

const CONTACT_KEYWORDS = [
  "call",
  "phone",
  "number",
  "whatsapp",
  "whats app",
  "inbox",
  "facebook",
  "fb",
  "email",
  "e-mail",
  "contact",
  "bkash",
  "b-kash",
  "nagad",
  "telegram",
  "imo",
  "viber",
  "messenger",
  "instagram",
  "insta",
  "মোবাইল",
  "ফোন",
  "হোয়াটসঅ্যাপ",
  "হোয়াটসঅ্যাপ",
  "ইমেইল",
  "যোগাযোগ",
  "নম্বর",
  "বিকাশ",
  "নগদ",
];

const LINK_OR_EMAIL_PATTERNS = [
  /https?:\/\/[^\s]+/i,
  /\bwww\.[^\s]+/i,
  /\b[a-z0-9-]+\.(com|net|org|io|co|me|app|link|shop|store|info|biz|xyz|bd)(?:\/[^\s]*)?\b/i,
  /\b(?:fb|wa|t)\.me\/[^\s]+/i,
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i,
];

export function convertBanglaDigitsToAscii(text: string): string {
  return String(text || "").replace(/[০-৯]/g, (ch) => String(BANGLA_DIGITS.indexOf(ch)));
}

export function replaceSpelledDigits(text: string): string {
  let out = String(text || "");
  for (const [word, digit] of Object.entries(SPELLED_DIGITS)) {
    out = out.replace(new RegExp(`\\b${word}\\b`, "gi"), digit);
  }
  return out;
}

export function extractCompactDigits(text: string): string {
  return String(text || "").replace(/\D/g, "");
}

export function countDigits(text: string): number {
  let count = 0;
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") count += 1;
  }
  return count;
}

function normalizeForScan(text: string): string {
  return replaceSpelledDigits(convertBanglaDigitsToAscii(text)).toLowerCase();
}

function containsBangladeshPhone(compactDigits: string): boolean {
  if (!compactDigits) return false;
  if (/01\d{9}/.test(compactDigits)) return true;
  if (/8801\d{9}/.test(compactDigits)) return true;
  return false;
}

function hasHiddenDigitObfuscation(text: string, digitCount: number): boolean {
  if (digitCount < 5 || digitCount > 7) return false;

  let separators = 0;
  let prevWasDigit = false;
  for (const ch of text) {
    const isDigit = ch >= "0" && ch <= "9";
    if (isDigit && prevWasDigit) {
      separators += 1;
    }
    if (!isDigit && prevWasDigit && ch !== " ") {
      separators += 1;
    }
    prevWasDigit = isDigit;
  }

  const nonSpace = text.replace(/\s/g, "");
  const digitAdjacentNoise = nonSpace.replace(/\d/g, "").length;
  const ratio = digitCount > 0 ? digitAdjacentNoise / digitCount : 0;

  return separators >= 2 || ratio >= 1;
}

function containsContactKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return CONTACT_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function containsLinkOrEmail(text: string): boolean {
  return LINK_OR_EMAIL_PATTERNS.some((pattern) => pattern.test(text));
}

function hasSpelledDigitPhoneAttempt(text: string): boolean {
  const spelledPattern =
    /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)(?:\s+(?:zero|one|two|three|four|five|six|seven|eight|nine)){4,}\b/i;
  if (!spelledPattern.test(text)) return false;
  const normalized = replaceSpelledDigits(text.toLowerCase());
  return countDigits(normalized) >= 5;
}

export function scanMarketplaceChatText(text: string): ChatContactScanResult {
  const raw = String(text || "").trim();
  if (!raw) return { blocked: false };

  if (containsLinkOrEmail(raw)) {
    return { blocked: true, reason: "link_or_email" };
  }

  if (hasSpelledDigitPhoneAttempt(raw)) {
    return { blocked: true, reason: "spelled_digits" };
  }

  const normalized = normalizeForScan(raw);
  const compactDigits = extractCompactDigits(normalized);
  const digitCount = compactDigits.length;

  if (containsBangladeshPhone(compactDigits)) {
    return { blocked: true, reason: "bd_phone" };
  }

  if (digitCount >= 8) {
    return { blocked: true, reason: "digit_run" };
  }

  if (hasHiddenDigitObfuscation(normalized, digitCount)) {
    return { blocked: true, reason: "hidden_digits" };
  }

  if (containsContactKeyword(normalized) && digitCount >= 1) {
    return { blocked: true, reason: "contact_keyword" };
  }

  return { blocked: false };
}

export const CHAT_CONTACT_VIOLATION_WINDOW_MS = 30 * 60 * 1000;
export const CHAT_CONTACT_VIOLATION_THRESHOLD = 3;
export const CHAT_CONTACT_RESTRICTION_MS = 15 * 60 * 1000;

export function computeChatSendRestriction(
  violationTimestamps: number[],
  nowMs: number = Date.now()
): { restrictedUntil: string | null; violationCount: number } {
  const windowStart = nowMs - CHAT_CONTACT_VIOLATION_WINDOW_MS;
  const recent = violationTimestamps.filter((ts) => ts >= windowStart);
  const violationCount = recent.length;

  if (violationCount < CHAT_CONTACT_VIOLATION_THRESHOLD) {
    return { restrictedUntil: null, violationCount };
  }

  const latest = Math.max(...recent);
  const restrictedUntil = new Date(latest + CHAT_CONTACT_RESTRICTION_MS).toISOString();
  if (new Date(restrictedUntil).getTime() <= nowMs) {
    return { restrictedUntil: null, violationCount };
  }

  return { restrictedUntil, violationCount };
}

export function isChatSendRestricted(restrictedUntil: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!restrictedUntil) return false;
  return new Date(restrictedUntil).getTime() > nowMs;
}

/** Live clock string for restriction countdown (MM:SS or H:MM:SS). */
export function formatRestrictionClock(restrictedUntil: string, nowMs: number = Date.now()): string {
  const ms = Math.max(0, new Date(restrictedUntil).getTime() - nowMs);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
