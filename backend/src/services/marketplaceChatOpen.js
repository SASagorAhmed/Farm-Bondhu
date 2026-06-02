import { ensureConversationAnchorProductShare } from "./chatAnchorProduct.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MARKETPLACE_KIND = "marketplace";

export class MarketplaceChatOpenError extends Error {
  /** @param {string} message @param {number} [status] @param {string} [code] */
  constructor(message, status = 400, code = "INVALID") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function assertUuid(value, label) {
  const id = String(value || "").trim();
  if (!UUID_RE.test(id)) {
    throw new MarketplaceChatOpenError(`Invalid ${label}`, 400, "INVALID_ID");
  }
  return id;
}

/**
 * @param {import("postgres").Sql} sql
 * @param {string} buyerId
 * @param {string} sellerId
 */
export async function findCanonicalMarketplaceConversation(sql, buyerId, sellerId) {
  const [row] = await sql`
    select *
    from conversations
    where buyer_id = ${buyerId}
      and seller_id = ${sellerId}
      and coalesce(conversation_kind, ${MARKETPLACE_KIND}) = ${MARKETPLACE_KIND}
    order by coalesce(last_message_at, created_at) desc nulls last
    limit 1
  `;
  return row || null;
}

/**
 * @param {import("postgres").Sql} sql
 * @param {string} buyerId
 * @param {string} sellerId
 * @param {string} canonicalId
 */
export async function listSupersededConversationIds(sql, buyerId, sellerId, canonicalId) {
  const rows = await sql`
    select id
    from conversations
    where buyer_id = ${buyerId}
      and seller_id = ${sellerId}
      and coalesce(conversation_kind, ${MARKETPLACE_KIND}) = ${MARKETPLACE_KIND}
      and id <> ${canonicalId}
    order by coalesce(last_message_at, created_at) desc nulls last
  `;
  return rows.map((r) => r.id);
}

/**
 * @param {import("postgres").Sql} sql
 * @param {string} conversationId
 */
export async function conversationHasAnyReport(sql, conversationId) {
  const [row] = await sql`
    select exists (
      select 1 from marketplace_conversation_reports
      where conversation_id = ${conversationId}
    ) as has_report
  `;
  return Boolean(row?.has_report);
}

/**
 * @param {import("postgres").Sql} sql
 * @param {string} conversationId
 */
export async function conversationHasPendingReport(sql, conversationId) {
  const [row] = await sql`
    select exists (
      select 1 from marketplace_conversation_reports
      where conversation_id = ${conversationId}
        and status = 'pending'
    ) as has_report
  `;
  return Boolean(row?.has_report);
}

/**
 * @param {import("postgres").Sql} sql
 * @param {string} buyerId
 * @param {string} sellerId
 * @param {string} canonicalId
 */
export async function listSupersededDuplicatesMeta(sql, buyerId, sellerId, canonicalId) {
  const rows = await sql`
    select
      c.id,
      coalesce(c.last_message_at, c.created_at) as last_message_at,
      exists (
        select 1 from marketplace_conversation_reports mcr
        where mcr.conversation_id = c.id
          and mcr.status = 'pending'
      ) as has_pending_report
    from conversations c
    where c.buyer_id = ${buyerId}
      and c.seller_id = ${sellerId}
      and coalesce(c.conversation_kind, ${MARKETPLACE_KIND}) = ${MARKETPLACE_KIND}
      and c.id <> ${canonicalId}
    order by coalesce(c.last_message_at, c.created_at) desc nulls last
  `;
  return rows.map((r) => ({
    id: r.id,
    last_message_at: r.last_message_at,
    has_pending_report: Boolean(r.has_pending_report),
  }));
}

function isSameParticipantId(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

/**
 * @param {import("postgres").Sql} sql
 * @param {{ userId: string; conversationId: string }} params
 */
export async function deleteSupersededMarketplaceConversation(sql, { userId, conversationId }) {
  const uid = assertUuid(userId, "user_id");
  const convoId = assertUuid(conversationId, "conversation_id");

  const [conversation] = await sql`
    select id, buyer_id, seller_id, conversation_kind
    from conversations
    where id = ${convoId}
    limit 1
  `;
  if (!conversation) {
    throw new MarketplaceChatOpenError("Conversation not found", 404, "NOT_FOUND");
  }
  const isBuyer = isSameParticipantId(conversation.buyer_id, uid);
  const isSeller = isSameParticipantId(conversation.seller_id, uid);
  if (!isBuyer && !isSeller) {
    throw new MarketplaceChatOpenError("Forbidden", 403, "FORBIDDEN");
  }
  if (String(conversation.conversation_kind || MARKETPLACE_KIND) !== MARKETPLACE_KIND) {
    throw new MarketplaceChatOpenError("Only marketplace chats can be deleted", 400, "INVALID_KIND");
  }

  const canonical = await findCanonicalMarketplaceConversation(
    sql,
    conversation.buyer_id,
    conversation.seller_id,
  );
  if (!canonical || canonical.id === conversation.id) {
    throw new MarketplaceChatOpenError(
      isBuyer
        ? "Cannot delete the active chat with this shop"
        : "Cannot delete the active chat with this buyer",
      400,
      "CANNOT_DELETE_CANONICAL",
    );
  }

  if (await conversationHasPendingReport(sql, convoId)) {
    throw new MarketplaceChatOpenError(
      "Cannot delete while a report is under review",
      403,
      "HAS_REPORT",
    );
  }

  await sql`delete from chat_messages where conversation_id = ${convoId}`;
  await sql`delete from conversations where id = ${convoId}`;

  return { deletedId: convoId, buyerId: conversation.buyer_id, sellerId: conversation.seller_id };
}

/**
 * Insert a product_share bubble every time chat is opened from a product (Chat Now).
 *
 * @param {import("postgres").Sql} sql
 * @param {{ id: string; buyer_id: string; seller_id: string; product_id?: string | null }} conversation
 * @param {string} productId
 */
async function addProductShareOnOpen(sql, conversation, productId) {
  const [product] = await sql`
    select name from products where id = ${productId} limit 1
  `;
  const preview = product?.name ? `Shared: ${product.name}` : "Shared a product";
  const createdAt = new Date().toISOString();

  await sql`
    insert into chat_messages ${sql({
      conversation_id: conversation.id,
      sender_id: conversation.buyer_id,
      sender_role: "buyer",
      message_type: "product_share",
      shared_product_id: productId,
      created_at: createdAt,
    })}
  `;

  await sql`
    update conversations
    set
      last_message = ${preview},
      last_message_at = ${createdAt},
      last_sender_id = ${conversation.buyer_id},
      last_sender_role = 'buyer',
      product_id = ${productId},
      updated_at = ${createdAt}
    where id = ${conversation.id}
  `;

  return { created: true };
}

/**
 * Open or reuse one marketplace conversation per buyer + seller (shop).
 *
 * @param {import("postgres").Sql} sql
 * @param {{ buyerId: string; sellerId: string; productId: string }} params
 */
export async function openMarketplaceConversation(sql, { buyerId, sellerId, productId }) {
  const buyer = assertUuid(buyerId, "buyer_id");
  const seller = assertUuid(sellerId, "seller_id");
  const product = assertUuid(productId, "product_id");

  const [productRow] = await sql`
    select id, seller_id, name
    from products
    where id = ${product}
    limit 1
  `;
  if (!productRow) {
    throw new MarketplaceChatOpenError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }
  if (String(productRow.seller_id) !== seller) {
    throw new MarketplaceChatOpenError("Product does not belong to this seller", 400, "PRODUCT_SELLER_MISMATCH");
  }

  const existing = await findCanonicalMarketplaceConversation(sql, buyer, seller);
  const supersededConversationIds = existing
    ? await listSupersededConversationIds(sql, buyer, seller, existing.id)
    : [];

  if (existing) {
    await addProductShareOnOpen(sql, existing, product);
    const [updated] = await sql`
      select * from conversations where id = ${existing.id} limit 1
    `;
    return {
      conversationId: existing.id,
      canonicalConversationId: existing.id,
      created: false,
      productShareAdded: true,
      supersededConversationIds,
      conversation: updated || existing,
    };
  }

  const [created] = await sql`
    insert into conversations ${sql({
      buyer_id: buyer,
      seller_id: seller,
      product_id: product,
      conversation_kind: MARKETPLACE_KIND,
    })}
    returning *
  `;
  if (!created) {
    throw new MarketplaceChatOpenError("Could not start conversation", 500, "CREATE_FAILED");
  }

  await ensureConversationAnchorProductShare(sql, created);

  return {
    conversationId: created.id,
    canonicalConversationId: created.id,
    created: true,
    productShareAdded: true,
    supersededConversationIds: [],
    conversation: created,
  };
}
