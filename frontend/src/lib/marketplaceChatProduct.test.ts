import { describe, expect, it } from "vitest";
import {
  chronologicalThreadMessages,
  isAnchorProductShareMessage,
  orderedThreadMessages,
  partitionAnchorProductMessages,
} from "@/lib/marketplaceChatProduct";

const productId = "11111111-1111-4111-8111-111111111111";

describe("partitionAnchorProductMessages", () => {
  it("pins only earliest anchor product_share first and keeps other shares in rest", () => {
    const anchor = {
      id: "a",
      message_type: "product_share",
      shared_product_id: productId,
      created_at: "2026-01-01T10:00:00Z",
    };
    const otherShare = {
      id: "b",
      message_type: "product_share",
      shared_product_id: "22222222-2222-4222-8222-222222222222",
      created_at: "2026-01-01T11:00:00Z",
    };
    const text = {
      id: "c",
      message_type: "text",
      shared_product_id: null,
      created_at: "2026-01-01T12:00:00Z",
    };

    const { anchor: anchors, rest } = partitionAnchorProductMessages(
      [text, otherShare, anchor],
      productId
    );
    expect(anchors).toHaveLength(1);
    expect(anchors[0].id).toBe("a");
    expect(rest.map((m) => m.id)).toEqual(["b", "c"]);

    const ordered = orderedThreadMessages([text, otherShare, anchor], productId);
    expect(ordered.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps later re-shares of the same product in chronological order at bottom", () => {
    const bootstrapAnchor = {
      id: "anchor",
      message_type: "product_share",
      shared_product_id: productId,
      created_at: "2026-01-01T10:00:00Z",
    };
    const text = {
      id: "text",
      message_type: "text",
      shared_product_id: null,
      created_at: "2026-01-01T11:00:00Z",
    };
    const reshare = {
      id: "reshare",
      message_type: "product_share",
      shared_product_id: productId,
      created_at: "2026-01-01T12:00:00Z",
    };

    const ordered = orderedThreadMessages([bootstrapAnchor, text, reshare], productId);
    expect(ordered.map((m) => m.id)).toEqual(["anchor", "text", "reshare"]);

    expect(
      isAnchorProductShareMessage(reshare, productId, [bootstrapAnchor, text, reshare])
    ).toBe(false);
    expect(
      isAnchorProductShareMessage(bootstrapAnchor, productId, [bootstrapAnchor, text, reshare])
    ).toBe(true);
  });

  it("chronologicalThreadMessages sorts by created_at only", () => {
    const a = { id: "a", message_type: "text", created_at: "2026-01-01T10:00:00Z" };
    const b = {
      id: "b",
      message_type: "product_share",
      shared_product_id: productId,
      created_at: "2026-01-01T11:00:00Z",
    };
    expect(chronologicalThreadMessages([b, a]).map((m) => m.id)).toEqual(["a", "b"]);
    expect(
      orderedThreadMessages([b, a], productId, { pinAnchor: false }).map((m) => m.id)
    ).toEqual(["a", "b"]);
  });

  it("detects anchor messages with message list", () => {
    const anchor = {
      id: "a",
      message_type: "product_share",
      shared_product_id: productId,
      created_at: "2026-01-01T10:00:00Z",
    };
    const msgs = [anchor];
    expect(isAnchorProductShareMessage(anchor, productId, msgs)).toBe(true);
    expect(
      isAnchorProductShareMessage(
        { message_type: "product_share", shared_product_id: "other", id: "x" },
        productId,
        msgs
      )
    ).toBe(false);
  });
});
