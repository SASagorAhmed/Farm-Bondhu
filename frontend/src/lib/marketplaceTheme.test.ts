import { describe, expect, it } from "vitest";
import {
  computeShippingBreakdown,
  computeShippingFee,
  DEFAULT_DELIVERY_DHAKA,
  DEFAULT_DELIVERY_OUTSIDE,
  productDeliveryCharge,
} from "@/lib/marketplaceTheme";

const dhakaMetro = { division: "Dhaka", district: "Dhaka" };
const outside = { division: "Sylhet", district: "Sylhet" };

describe("productDeliveryCharge", () => {
  it("uses platform defaults when seller values are null", () => {
    expect(productDeliveryCharge({ category: "animal_feed" }, dhakaMetro)).toBe(DEFAULT_DELIVERY_DHAKA);
    expect(productDeliveryCharge({ category: "animal_feed" }, outside)).toBe(DEFAULT_DELIVERY_OUTSIDE);
  });

  it("returns 0 for free delivery products", () => {
    expect(productDeliveryCharge({ freeDelivery: true, deliveryChargeDhaka: 200 }, dhakaMetro)).toBe(0);
  });
});

describe("computeShippingFee", () => {
  it("charges once per lane using the highest product fee", () => {
    const breakdown = computeShippingBreakdown(
      [
        { category: "animal_feed", deliveryChargeDhaka: 80 },
        { category: "fertilizer", deliveryChargeDhaka: 100 },
      ],
      dhakaMetro,
    );
    expect(breakdown.lanes).toHaveLength(1);
    expect(breakdown.total).toBe(100);
  });

  it("stacks fees for different lanes", () => {
    const total = computeShippingFee(
      [
        { product: { category: "animal_feed" } },
        { product: { category: "livestock" } },
      ],
      dhakaMetro,
    );
    expect(total).toBe(DEFAULT_DELIVERY_DHAKA * 2);
  });
});
