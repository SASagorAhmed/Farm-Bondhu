import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();
const updateEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
const fetchMock = vi.fn();

vi.mock("@/api/client", () => ({
  API_BASE: "http://test/api",
  readSession: () => ({ access_token: "token" }),
  api: {
    from: (table: string) => {
      if (table === "chat_messages") {
        return { insert: insertMock };
      }
      if (table === "conversations") {
        return {
          update: () => ({ eq: updateEqMock }),
        };
      }
      return {};
    },
  },
}));

import { sendMarketplaceMessage, sendTextAndProductShares } from "@/lib/marketplaceChatSend";
import { CHAT_CONTACT_BLOCKED_MESSAGE } from "@/lib/marketplaceChatContactGuard";

describe("sendTextAndProductShares", () => {
  beforeEach(() => {
    insertMock.mockReset();
    updateEqMock.mockClear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { restricted_until: null, violation_count: 1 } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    let n = 0;
    insertMock.mockImplementation(async (payload: Record<string, unknown>) => {
      n += 1;
      return { data: { id: `msg-${n}`, ...payload }, error: null };
    });
  });

  it("sends text once then each product_share in order", async () => {
    const ok = await sendTextAndProductShares({
      conversationId: "convo-1",
      senderId: "user-1",
      senderRole: "buyer",
      rawText: "Check these @product",
      products: [
        { id: "p1", name: "Feed A", image: "/a.jpg", price: 100 },
        { id: "p2", name: "Feed B", image: "/b.jpg", price: 200 },
      ],
      onOptimistic: () => {},
      onConfirmed: () => {},
      onRollback: () => {},
    });

    expect(ok).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(3);
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      message_type: "text",
      text_body: "Check these",
    });
    expect(insertMock.mock.calls[1][0]).toMatchObject({
      message_type: "product_share",
      shared_product_id: "p1",
    });
    expect(insertMock.mock.calls[2][0]).toMatchObject({
      message_type: "product_share",
      shared_product_id: "p2",
    });
  });

  it("sends only product shares when text is empty after strip", async () => {
    const ok = await sendTextAndProductShares({
      conversationId: "convo-1",
      senderId: "user-1",
      senderRole: "seller",
      rawText: "@product",
      products: [{ id: "p1", name: "Feed A", image: "/a.jpg", price: 100 }],
      onOptimistic: () => {},
      onConfirmed: () => {},
      onRollback: () => {},
    });

    expect(ok).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      message_type: "product_share",
      shared_product_id: "p1",
    });
  });

  it("blocks contact-trick text before insert", async () => {
    const onError = vi.fn();
    const onContactBlocked = vi.fn();
    const ok = await sendMarketplaceMessage({
      conversationId: "convo-1",
      senderId: "user-1",
      senderRole: "buyer",
      messageType: "text",
      textBody: "01712345678",
      onOptimistic: () => {},
      onConfirmed: () => {},
      onRollback: () => {},
      onError,
      onContactBlocked,
    });

    expect(ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
    expect(onContactBlocked).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(CHAT_CONTACT_BLOCKED_MESSAGE);
    expect(fetchMock).toHaveBeenCalled();
  });
});
