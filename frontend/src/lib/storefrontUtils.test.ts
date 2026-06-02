import { describe, expect, it } from "vitest";
import {
  getLaneForProductCategory,
  resolveCategorySlug,
} from "@/lib/marketplaceCategories";
import { SELLER_ONBOARDING_LANES } from "@/lib/marketplaceLaneLabels";
import type { MarketplaceProduct } from "@/lib/marketplaceProduct";
import { groupProductsByLane } from "@/lib/storefrontUtils";

function mockProduct(category: string, id = "p1"): MarketplaceProduct {
  return {
    id,
    name: "Test product",
    category,
    price: 100,
    unit: "pc",
    image: "",
    seller: "Seller",
    sellerId: "seller-1",
    rating: 0,
    stock: 1,
    description: "",
    location: "Dhaka",
  } as MarketplaceProduct;
}

describe("resolveCategorySlug / getLaneForProductCategory", () => {
  it("maps canonical slugs to lanes", () => {
    expect(resolveCategorySlug("eggs")).toBe("eggs");
    expect(getLaneForProductCategory("eggs")).toBe("livestock_dairy");
  });

  it("applies legacy aliases matching backend normalizeCategory", () => {
    expect(resolveCategorySlug("poultry_feed")).toBe("animal_feed");
    expect(getLaneForProductCategory("poultry_feed")).toBe("farm");
    expect(resolveCategorySlug("health_care")).toBe("health_care_items");
    expect(getLaneForProductCategory("health_care")).toBe("medibondhu");
  });

  it("treats lane slug stored as category as that lane", () => {
    expect(getLaneForProductCategory("farm")).toBe("farm");
    expect(getLaneForProductCategory("livestock_dairy")).toBe("livestock_dairy");
  });
});

describe("groupProductsByLane", () => {
  it("always returns six marketplace lane groups", () => {
    const groups = groupProductsByLane([]);
    expect(groups).toHaveLength(SELLER_ONBOARDING_LANES.length);
    expect(groups.every((g) => g.lane !== "other")).toBe(true);
    expect(groups.every((g) => g.products.length === 0)).toBe(true);
  });

  it("places eggs under Livestock & Dairy", () => {
    const groups = groupProductsByLane([mockProduct("eggs")]);
    const livestock = groups.find((g) => g.lane === "livestock_dairy");
    expect(livestock?.products).toHaveLength(1);
    expect(livestock?.label).toBe("Livestock & Dairy");
  });

  it("adds Other products only for unmapped categories", () => {
    const groups = groupProductsByLane([mockProduct("general"), mockProduct("eggs", "p2")]);
    expect(groups.find((g) => g.lane === "other")?.products).toHaveLength(1);
    expect(groups.find((g) => g.lane === "livestock_dairy")?.products).toHaveLength(1);
  });
});
