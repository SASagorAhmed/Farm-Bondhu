import test from "node:test";
import assert from "node:assert/strict";
import {
  MarketplaceChatOpenError,
  conversationHasAnyReport,
  conversationHasPendingReport,
  deleteSupersededMarketplaceConversation,
  findCanonicalMarketplaceConversation,
  listSupersededConversationIds,
  openMarketplaceConversation,
} from "./marketplaceChatOpen.js";

const BUYER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SELLER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CANONICAL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DUPLICATE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PRODUCT = "11111111-1111-4111-8111-111111111111";

test("MarketplaceChatOpenError carries status and code", () => {
  const err = new MarketplaceChatOpenError("Product not found", 404, "PRODUCT_NOT_FOUND");
  assert.equal(err.message, "Product not found");
  assert.equal(err.status, 404);
  assert.equal(err.code, "PRODUCT_NOT_FOUND");
});

function createMockSql() {
  const state = {
    conversations: [
      {
        id: CANONICAL,
        buyer_id: BUYER,
        seller_id: SELLER,
        conversation_kind: "marketplace",
        last_message_at: "2026-05-01T12:00:00Z",
        created_at: "2026-05-01T10:00:00Z",
      },
      {
        id: DUPLICATE,
        buyer_id: BUYER,
        seller_id: SELLER,
        conversation_kind: "marketplace",
        last_message_at: "2026-04-01T12:00:00Z",
        created_at: "2026-04-01T10:00:00Z",
      },
    ],
    pendingReports: new Set(),
    resolvedReports: new Set(),
    deletedMessageConvoIds: [],
    deletedConvoIds: [],
  };

  const sql = async (strings, ...values) => {
    const q = strings.join("?");

    if (q.includes("marketplace_conversation_reports")) {
      const convoId = values[0];
      const pendingOnly = q.includes("pending");
      if (pendingOnly) {
        return [{ has_report: state.pendingReports.has(convoId) }];
      }
      return [{
        has_report: state.pendingReports.has(convoId) || state.resolvedReports.has(convoId),
      }];
    }

    if (q.startsWith("delete from chat_messages")) {
      state.deletedMessageConvoIds.push(values[0]);
      return [];
    }

    if (q.startsWith("delete from conversations")) {
      const id = values[0];
      state.deletedConvoIds.push(id);
      state.conversations = state.conversations.filter((c) => c.id !== id);
      return [];
    }

    if (q.includes("from conversations") && q.includes("where id") && q.includes("limit 1")) {
      const id = values[0];
      const row = state.conversations.find((c) => c.id === id);
      return row ? [row] : [];
    }

    if (q.includes("select id") && q.includes("id <>")) {
      const canonicalId = values[values.length - 1];
      return state.conversations
        .filter(
          (c) =>
            c.buyer_id === values[0] &&
            c.seller_id === values[1] &&
            c.id !== canonicalId &&
            (c.conversation_kind || "marketplace") === "marketplace",
        )
        .map((c) => ({ id: c.id }));
    }

    if (q.includes("from conversations") && q.includes("buyer_id") && q.includes("order by")) {
      const sorted = [...state.conversations]
        .filter(
          (c) =>
            c.buyer_id === values[0] &&
            c.seller_id === values[1] &&
            (c.conversation_kind || "marketplace") === "marketplace",
        )
        .sort((a, b) => {
          const ta = new Date(a.last_message_at || a.created_at).getTime();
          const tb = new Date(b.last_message_at || b.created_at).getTime();
          return tb - ta;
        });
      return sorted.slice(0, 1);
    }

    return [];
  };

  sql.unsafe = sql;
  return { sql, state };
}

test("findCanonicalMarketplaceConversation picks latest activity", async () => {
  const { sql } = createMockSql();
  const row = await findCanonicalMarketplaceConversation(sql, BUYER, SELLER);
  assert.equal(row?.id, CANONICAL);
});

test("listSupersededConversationIds excludes canonical", async () => {
  const { sql } = createMockSql();
  const ids = await listSupersededConversationIds(sql, BUYER, SELLER, CANONICAL);
  assert.deepEqual(ids, [DUPLICATE]);
});

test("deleteSupersededMarketplaceConversation removes duplicate without reports (seller)", async () => {
  const { sql, state } = createMockSql();
  const result = await deleteSupersededMarketplaceConversation(sql, {
    userId: SELLER,
    conversationId: DUPLICATE,
  });
  assert.equal(result.deletedId, DUPLICATE);
  assert.ok(state.deletedMessageConvoIds.includes(DUPLICATE));
  assert.ok(state.deletedConvoIds.includes(DUPLICATE));
  assert.equal(state.conversations.some((c) => c.id === DUPLICATE), false);
});

test("deleteSupersededMarketplaceConversation removes duplicate (buyer)", async () => {
  const { sql, state } = createMockSql();
  const result = await deleteSupersededMarketplaceConversation(sql, {
    userId: BUYER,
    conversationId: DUPLICATE,
  });
  assert.equal(result.deletedId, DUPLICATE);
  assert.equal(state.conversations.some((c) => c.id === DUPLICATE), false);
});

