import { describe, expect, it } from "vitest";
import { ShopStorefrontError } from "../src/services/shopStorefront.js";

describe("shopStorefront", () => {
  it("exports ShopStorefrontError with status", () => {
    const err = new ShopStorefrontError("too many pins", 400);
    expect(err.message).toBe("too many pins");
    expect(err.status).toBe(400);
  });
});
