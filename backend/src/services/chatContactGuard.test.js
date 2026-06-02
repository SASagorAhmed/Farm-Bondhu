import test from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_CONTACT_BLOCKED_MESSAGE,
  computeChatSendRestriction,
  isChatSendRestricted,
  scanMarketplaceChatText,
} from "./chatContactGuard.js";

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

test("CHAT_CONTACT_BLOCKED_MESSAGE is defined", () => {
  assert.match(CHAT_CONTACT_BLOCKED_MESSAGE, /GREENBondhu/);
});

for (const text of BLOCKED_SAMPLES) {
  test(`blocks: ${text.slice(0, 40)}`, () => {
    assert.equal(scanMarketplaceChatText(text).blocked, true);
  });
}

for (const text of SAFE_SAMPLES) {
  test(`allows: ${text}`, () => {
    assert.equal(scanMarketplaceChatText(text).blocked, false);
  });
}

test("computeChatSendRestriction throttles repeat offenders", () => {
  const now = Date.parse("2026-05-24T12:00:00.000Z");
  const open = computeChatSendRestriction([now - 60_000, now - 120_000], now);
  assert.equal(open.restrictedUntil, null);

  const restricted = computeChatSendRestriction([now - 300_000, now - 200_000, now - 100_000], now);
  assert.equal(restricted.violationCount, 3);
  assert.ok(isChatSendRestricted(restricted.restrictedUntil, now));
});