test("deleteSupersededMarketplaceConversation blocks canonical thread", async () => {
  const { sql } = createMockSql();
  await assert.rejects(
    () =>
      deleteSupersededMarketplaceConversation(sql, {
        userId: SELLER,
        conversationId: CANONICAL,
      }),
    (err) => err instanceof MarketplaceChatOpenError && err.code === "CANNOT_DELETE_CANONICAL",
  );
});

test("deleteSupersededMarketplaceConversation blocks pending report", async () => {
  const { sql, state } = createMockSql();
  state.pendingReports.add(DUPLICATE);
  await assert.rejects(
    () =>
      deleteSupersededMarketplaceConversation(sql, {
        userId: BUYER,
        conversationId: DUPLICATE,
      }),
    (err) => err instanceof MarketplaceChatOpenError && err.code === "HAS_REPORT",
  );
});

test("deleteSupersededMarketplaceConversation allows delete after resolved report", async () => {
  const { sql, state } = createMockSql();
  state.resolvedReports.add(DUPLICATE);
  const result = await deleteSupersededMarketplaceConversation(sql, {
    userId: BUYER,
    conversationId: DUPLICATE,
  });
  assert.equal(result.deletedId, DUPLICATE);
  assert.equal(state.conversations.some((c) => c.id === DUPLICATE), false);
});

test("deleteSupersededMarketplaceConversation forbids non-participant", async () => {
  const { sql } = createMockSql();
  const outsider = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await assert.rejects(
    () =>
      deleteSupersededMarketplaceConversation(sql, {
        userId: outsider,
        conversationId: DUPLICATE,
      }),
    (err) => err instanceof MarketplaceChatOpenError && err.code === "FORBIDDEN",
  );
});

test("conversationHasAnyReport reflects any report", async () => {
  const { sql, state } = createMockSql();
  assert.equal(await conversationHasAnyReport(sql, DUPLICATE), false);
  state.resolvedReports.add(DUPLICATE);
  assert.equal(await conversationHasAnyReport(sql, DUPLICATE), true);
  assert.equal(await conversationHasPendingReport(sql, DUPLICATE), false);
});

test("conversationHasPendingReport reflects pending only", async () => {
  const { sql, state } = createMockSql();
  state.pendingReports.add(DUPLICATE);
  assert.equal(await conversationHasPendingReport(sql, DUPLICATE), true);
  assert.equal(await conversationHasAnyReport(sql, DUPLICATE), true);
});

function createOpenMockSql() {
  const state = {
    conversations: [
      {
        id: CANONICAL,
        buyer_id: BUYER,
        seller_id: SELLER,
        conversation_kind: "marketplace",
        product_id: PRODUCT,
        last_message_at: "2026-05-01T12:00:00Z",
        created_at: "2026-05-01T10:00:00Z",
      },
    ],
    products: [{ id: PRODUCT, seller_id: SELLER, name: "Test Product" }],
    productShares: [],
  };

  const sql = async (strings, ...values) => {
    const q = Array.isArray(strings) ? strings.join("?") : String(strings);

    if (q.includes("from products") && q.includes("where id")) {
      const id = values[0];
      const row = state.products.find((p) => p.id === id);
      return row ? [row] : [];
    }

    if (q.includes("insert into chat_messages")) {
      state.productShares.push({ conversation_id: CANONICAL, shared_product_id: PRODUCT });
      return [{}];
    }

    if (q.includes("update conversations") && q.includes("last_message")) {
      return [];
    }

    if (
      q.includes("from conversations") &&
      q.includes("buyer_id") &&
      q.includes("seller_id") &&
      q.includes("limit 1")
    ) {
      const buyerId = values[0];
      const sellerId = values[1];
      const row = state.conversations.find(
        (c) =>
          c.buyer_id === buyerId &&
          c.seller_id === sellerId &&
          (c.conversation_kind || "marketplace") === "marketplace",
      );
      return row ? [{ ...row }] : [];
    }

    if (q.includes("from conversations") && q.includes("where id") && q.includes("limit 1")) {
      const id = values[0];
      const row = state.conversations.find((c) => c.id === id);
      return row ? [{ ...row }] : [];
    }

    if (q.includes("select id") && q.includes("id <>")) {
      return [];
    }

    return [];
  };

  sql.unsafe = sql;
  return { sql, state };
}

test("openMarketplaceConversation adds product_share on every open for existing shop chat", async () => {
  const { sql, state } = createOpenMockSql();
  const first = await openMarketplaceConversation(sql, {
    buyerId: BUYER,
    sellerId: SELLER,
    productId: PRODUCT,
  });
  const second = await openMarketplaceConversation(sql, {
    buyerId: BUYER,
    sellerId: SELLER,
    productId: PRODUCT,
  });
  assert.equal(first.productShareAdded, true);
  assert.equal(second.productShareAdded, true);
  assert.equal(state.productShares.length, 2);
});
