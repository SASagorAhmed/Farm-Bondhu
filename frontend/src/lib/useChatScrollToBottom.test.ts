import { describe, expect, it } from "vitest";
import { isScrollNearBottom } from "./useChatScrollToBottom";

describe("isScrollNearBottom", () => {
  it("returns true when scrolled to bottom within threshold", () => {
    expect(
      isScrollNearBottom({ scrollTop: 452, scrollHeight: 500, clientHeight: 48 }, 48)
    ).toBe(true);
  });

  it("returns false when scrolled up", () => {
    expect(
      isScrollNearBottom({ scrollTop: 100, scrollHeight: 500, clientHeight: 48 }, 48)
    ).toBe(false);
  });
});
