import { describe, expect, it, beforeEach } from "vitest";
import {
  getDefaultTranslateTarget,
  setDefaultTranslateTarget,
} from "./marketplaceChatTranslate";

describe("marketplaceChatTranslate", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults translate target to en", () => {
    expect(getDefaultTranslateTarget()).toBe("en");
  });

  it("persists default target in localStorage", () => {
    setDefaultTranslateTarget("bn");
    expect(getDefaultTranslateTarget()).toBe("bn");
    expect(localStorage.getItem("chatTranslateTarget")).toBe("bn");
  });
});
