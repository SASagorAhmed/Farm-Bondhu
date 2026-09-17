import { describe, expect, it } from "vitest";
import {
  isFirefoxLikeUa,
  mergeMeetLikeDisplayMediaConstraints,
  MEET_LIKE_SCREEN_AUDIO,
} from "./consultationScreenShareAudio";

describe("isFirefoxLikeUa", () => {
  it("detects Firefox and FxIOS", () => {
    expect(isFirefoxLikeUa("Mozilla/5.0 Firefox/128.0")).toBe(true);
    expect(isFirefoxLikeUa("Mozilla/5.0 FxiOS/128.0")).toBe(true);
    expect(isFirefoxLikeUa("Mozilla/5.0 Chrome/128.0.0.0 Safari/537.36")).toBe(false);
  });
});

describe("mergeMeetLikeDisplayMediaConstraints", () => {
  it("enables clear system/tab audio on Chrome-like UAs", () => {
    const merged = mergeMeetLikeDisplayMediaConstraints(
      { video: true, audio: true },
      "Mozilla/5.0 Chrome/128.0.0.0 Safari/537.36"
    );
    expect(merged.audio).toEqual(MEET_LIKE_SCREEN_AUDIO);
    expect(merged.systemAudio).toBe("include");
    expect(merged.windowAudio).toBe("system");
  });

  it("upgrades bare audio:true into Meet-like audio constraints", () => {
    const merged = mergeMeetLikeDisplayMediaConstraints(
      { video: true },
      "Mozilla/5.0 Chrome/128.0.0.0 Safari/537.36"
    );
    expect(merged.audio).toMatchObject({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    });
  });

  it("preserves caller audio object fields while applying Meet defaults", () => {
    const merged = mergeMeetLikeDisplayMediaConstraints(
      { video: true, audio: { channelCount: 2 } },
      "Mozilla/5.0 Chrome/128.0.0.0 Safari/537.36"
    );
    expect(merged.audio).toMatchObject({
      ...MEET_LIKE_SCREEN_AUDIO,
      channelCount: 2,
    });
  });

  it("keeps audio off on Firefox", () => {
    const merged = mergeMeetLikeDisplayMediaConstraints(
      { video: true, audio: true },
      "Mozilla/5.0 Firefox/128.0"
    );
    expect(merged.audio).toBe(false);
  });

  it("respects explicit audio:false", () => {
    const merged = mergeMeetLikeDisplayMediaConstraints(
      { video: true, audio: false },
      "Mozilla/5.0 Chrome/128.0.0.0 Safari/537.36"
    );
    expect(merged.audio).toBe(false);
  });
});
