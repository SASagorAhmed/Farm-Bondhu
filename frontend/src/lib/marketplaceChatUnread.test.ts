import { describe, expect, it } from "vitest";
import {
  inboundAlertViewerRole,
  isBuyerInboxConversation,
  isInboundConversationUpdate,
  isInboundMessageForUser,
  isSellerInboxConversation,
  shouldAlertForConversation,
  shouldNotifyFromInboxPoll,
  shouldShowToastForConversation,
  viewerRoleForConversation,
} from "@/lib/marketplaceChatUnread";

describe("marketplaceChatUnread", () => {
  it("detects buyer inbound from seller or admin", () => {
    expect(isInboundConversationUpdate("seller", "buyer")).toBe(true);
    expect(isInboundConversationUpdate("admin", "buyer")).toBe(true);
    expect(isInboundConversationUpdate("buyer", "buyer")).toBe(false);
  });

  it("detects seller inbound from buyer", () => {
    expect(isInboundConversationUpdate("buyer", "seller")).toBe(true);
    expect(isInboundConversationUpdate("seller", "seller")).toBe(false);
  });

  it("resolves viewer role from conversation participants", () => {
    expect(
      viewerRoleForConversation("user-a", { buyer_id: "user-a", seller_id: "user-b" })
    ).toBe("buyer");
    expect(
      viewerRoleForConversation("user-b", { buyer_id: "user-a", seller_id: "user-b" })
    ).toBe("seller");
  });

  it("detects inbound for seller side when buyer sends in own-shop", () => {
    const row = {
      id: "convo-1",
      buyer_id: "same-user",
      seller_id: "same-user",
      last_sender_role: "buyer",
    };
    expect(isInboundMessageForUser(row, "same-user")).toBe(true);
  });

  it("detects inbound for buyer side when seller sends in own-shop", () => {
    const row = {
      id: "convo-1",
      buyer_id: "same-user",
      seller_id: "same-user",
      last_sender_role: "seller",
    };
    expect(isInboundMessageForUser(row, "same-user")).toBe(true);
  });

  it("scopes buyer inbox to buyer_id only", () => {
    expect(
      isBuyerInboxConversation({ buyer_id: "user-a", seller_id: "user-b" }, "user-a")
    ).toBe(true);
    expect(
      isBuyerInboxConversation({ buyer_id: "user-b", seller_id: "user-a" }, "user-a")
    ).toBe(false);
  });

  it("scopes seller inbox to seller_id only", () => {
    expect(
      isSellerInboxConversation({ buyer_id: "user-b", seller_id: "user-a" }, "user-a")
    ).toBe(true);
    expect(
      isSellerInboxConversation({ buyer_id: "user-a", seller_id: "user-b" }, "user-a")
    ).toBe(false);
  });

  it("still detects inbound sound when user is viewing that thread", () => {
    const row = {
      id: "convo-1",
      buyer_id: "buyer-a",
      seller_id: "seller-b",
      last_sender_role: "seller",
    };
    expect(isInboundMessageForUser(row, "buyer-a")).toBe(true);
    expect(shouldShowToastForConversation(row, "buyer-a", "convo-1", "buyer")).toBe(false);
  });

  it("shows own-shop buyer toast while viewing same thread as seller", () => {
    const row = {
      id: "convo-1",
      buyer_id: "same-user",
      seller_id: "same-user",
      last_sender_role: "seller",
    };
    expect(inboundAlertViewerRole(row, "same-user")).toBe("buyer");
    expect(shouldShowToastForConversation(row, "same-user", "convo-1", "seller")).toBe(true);
  });

  it("shows own-shop seller toast while viewing same thread as buyer", () => {
    const row = {
      id: "convo-1",
      buyer_id: "same-user",
      seller_id: "same-user",
      last_sender_role: "buyer",
    };
    expect(inboundAlertViewerRole(row, "same-user")).toBe("seller");
    expect(shouldShowToastForConversation(row, "same-user", "convo-1", "buyer")).toBe(true);
  });

  it("suppresses own-shop toast only on matching side", () => {
    const buyerRow = {
      id: "convo-1",
      buyer_id: "same-user",
      seller_id: "same-user",
      last_sender_role: "seller",
    };
    const sellerRow = {
      id: "convo-1",
      buyer_id: "same-user",
      seller_id: "same-user",
      last_sender_role: "buyer",
    };
    expect(shouldShowToastForConversation(buyerRow, "same-user", "convo-1", "buyer")).toBe(false);
    expect(shouldShowToastForConversation(sellerRow, "same-user", "convo-1", "seller")).toBe(false);
  });

  it("shouldAlertForConversation matches toast behavior", () => {
    const row = {
      id: "convo-1",
      buyer_id: "buyer-a",
      seller_id: "seller-b",
      last_sender_role: "seller",
    };
    expect(shouldAlertForConversation(row, "buyer-a", "convo-1", "buyer")).toBe(false);
    expect(shouldAlertForConversation(row, "buyer-a", null)).toBe(true);
  });

  it("shouldNotifyFromInboxPoll skips read threads and first seed", () => {
    const row = {
      id: "convo-1",
      buyer_id: "buyer-a",
      seller_id: "seller-b",
      last_sender_role: "seller",
      last_message_at: "2026-05-01T12:00:00Z",
      has_unread: false,
    };
    expect(shouldNotifyFromInboxPoll(row, "buyer-a", undefined)).toBe(false);
    expect(
      shouldNotifyFromInboxPoll(row, "buyer-a", {
        last_message_at: "2026-05-01T11:00:00Z",
        last_sender_role: "buyer",
      })
    ).toBe(false);
  });

  it("shouldNotifyFromInboxPoll alerts on new unread inbound", () => {
    const row = {
      id: "convo-1",
      buyer_id: "buyer-a",
      seller_id: "seller-b",
      last_sender_role: "seller",
      last_message_at: "2026-05-01T12:00:00Z",
      has_unread: true,
    };
    expect(
      shouldNotifyFromInboxPoll(row, "buyer-a", {
        last_message_at: "2026-05-01T11:00:00Z",
        last_sender_role: "buyer",
      })
    ).toBe(true);
  });
});
