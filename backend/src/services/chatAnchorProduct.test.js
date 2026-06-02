import test from "node:test";
import assert from "node:assert/strict";
import { isAnchorProductShareMessage } from "./chatAnchorProduct.js";

test("isAnchorProductShareMessage matches conversation product", () => {
  const productId = "11111111-1111-4111-8111-111111111111";
  assert.equal(
    isAnchorProductShareMessage(
      { message_type: "product_share", shared_product_id: productId },
      productId
    ),
    true
  );
  assert.equal(
    isAnchorProductShareMessage(
      { message_type: "text", shared_product_id: productId },
      productId
    ),
    false
  );
});
