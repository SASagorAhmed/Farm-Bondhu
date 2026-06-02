import { describe, expect, it } from "vitest";
import {
  applyLocalReceiptUpdates,
  getOutboundReceiptStatus,
} from "./marketplaceChatReceipts";

describe("marketplaceChatReceipts", () => {
  it("returns sending for optimistic ids", () => {
    expect(getOutboundReceiptStatus({ id: "local-123", sender_role: "buyer" }, "buyer")).toBe("sending");
  });

  it("uses seller timestamps for buyer-sent messages", () => {
    const msg = {
      id: "1",
      sender_role: "buyer",
      seller_delivered_at: "2026-01-01T00:00:00Z",
      seller_read_at: null,
    };
    expect(getOutboundReceiptStatus(msg, "buyer")).toBe("delivered");

    expect(
      getOutboundReceiptStatus({ ...msg, seller_read_at: "2026-01-01T00:01:00Z" }, "buyer")
    ).toBe("seen");
  });

  it("uses buyer timestamps for seller-sent messages", () => {
    const msg = {
      id: "2",
      sender_role: "seller",
      buyer_delivered_at: null,
      buyer_read_at: null,
    };
    expect(getOutboundReceiptStatus(msg, "seller")).toBe("sent");
  });

  it("applyLocalReceiptUpdates marks incoming messages for viewer", () => {
    const messages = [
      { id: "a", sender_role: "seller", buyer_delivered_at: null, buyer_read_at: null },
      { id: "b", sender_role: "buyer", seller_delivered_at: null, seller_read_at: null },
    ];
    const next = applyLocalReceiptUpdates(messages, "buyer", "read");
    expect(next[0].buyer_read_at).toBeTruthy();
    expect(next[1].buyer_read_at).toBeFalsy();
  });
});
