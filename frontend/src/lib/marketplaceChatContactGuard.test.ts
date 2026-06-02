import { describe, expect, it } from "vitest";
import {
  CHAT_CONTACT_BLOCKED_MESSAGE,
  computeChatSendRestriction,
  formatRestrictionClock,
  isChatSendRestricted,
  scanMarketplaceChatText,
} from "@/lib/marketplaceChatContactGuard";

const BLOCKED_SAMPLES = [
  "1!@2#a3asa6sas7asa8dsgdhgi8",
  "1..1...2...3.4.4",
  "a1b2c3d4e5f6g7h8",
  "0-1-7-1-2-3-4-5-6-7-8",
  "০ ১ ৭ ১ ২ ৩ ৪ ৫ ৬ ৭ ৮",
  "a1b7c1d2e3f4g5",
  "zero one seven one two three four five six seven eight",
  "017-12-34-56-78",
  "017****123***456",
  "call me 12345",
  "whatsapp.com/foo",
  "test@gmail.com",
  "https://example.com",
  "01712345678",
  "+8801712345678",
];

const SAFE_SAMPLES = [
  "Hello, is this available?",
  "Price please",
  "Thanks",
  "500 taka",
  "Can I get more photos?",
  "Yes please deliver tomorrow",
];

describe("scanMarketplaceChatText", () => {
  it("exports the safety warning message", () => {
    expect(CHAT_CONTACT_BLOCKED_MESSAGE).toContain("GREENBondhu");
  });

  it.each(BLOCKED_SAMPLES)("blocks suspicious message: %s", (text) => {
    expect(scanMarketplaceChatText(text).blocked).toBe(true);
  });

  it.each(SAFE_SAMPLES)("allows safe message: %s", (text) => {
    expect(scanMarketplaceChatText(text).blocked).toBe(false);
  });
});

describe("formatRestrictionClock", () => {
  it("formats sub-hour countdown as MM:SS", () => {
    const until = new Date("2026-05-24T12:15:30.000Z").toISOString();
    const now = Date.parse("2026-05-24T12:00:00.000Z");
    expect(formatRestrictionClock(until, now)).toBe("15:30");
  });
});

describe("computeChatSendRestriction", () => {
  const now = Date.parse("2026-05-24T12:00:00.000Z");

  it("does not restrict before threshold", () => {
    const result = computeChatSendRestriction([now - 60_000, now - 120_000], now);
    expect(result.restrictedUntil).toBeNull();
    expect(result.violationCount).toBe(2);
  });

  it("restricts for 15 minutes after third violation", () => {
    const ts = [now - 300_000, now - 200_000, now - 100_000];
    const result = computeChatSendRestriction(ts, now);
    expect(result.violationCount).toBe(3);
    expect(result.restrictedUntil).toBe(new Date(now - 100_000 + 15 * 60 * 1000).toISOString());
    expect(isChatSendRestricted(result.restrictedUntil, now)).toBe(true);
  });
});
