import { describe, expect, it } from "vitest";
import { isAdminNavItemActive } from "@/lib/adminNavMatch";
import {
  MARKETPLACE_ADMIN_NAV,
  OFFICIAL_SHOP_ADMIN_NAV,
} from "@/lib/officialShopAdminNav";

const marketplaceUrls = MARKETPLACE_ADMIN_NAV.map((i) => i.url);
const officialShopUrls = OFFICIAL_SHOP_ADMIN_NAV.map((i) => i.url);

function active(
  pathname: string,
  search: string,
  itemUrl: string,
  siblings: string[],
) {
  return isAdminNavItemActive(pathname, search, itemUrl, siblings);
}

describe("isAdminNavItemActive", () => {
  describe("marketplace admin group", () => {
    it("highlights only Marketplace on hub path", () => {
      expect(active("/admin/marketplace", "", "/admin/marketplace", marketplaceUrls)).toBe(true);
      expect(
        active("/admin/marketplace", "", "/admin/marketplace?tab=flash-sale", marketplaceUrls),
      ).toBe(false);
      expect(
        active("/admin/marketplace", "", "/admin/marketplace/seller-lanes", marketplaceUrls),
      ).toBe(false);
    });

    it("highlights only Flash Sale when tab query matches", () => {
      expect(
        active(
          "/admin/marketplace",
          "?tab=flash-sale",
          "/admin/marketplace?tab=flash-sale",
          marketplaceUrls,
        ),
      ).toBe(true);
      expect(
        active("/admin/marketplace", "?tab=flash-sale", "/admin/marketplace", marketplaceUrls),
      ).toBe(false);
    });

    it("highlights only child route on nested marketplace paths", () => {
      expect(
        active(
          "/admin/marketplace/seller-lanes",
          "",
          "/admin/marketplace/seller-lanes",
          marketplaceUrls,
        ),
      ).toBe(true);
      expect(
        active("/admin/marketplace/seller-lanes", "", "/admin/marketplace", marketplaceUrls),
      ).toBe(false);
      expect(
        active(
          "/admin/marketplace/payouts",
          "",
          "/admin/marketplace/payouts",
          marketplaceUrls,
        ),
      ).toBe(true);
      expect(
        active("/admin/marketplace/payouts", "", "/admin/marketplace", marketplaceUrls),
      ).toBe(false);
    });

    it("highlights platform orders without activating marketplace hub", () => {
      expect(active("/admin/orders", "", "/admin/orders", marketplaceUrls)).toBe(true);
      expect(active("/admin/orders", "", "/admin/marketplace", marketplaceUrls)).toBe(false);
    });
  });

  describe("farmbondhu official shop group", () => {
    it("highlights only Overview on base path", () => {
      expect(
        active("/admin/farmbondhu-shop", "", "/admin/farmbondhu-shop", officialShopUrls),
      ).toBe(true);
      expect(
        active(
          "/admin/farmbondhu-shop",
          "",
          "/admin/farmbondhu-shop/products",
          officialShopUrls,
        ),
      ).toBe(false);
    });

    it("highlights only child on nested official shop paths", () => {
      expect(
        active(
          "/admin/farmbondhu-shop/products",
          "",
          "/admin/farmbondhu-shop/products",
          officialShopUrls,
        ),
      ).toBe(true);
      expect(
        active(
          "/admin/farmbondhu-shop/products",
          "",
          "/admin/farmbondhu-shop",
          officialShopUrls,
        ),
      ).toBe(false);
      expect(
        active(
          "/admin/farmbondhu-shop/inventory",
          "",
          "/admin/farmbondhu-shop/inventory",
          officialShopUrls,
        ),
      ).toBe(true);
    });

    it("does not cross-activate platform orders link", () => {
      expect(
        active(
          "/admin/farmbondhu-shop/orders",
          "",
          "/admin/farmbondhu-shop/orders",
          officialShopUrls,
        ),
      ).toBe(true);
      expect(active("/admin/farmbondhu-shop/orders", "", "/admin/orders", officialShopUrls)).toBe(
        false,
      );
    });
  });

  describe("all modules link", () => {
    it("is exact match only for /admin", () => {
      const siblings = ["/admin", "/admin/marketplace"];
      expect(active("/admin", "", "/admin", siblings)).toBe(true);
      expect(active("/admin/marketplace", "", "/admin", siblings)).toBe(false);
    });
  });
});
