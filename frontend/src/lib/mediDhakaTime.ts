/**
 * MediBondhu scheduling uses a single reference clock: Bangladesh (Asia/Dhaka).
 * Bangladesh observes no DST; offset from UTC is +06:00 year-round.
 */
export const MEDI_BONDHU_TZ = "Asia/Dhaka";

/** Stable offset for BD; matches IANA Asia/Dhaka (no historical edge cases relevant to booking). */
export const BD_UTC_OFFSET_HOURS = 6;

const YMD_RX = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar date YYYY-MM-DD for the instant `date`, in Bangladesh. */
export function formatDateYMDInDhaka(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MEDI_BONDHU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return date.toISOString().slice(0, 10);
  return `${y}-${m}-${d}`;
}

/** Add whole calendar days to a Bangladesh calendar `YYYY-MM-DD` (approx via noon BD). */
export function addCalendarDaysDhaka(ymd: string, deltaDays: number): string {
  const m = YMD_RX.exec(ymd.trim());
  if (!m) return ymd;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const noonUtcMs = Date.UTC(y, mo - 1, d, 12 - BD_UTC_OFFSET_HOURS, 0, 0, 0);
  const next = new Date(noonUtcMs + deltaDays * 86400000);
  return formatDateYMDInDhaka(next);
}

/** Normalize HTML time values like "9:00" → "09:00". */
export function normalizeTimeHHMM(raw: string): string {
  const s = raw.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!match) throw new Error("Invalid time (use HH:MM)");
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const mi = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

/**
 * Interpret `dateYmd` + `timeHHMM` as wall clock in Bangladesh, return UTC ISO string.
 */
export function dhakaWallTimeToUtcISO(dateYmd: string, timeHHMM: string): string {
  const dm = YMD_RX.exec(dateYmd.trim());
  const tm = normalizeTimeHHMM(timeHHMM);
  const [hs, mis] = tm.split(":");
  if (!dm) throw new Error("Invalid date (use YYYY-MM-DD)");
  const y = Number(dm[1]);
  const mo = Number(dm[2]);
  const d = Number(dm[3]);
  const h = Number(hs);
  const mi = Number(mis);
  const utcMs = Date.UTC(y, mo - 1, d, h - BD_UTC_OFFSET_HOURS, mi, 0, 0);
  return new Date(utcMs).toISOString();
}

export function dhakaSlotRangeToUtcISO(slot_date: string, startHHMM: string, endHHMM: string): {
  slot_start: string;
  slot_end: string;
} {
  return {
    slot_start: dhakaWallTimeToUtcISO(slot_date, startHHMM),
    slot_end: dhakaWallTimeToUtcISO(slot_date, endHHMM),
  };
}
