import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCommentBody } from "./marketplaceProductComments.js";
import { ReviewError } from "./marketplaceReviews.js";

test("normalizeCommentBody rejects empty reply body", () => {
  assert.equal(normalizeCommentBody("  hello seller  "), "hello seller");
  assert.equal(normalizeCommentBody("   "), null);
});

test("ReviewError carries status code", () => {
  const err = new ReviewError("Forbidden", 403);
  assert.equal(err.status, 403);
  assert.equal(err.message, "Forbidden");
});
