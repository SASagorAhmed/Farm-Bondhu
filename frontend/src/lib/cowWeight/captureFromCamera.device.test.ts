import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canSwitchCamera,
  classifyCameraLabel,
  getDefaultCameraFacingMode,
  isLikelyHandheldCameraDevice,
  pickDefaultCameraDevice,
  type VideoCameraDevice,
} from "./captureFromCamera";

function mockNavigator(ua: string, maxTouchPoints = 0) {
  vi.stubGlobal("navigator", {
    userAgent: ua,
    maxTouchPoints,
  });
}

const frontCam: VideoCameraDevice = {
  deviceId: "front-1",
  label: "Integrated Camera",
  role: "front",
};
const backCam: VideoCameraDevice = {
  deviceId: "back-1",
  label: "Back Camera",
  role: "back",
};

describe("captureFromCamera device defaults", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats iPhone as handheld (rear default facing preference)", () => {
    mockNavigator(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
    );
    expect(isLikelyHandheldCameraDevice()).toBe(true);
    expect(getDefaultCameraFacingMode()).toBe("environment");
  });

  it("treats Windows laptop as desktop (front default facing preference)", () => {
    mockNavigator(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
    );
    expect(isLikelyHandheldCameraDevice()).toBe(false);
    expect(getDefaultCameraFacingMode()).toBe("user");
  });
});

describe("classifyCameraLabel", () => {
  it("classifies integrated webcam as front", () => {
    expect(classifyCameraLabel("Integrated Camera")).toBe("front");
  });

  it("classifies back camera as back", () => {
    expect(classifyCameraLabel("Back Camera")).toBe("back");
  });
});

describe("pickDefaultCameraDevice", () => {
  it("returns the only camera when one device", () => {
    expect(pickDefaultCameraDevice([frontCam], false)?.deviceId).toBe("front-1");
  });

  it("prefers back camera on handheld with two devices", () => {
    expect(pickDefaultCameraDevice([frontCam, backCam], true)?.deviceId).toBe("back-1");
  });

  it("prefers front camera on desktop with two devices", () => {
    expect(pickDefaultCameraDevice([backCam, frontCam], false)?.deviceId).toBe("front-1");
  });
});

describe("canSwitchCamera", () => {
  it("is false with one camera", () => {
    expect(canSwitchCamera([frontCam])).toBe(false);
  });

  it("is true with two cameras", () => {
    expect(canSwitchCamera([frontCam, backCam])).toBe(true);
  });
});
