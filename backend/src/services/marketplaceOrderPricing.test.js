import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeWholesaleRule,
  resolveLinePrice,
  wholesaleThresholdStatus,
} from "./marketplaceOrderPricing.js";

const baseProduct = {
  price: 500,
  wholesale_price: 420,
  wholesale_min_qty: 10,
  wholesale_min_order_bdt: null,
  wholesale_rule: "quantity",
};

test("resolveLinePrice applies wholesale when qty threshold met (any buyer)", () => {
  const result = resolveLinePrice(baseProduct, 10, "wholesale");
  assert.equal(result.priceTier, "wholesale");
  assert.equal(result.unitPrice, 420);
});

test("resolveLinePrice applies wholesale on retail tier when threshold met", () => {
  const result = resolveLinePrice(baseProduct, 20, "retail");
  assert.equal(result.priceTier, "wholesale");
  assert.equal(result.unitPrice, 420);
});

test("resolveLinePrice keeps retail when qty threshold not met on wholesale tier", () => {
  const result = resolveLinePrice(baseProduct, 5, "wholesale");
  assert.equal(result.priceTier, "retail");
  assert.equal(result.unitPrice, 500);
  assert.match(result.thresholdHint || "", /Add 5 more unit/);
});

test("resolveLinePrice applies order_value rule", () => {
  const product = {
    ...baseProduct,
    wholesale_rule: "order_value",
    wholesale_min_qty: null,
    wholesale_min_order_bdt: 3000,
  };
  const below = resolveLinePrice(product, 5, "wholesale");
  assert.equal(below.priceTier, "retail");
  const above = resolveLinePrice(product, 6, "wholesale");
  assert.equal(above.priceTier, "wholesale");
  assert.equal(above.unitPrice, 420);
});

test("resolveLinePrice requires both thresholds for quantity_and_value", () => {
  const product = {
    ...baseProduct,
    wholesale_rule: "quantity_and_value",
    wholesale_min_qty: 10,
    wholesale_min_order_bdt: 10000,
  };
  const qtyOnly = resolveLinePrice(product, 15, "wholesale");
  assert.equal(qtyOnly.priceTier, "retail");
  const both = resolveLinePrice(product, 20, "wholesale");
  assert.equal(both.priceTier, "wholesale");
});

test("normalizeWholesaleRule defaults unknown values to quantity", () => {
  assert.equal(normalizeWholesaleRule(undefined), "quantity");
  assert.equal(normalizeWholesaleRule("order_value"), "order_value");
});

test("wholesaleThresholdStatus reports combined hint", () => {
  const product = {
    price: 100,
    wholesale_rule: "quantity_and_value",
    wholesale_min_qty: 20,
    wholesale_min_order_bdt: 5000,
  };
  const status = wholesaleThresholdStatus(product, 5);
  assert.equal(status.thresholdMet, false);
  assert.ok(status.thresholdHint);
});
