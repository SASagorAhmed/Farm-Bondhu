import { describe, expect, it } from "vitest";
import { dedupeOrdersById, mergeOrdersById } from "@/lib/orderCache";
import type { MarketplaceOrder } from "@/contexts/OrderContext";

function mockOrder(id: string, date: string, status: MarketplaceOrder["status"] = "pending"): MarketplaceOrder {
  return {
    id,
    date,
    items: [],
    total: 100,
    shippingFee: 80,
    status,
    buyerId: "buyer-1",
    buyerName: "Buyer",
    sellerId: "seller-1",
    sellerName: "Seller",
    deliveryAddress: { recipientName: "B", phone: "01", area: "A", address: "Addr", city: "City" },
    paymentMethod: "cash_on_delivery",
    paymentStatus: "unpaid",
    timeline: [],
  };
}

describe("dedupeOrdersById", () => {
  it("removes duplicate ids keeping the last entry", () => {
    const older = mockOrder("a", "2026-01-01", "pending");
    const newer = mockOrder("a", "2026-01-02", "delivered");
    const result = dedupeOrdersById([older, newer]);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("delivered");
  });

  it("sorts by date descending", () => {
    const first = mockOrder("a", "2026-01-01");
    const second = mockOrder("b", "2026-02-01");
    const result = dedupeOrdersById([first, second]);
    expect(result.map((o) => o.id)).toEqual(["b", "a"]);
  });
});

describe("mergeOrdersById", () => {
  it("upserts incoming over existing", () => {
    const existing = [mockOrder("a", "2026-01-01", "pending")];
    const incoming = [mockOrder("a", "2026-01-01", "confirmed")];
    const result = mergeOrdersById(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("confirmed");
  });

  it("appends new orders without duplicating existing", () => {
    const existing = [mockOrder("a", "2026-01-02")];
    const incoming = [mockOrder("a", "2026-01-02"), mockOrder("b", "2026-01-03")];
    const result = mergeOrdersById(existing, incoming);
    expect(result.map((o) => o.id)).toEqual(["b", "a"]);
  });
});
