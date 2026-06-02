import test from "node:test";
import assert from "node:assert/strict";
import { OrderPricingError, deductStockForOrderLines } from "./marketplaceOrderPricing.js";
import { aggregateSoldByProduct } from "./marketplaceSellerInventory.js";

test("deductStockForOrderLines updates each line", async () => {
  const updates = [];
  const tx = async (strings, ...values) => {
    const productId = values[1];
    const qty = values[0];
    updates.push({ productId, qty });
    return [{ id: productId, stock: 7 }];
  };

  await deductStockForOrderLines(tx, [
    { productId: "p1", name: "Feed", qty: 3 },
  ]);

  assert.equal(updates.length, 1);
  assert.equal(updates[0].qty, 3);
  assert.equal(updates[0].productId, "p1");
});

test("deductStockForOrderLines throws when stock insufficient", async () => {
  const tx = async () => [];
  await assert.rejects(
    () => deductStockForOrderLines(tx, [{ productId: "p1", name: "Feed", qty: 3 }]),
    (err) => err instanceof OrderPricingError,
  );
});

test("aggregateSoldByProduct sums sold and delivered units", () => {
  const map = aggregateSoldByProduct([
    {
      status: "pending",
      items: [{ productId: "p1", qty: 2 }],
    },
    {
      status: "delivered",
      items: [{ productId: "p1", qty: 1 }],
    },
    {
      status: "cancelled",
      items: [{ productId: "p1", qty: 5 }],
    },
  ]);

  assert.deepEqual(map.get("p1"), { units_sold: 3, units_delivered: 1 });
});
