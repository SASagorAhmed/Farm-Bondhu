import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhotoUrls,
  parseRating,
  orderContainsProduct,
  normalizeReviewComment,
  normalizeSellerReply,
  pendingItemsFromOrder,
  ReviewError,
} from "./marketplaceReviews.js";
import { normalizeCommentBody } from "./marketplaceProductComments.js";

test("parseRating accepts 1-5 only", () => {
  assert.equal(parseRating(5), 5);
  assert.equal(parseRating("3"), 3);
  assert.equal(parseRating(0), null);
  assert.equal(parseRating(6), null);
  assert.equal(parseRating(3.5), null);
});

test("normalizePhotoUrls caps at 3 urls", () => {
  assert.deepEqual(normalizePhotoUrls(["a", "b", "c", "d"]), ["a", "b", "c"]);
  assert.deepEqual(normalizePhotoUrls(null), []);
});

test("orderContainsProduct matches productId or product_id", () => {
  const items = [{ productId: "p1" }, { product_id: "p2" }];
  assert.equal(orderContainsProduct(items, "p1"), true);
  assert.equal(orderContainsProduct(items, "p2"), true);
  assert.equal(orderContainsProduct(items, "p3"), false);
});

test("normalizeReviewComment trims and limits length", () => {
  assert.equal(normalizeReviewComment("  hello  "), "hello");
  assert.equal(normalizeReviewComment("   "), null);
  assert.equal(normalizeReviewComment(null), null);
});

test("normalizeCommentBody rejects empty comment", () => {
  assert.equal(normalizeCommentBody("  hi  "), "hi");
  assert.equal(normalizeCommentBody("   "), null);
});

test("pendingItemsFromOrder returns unreviewed delivered line items", () => {
  const order = {
    id: "o1",
    status: "delivered",
    date: "2026-01-01",
    seller_name: "Farm Shop",
    items: [
      { productId: "p1", name: "Milk", image: "img1.jpg" },
      { product_id: "p2", name: "Eggs" },
      { productId: "p1", name: "Milk duplicate" },
    ],
  };
  const reviewed = new Set(["p2"]);
  const pending = pendingItemsFromOrder(order, reviewed);
  assert.equal(pending.length, 1);
  assert.deepEqual(pending[0], {
    orderId: "o1",
    productId: "p1",
    productName: "Milk",
    productImage: "img1.jpg",
    orderDate: "2026-01-01",
    sellerName: "Farm Shop",
  });
});

test("pendingItemsFromOrder skips non-delivered and filters by product", () => {
  const order = {
    id: "o2",
    status: "shipped",
    items: [{ productId: "p1", name: "Milk" }],
  };
  assert.deepEqual(pendingItemsFromOrder(order, new Set()), []);
  const delivered = {
    id: "o3",
    status: "delivered",
    created_at: "2026-02-01",
    items: [
      { productId: "p1", name: "Milk" },
      { productId: "p2", name: "Eggs" },
    ],
  };
  const filtered = pendingItemsFromOrder(delivered, new Set(), { productIdFilter: "p2" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].productId, "p2");
});

test("normalizeSellerReply trims and limits length", () => {
  assert.equal(normalizeSellerReply("  Thanks for your feedback!  "), "Thanks for your feedback!");
  assert.throws(() => normalizeSellerReply("   "), (err) => err instanceof ReviewError);
});
