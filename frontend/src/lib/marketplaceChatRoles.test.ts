import { describe, expect, it } from "vitest";
import {
  isBuyerSideMessage,
  isBuyerShopThread,
  isConversationAnchorProductShare,
  isSelfShopChat,
  isSellerShopThread,
  isSellerSideMessage,
  lastMessageRole,
  messageRole,
  resolveSelfShopThread,
  selfShopLastMessagePreview,
  selfShopThreadLabel,
  MARKETPLACE_SUPPORT_SHOP_LABEL,
} from "./marketplaceChatRoles";

const uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("marketplaceChatRoles", () => {
  it("detects self shop chat case-insensitively", () => {
    expect(isSelfShopChat(uid, uid.toUpperCase())).toBe(true);
    expect(isSelfShopChat(` ${uid} `, uid)).toBe(true);
    expect(isSelfShopChat(uid, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")).toBe(false);
  });

  it("resolveSelfShopThread uses is_self_chat flag or matching ids", () => {
    expect(resolveSelfShopThread(null)).toBe(false);
    expect(resolveSelfShopThread(undefined)).toBe(false);
    expect(resolveSelfShopThread({ buyer_id: uid, seller_id: uid })).toBe(true);
    expect(resolveSelfShopThread({ buyer_id: uid, seller_id: uid, is_self_chat: true })).toBe(true);
    expect(
      resolveSelfShopThread({
        buyer_id: uid,
        seller_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        is_self_chat: true,
      })
    ).toBe(true);
    expect(
      resolveSelfShopThread({
        buyer_id: uid,
        seller_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        is_self_chat: false,
      })
    ).toBe(false);
  });

  it("uses sender_role in self chat not sender_id", () => {
    const buyerMsg = { sender_id: uid, sender_role: "buyer" };
    const sellerMsg = { sender_id: uid, sender_role: "seller" };

    expect(isBuyerSideMessage(buyerMsg, uid, true)).toBe(true);
    expect(isBuyerSideMessage(sellerMsg, uid, true)).toBe(false);
    expect(isSellerSideMessage(buyerMsg, uid, true)).toBe(false);
    expect(isSellerSideMessage(sellerMsg, uid, true)).toBe(true);
  });

  it("aligns by sender_role for dual-role when selfChat flag is missing", () => {
    const buyerMsg = { sender_id: uid, sender_role: "buyer" as const };
    const sellerMsg = { sender_id: uid, sender_role: "seller" as const };

    expect(isBuyerSideMessage(buyerMsg, uid, false)).toBe(true);
    expect(isBuyerSideMessage(sellerMsg, uid, false)).toBe(false);
    expect(isSellerSideMessage(buyerMsg, uid, false)).toBe(false);
    expect(isSellerSideMessage(sellerMsg, uid, false)).toBe(true);
  });

  it("uses sender_id for normal chats", () => {
    const other = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    expect(isBuyerSideMessage({ sender_id: other, sender_role: "buyer" }, uid, false)).toBe(false);
    expect(isSellerSideMessage({ sender_id: other, sender_role: "buyer" }, uid, false)).toBe(false);
    expect(isBuyerSideMessage({ sender_id: uid, sender_role: "seller" }, uid, false)).toBe(false);
    expect(isSellerSideMessage({ sender_id: uid, sender_role: "seller" }, uid, false)).toBe(true);
  });

  it("defaults missing role to buyer in self chat", () => {
    const legacy = { sender_id: uid, sender_role: null };
    expect(messageRole(legacy)).toBe("buyer");
    expect(isSellerSideMessage(legacy, uid, true)).toBe(false);
  });

  it("preview role ignores shared sender id in self chat", () => {
    expect(lastMessageRole(null, true, uid, uid)).toBe("buyer");
    expect(lastMessageRole("seller", true, uid, uid)).toBe("seller");
  });

  it("selfShopThreadLabel matches normal buyer-seller labeling", () => {
    const buyerMsg = { sender_role: "buyer" };
    const sellerMsg = { sender_role: "seller" };

    expect(selfShopThreadLabel(buyerMsg, "My Shop", "Rahim", "productChat")).toBeNull();
    expect(selfShopThreadLabel(sellerMsg, "My Shop", "Rahim", "productChat")).toBeNull();
    expect(selfShopThreadLabel(buyerMsg, "My Shop", "Rahim", "sellerInbox")).toBe("Rahim");
    expect(selfShopThreadLabel(sellerMsg, "My Shop", "Rahim", "sellerInbox")).toBe("You");
    expect(selfShopThreadLabel(buyerMsg, "My Shop", null, "sellerInbox")).toBe("Buyer");
  });

  it("selfShopLastMessagePreview uses buyer name not shop name", () => {
    expect(selfShopLastMessagePreview("seller", "Rahim", "Hello")).toBe("You: Hello");
    expect(selfShopLastMessagePreview("buyer", "Rahim", "Hello")).toBe("Rahim: Hello");
    expect(selfShopLastMessagePreview(null, null, "Hi")).toBe("Buyer: Hi");
  });

  it("isSellerShopThread matches seller participant excluding support", () => {
    const seller = uid;
    const buyer = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    expect(
      isSellerShopThread({ buyer_id: buyer, seller_id: seller, shop_name: "My Shop" }, seller)
    ).toBe(true);
    expect(
      isSellerShopThread({ buyer_id: seller, seller_id: seller, shop_name: "My Shop" }, seller)
    ).toBe(true);
    expect(isSellerShopThread({ buyer_id: buyer, seller_id: seller }, buyer)).toBe(false);
    expect(
      isSellerShopThread(
        { buyer_id: buyer, seller_id: seller, shop_name: MARKETPLACE_SUPPORT_SHOP_LABEL },
        seller
      )
    ).toBe(false);
    expect(isBuyerShopThread({ buyer_id: buyer, seller_id: seller }, buyer)).toBe(true);
  });

  it("detects anchor product_share matching conversation product_id", () => {
    const productId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    expect(
      isConversationAnchorProductShare(
        { message_type: "product_share", shared_product_id: productId },
        productId
      )
    ).toBe(true);
    expect(
      isConversationAnchorProductShare(
        { message_type: "product_share", shared_product_id: "other-id" },
        productId
      )
    ).toBe(false);
    expect(
      isConversationAnchorProductShare({ message_type: "text", shared_product_id: productId }, productId)
    ).toBe(false);
  });
});
