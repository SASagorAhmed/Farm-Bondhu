import { describe, expect, it } from "vitest";
import {
  isCallScreenshotHotkey,
  isLocalPreviewVideo,
  pickMainCallVideo,
} from "./consultationScreenshot";

function mockKeyEvent(
  partial: Partial<KeyboardEvent> & { key: string; target?: EventTarget | null }
): KeyboardEvent {
  return {
    repeat: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: document.body,
    ...partial,
  } as KeyboardEvent;
}

function mockLiveVideo(videoWidth: number, videoHeight = 480): HTMLVideoElement {
  const video = document.createElement("video");
  Object.defineProperty(video, "videoWidth", { configurable: true, value: videoWidth });
  Object.defineProperty(video, "videoHeight", { configurable: true, value: videoHeight });
  Object.defineProperty(video, "readyState", {
    configurable: true,
    value: HTMLMediaElement.HAVE_CURRENT_DATA,
  });
  return video;
}

describe("pickMainCallVideo", () => {
  it("returns the large remote video and skips the top-right preview PiP", () => {
    const stage = document.createElement("div");
    const remote = mockLiveVideo(1280, 720);
    const pip = mockLiveVideo(320, 240);
    const pipWrap = document.createElement("div");
    pipWrap.setAttribute("style", "position: absolute; top: 1rem; right: 1rem;");
    pipWrap.appendChild(pip);
    stage.appendChild(remote);
    stage.appendChild(pipWrap);

    expect(isLocalPreviewVideo(pip, stage)).toBe(true);
    expect(isLocalPreviewVideo(remote, stage)).toBe(false);
    expect(pickMainCallVideo(stage)).toBe(remote);
  });

  it("detects PiP when Zego omits spaces in inline styles", () => {
    const stage = document.createElement("div");
    const pip = mockLiveVideo(320, 240);
    const pipWrap = document.createElement("div");
    pipWrap.setAttribute("style", "position:absolute;top:16px;right:16px;");
    pipWrap.appendChild(pip);
    stage.appendChild(pipWrap);

    expect(isLocalPreviewVideo(pip, stage)).toBe(true);
    expect(pickMainCallVideo(stage)).toBeNull();
  });

  it("detects the mobile preview overlay that only sets right", () => {
    const stage = document.createElement("div");
    const remote = mockLiveVideo(1280, 720);
    const pip = mockLiveVideo(320, 240);
    const pipWrap = document.createElement("div");
    pipWrap.setAttribute("style", "position:absolute;right:12px;");
    pipWrap.appendChild(pip);
    stage.appendChild(remote);
    stage.appendChild(pipWrap);

    expect(isLocalPreviewVideo(pip, stage)).toBe(true);
    expect(pickMainCallVideo(stage)).toBe(remote);
  });

  it("returns null when only the local preview is live", () => {
    const stage = document.createElement("div");
    const pip = mockLiveVideo(640, 480);
    const pipWrap = document.createElement("div");
    pipWrap.setAttribute("style", "position: absolute; top: 12px; right: 12px;");
    pipWrap.appendChild(pip);
    stage.appendChild(pipWrap);

    expect(pickMainCallVideo(stage)).toBeNull();
  });

  it("returns null when no video has a current frame", () => {
    const stage = document.createElement("div");
    const empty = document.createElement("video");
    stage.appendChild(empty);
    expect(pickMainCallVideo(stage)).toBeNull();
  });

  it("picks the largest remaining live video when there is no PiP", () => {
    const stage = document.createElement("div");
    const smaller = mockLiveVideo(640, 360);
    const larger = mockLiveVideo(1920, 1080);
    stage.appendChild(smaller);
    stage.appendChild(larger);
    expect(pickMainCallVideo(stage)).toBe(larger);
  });
});

describe("isCallScreenshotHotkey", () => {
  it("matches Alt+X", () => {
    expect(isCallScreenshotHotkey(mockKeyEvent({ key: "x", altKey: true }))).toBe(true);
    expect(isCallScreenshotHotkey(mockKeyEvent({ key: "X", altKey: true }))).toBe(true);
  });

  it("rejects other modifiers or keys", () => {
    expect(isCallScreenshotHotkey(mockKeyEvent({ key: "x" }))).toBe(false);
    expect(isCallScreenshotHotkey(mockKeyEvent({ key: "x", altKey: true, ctrlKey: true }))).toBe(false);
    expect(isCallScreenshotHotkey(mockKeyEvent({ key: "x", altKey: true, shiftKey: true }))).toBe(false);
    expect(isCallScreenshotHotkey(mockKeyEvent({ key: "s", altKey: true }))).toBe(false);
  });

  it("ignores key repeat", () => {
    expect(isCallScreenshotHotkey(mockKeyEvent({ key: "x", altKey: true, repeat: true }))).toBe(false);
  });

  it("ignores when focus is in chat input fields", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    expect(isCallScreenshotHotkey(mockKeyEvent({ key: "x", altKey: true, target: input }))).toBe(false);
    input.remove();

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    expect(isCallScreenshotHotkey(mockKeyEvent({ key: "x", altKey: true, target: textarea }))).toBe(false);
    textarea.remove();
  });
});
