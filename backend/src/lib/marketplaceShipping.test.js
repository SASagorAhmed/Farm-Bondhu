import test from "node:test";
import assert from "node:assert/strict";
import {
  computeShippingBreakdown,
  computeShippingFee,
  DEFAULT_DELIVERY_DHAKA,
  DEFAULT_DELIVERY_OUTSIDE,
  isDhakaMetro,
  productDeliveryCharge,
} from "./marketplaceShipping.js";

const dhakaMetro = { division: "Dhaka", district: "Dhaka" };
const outside = { division: "Sylhet", district: "Sylhet" };

test("isDhakaMetro recognizes metro districts", () => {
  assert.equal(isDhakaMetro({ division: "dhaka", district: "gazipur" }), true);
  assert.equal(isDhakaMetro(outside), false);
});

test("productDeliveryCharge uses platform defaults when null", () => {
  assert.equal(productDeliveryCharge({ category: "animal_feed" }, dhakaMetro), DEFAULT_DELIVERY_DHAKA);
  assert.equal(productDeliveryCharge({ category: "animal_feed" }, outside), DEFAULT_DELIVERY_OUTSIDE);
});

test("productDeliveryCharge uses seller-set values", () => {
  const product = { delivery_charge_dhaka: 90, delivery_charge_outside: 150 };
  assert.equal(productDeliveryCharge(product, dhakaMetro), 90);
  assert.equal(productDeliveryCharge(product, outside), 150);
});

test("productDeliveryCharge returns 0 for free delivery", () => {
  assert.equal(
    productDeliveryCharge({ free_delivery: true, delivery_charge_dhaka: 200 }, dhakaMetro),
    0,
  );
});

test("same lane charges once using highest product fee", () => {
  const products = [
    { category: "animal_feed", delivery_charge_dhaka: 80 },
    { category: "fertilizer", delivery_charge_dhaka: 100 },
  ];
  const breakdown = computeShippingBreakdown(products, dhakaMetro);
  assert.equal(breakdown.lanes.length, 1);
  assert.equal(breakdown.lanes[0].lane, "farm");
  assert.equal(breakdown.lanes[0].fee, 100);
  assert.equal(breakdown.total, 100);
});

test("different lanes stack fees", () => {
  const products = [
    { category: "animal_feed" },
    { category: "livestock" },
  ];
  const breakdown = computeShippingBreakdown(products, dhakaMetro);
  assert.equal(breakdown.lanes.length, 2);
  assert.equal(breakdown.total, DEFAULT_DELIVERY_DHAKA * 2);
});

test("free delivery product does not raise lane max", () => {
  const products = [
    { category: "animal_feed", free_delivery: true },
    { category: "fertilizer", delivery_charge_dhaka: 95 },
  ];
  const breakdown = computeShippingBreakdown(products, dhakaMetro);
  assert.equal(breakdown.total, 95);
});

test("all free delivery in lane yields zero lane fee", () => {
  const products = [
    { category: "animal_feed", free_delivery: true },
    { category: "fertilizer", free_delivery: true },
  ];
  assert.equal(computeShippingFee(products, dhakaMetro), 0);
});

test("unknown category uses other bucket once", () => {
  const products = [
    { category: "unknown_cat", delivery_charge_dhaka: 70 },
    { category: "unknown_cat_2", delivery_charge_dhaka: 90 },
  ];
  const breakdown = computeShippingBreakdown(products, dhakaMetro);
  assert.equal(breakdown.lanes.length, 1);
  assert.equal(breakdown.lanes[0].lane, "other");
  assert.equal(breakdown.lanes[0].fee, 90);
});

test("two shops are independent when computed separately", () => {
  const shopA = [{ category: "animal_feed" }];
  const shopB = [{ category: "animal_feed" }, { category: "livestock" }];
  const total = computeShippingFee(shopA, dhakaMetro) + computeShippingFee(shopB, dhakaMetro);
  assert.equal(total, DEFAULT_DELIVERY_DHAKA * 3);
});
