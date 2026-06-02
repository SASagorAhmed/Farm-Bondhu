export const CHAT_CONTACT_BLOCKED_MESSAGE =
  "For your safety, sharing phone numbers, links, emails, or outside contact details is not allowed. Please continue inside GREENBondhu.";

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

const SPELLED_DIGITS = {
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

export const CHAT_CONTACT_VIOLATION_WINDOW_MS = 30 * 60 * 1000;
export const CHAT_CONTACT_VIOLATION_THRESHOLD = 3;
export const CHAT_CONTACT_RESTRICTION_MS = 15 * 60 * 1000;

let violationsTableReady = false;

export async function ensureChatContactViolationsTable(sql) {
  if (violationsTableReady) return;
  await sql`
    create table if not exists public.chat_contact_violations (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      conversation_id uuid,
      reason text not null default 'contact_guard',
      created_at timestamptz not null default now()
    )
  `;
  violationsTableReady = true;
}

function emptyRestriction() {
  return { restrictedUntil: null, violationCount: 0 };
}

function convertBanglaDigitsToAscii(text) {
  return String(text || "").replace(/[০-৯]/g, (ch) => String(BANGLA_DIGITS.indexOf(ch)));
}

function replaceSpelledDigits(text) {
  let out = String(text || "");
  for (const [word, digit] of Object.entries(SPELLED_DIGITS)) {
    out = out.replace(new RegExp(`\\b${word}\\b`, "gi"), digit);
  }
  return out;
}

function extractCompactDigits(text) {
  return String(text || "").replace(/\D/g, "");
}

function normalizeForScan(text) {
  return replaceSpelledDigits(convertBanglaDigitsToAscii(text)).toLowerCase();
}

function containsBangladeshPhone(compactDigits) {
  if (!compactDigits) return false;
  if (/01\d{9}/.test(compactDigits)) return true;
  if (/8801\d{9}/.test(compactDigits)) return true;
  return false;
}

function hasHiddenDigitObfuscation(text, digitCount) {
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

function containsContactKeyword(text) {
  const lower = text.toLowerCase();
  return CONTACT_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function containsLinkOrEmail(text) {
  return LINK_OR_EMAIL_PATTERNS.some((pattern) => pattern.test(text));
}

function hasSpelledDigitPhoneAttempt(text) {
  const spelledPattern =
    /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)(?:\s+(?:zero|one|two|three|four|five|six|seven|eight|nine)){4,}\b/i;
  if (!spelledPattern.test(text)) return false;
  const normalized = replaceSpelledDigits(text.toLowerCase());
  return (normalized.match(/\d/g) || []).length >= 5;
}

export function scanMarketplaceChatText(text) {
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

export function computeChatSendRestriction(violationTimestamps, nowMs = Date.now()) {
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

export function isChatSendRestricted(restrictedUntil, nowMs = Date.now()) {
  if (!restrictedUntil) return false;
  return new Date(restrictedUntil).getTime() > nowMs;
}

export async function getChatSendRestriction(sql, userId) {
  try {
    await ensureChatContactViolationsTable(sql);
    const rows = await sql`
      select created_at
      from chat_contact_violations
      where user_id = ${userId}
        and created_at >= now() - interval '30 minutes'
      order by created_at desc
    `;
    const timestamps = rows.map((row) => new Date(row.created_at).getTime());
    return computeChatSendRestriction(timestamps);
  } catch (error) {
    console.warn("[chatContactGuard] getChatSendRestriction failed:", error?.message || error);
    return emptyRestriction();
  }
}

export async function recordChatContactViolation(sql, { userId, conversationId, reason }) {
  try {
    await ensureChatContactViolationsTable(sql);
    await sql`
      insert into chat_contact_violations ${sql({
        user_id: userId,
        conversation_id: conversationId || null,
        reason: reason || "contact_guard",
      })}
    `;
    return getChatSendRestriction(sql, userId);
  } catch (error) {
    console.warn("[chatContactGuard] recordChatContactViolation failed:", error?.message || error);
    return emptyRestriction();
  }
}

export async function userHasAdminRole(sql, userId) {
  const rows = await sql`
    select 1 from user_roles where user_id = ${userId} and role = 'admin' limit 1
  `;
  return rows.length > 0;
}
