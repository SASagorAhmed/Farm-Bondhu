import { describe, expect, it } from "vitest";
import {
  CHAT_SOUND_CATALOG,
  DEFAULT_CHAT_SOUND_ID,
  DEPRECATED_CHAT_SOUND_IDS,
  getAllChatSoundIds,
  getChatSoundEntry,
  getChatSoundUrl,
  getDefaultEnabledChatSoundIds,
  isValidChatSoundId,
  resolveChatSoundId,
  resolveUserChatSoundId,
} from "./marketplaceChatSounds";

describe("marketplaceChatSounds", () => {
  it("has at least 12 catalog entries", () => {
    expect(CHAT_SOUND_CATALOG.length).toBeGreaterThanOrEqual(12);
  });

  it("validates known sound ids", () => {
    expect(isValidChatSoundId("classic-ding")).toBe(true);
    expect(isValidChatSoundId("farm-bell")).toBe(true);
    expect(isValidChatSoundId("unknown")).toBe(false);
  });

  it("builds sound URLs under public sounds chat folder", () => {
    const url = getChatSoundUrl("bright-bell");
    expect(url).toContain("sounds/chat/bright-bell.wav");
  });

  it("falls back to default for unknown ids", () => {
    const entry = getChatSoundEntry("not-real");
    expect(entry.id).toBe(DEFAULT_CHAT_SOUND_ID);
  });

  it("resolves preferred id against enabled pool", () => {
    const enabled = getAllChatSoundIds().filter((id) => id !== "bubble");
    expect(resolveChatSoundId("bubble", enabled)).toBe(DEFAULT_CHAT_SOUND_ID);
    expect(resolveChatSoundId("marimba", enabled)).toBe("marimba");
  });

  it("excludes pop-style sounds from default enabled set", () => {
    const defaults = getDefaultEnabledChatSoundIds();
    for (const id of DEPRECATED_CHAT_SOUND_IDS) {
      expect(defaults).not.toContain(id);
    }
    expect(defaults).toContain(DEFAULT_CHAT_SOUND_ID);
  });

  it("migrates deprecated pop ids to classic ding when not enabled", () => {
    const enabled = getDefaultEnabledChatSoundIds();
    expect(resolveChatSoundId("gentle-pop", enabled)).toBe(DEFAULT_CHAT_SOUND_ID);
    expect(resolveChatSoundId("bubble", enabled)).toBe(DEFAULT_CHAT_SOUND_ID);
  });

  it("keeps user preference for any catalog sound", () => {
    expect(resolveUserChatSoundId("gentle-pop")).toBe("gentle-pop");
    expect(resolveUserChatSoundId("bubble")).toBe("bubble");
    expect(resolveUserChatSoundId("digital-beep")).toBe("digital-beep");
  });

  it("uses default when preferred is empty", () => {
    expect(resolveChatSoundId(null, ["digital-beep"])).toBe("digital-beep");
  });
});
