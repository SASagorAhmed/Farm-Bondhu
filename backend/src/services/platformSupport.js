import sql from "../db.js";
import { ensureConversationAnchorProductShare } from "./chatAnchorProduct.js";

const SHOP_NAME = "FarmBondhu Support";
const PRODUCT_NAME = "Customer Support";
const PRODUCT_SELLER_NAME = "FarmBondhu Support";
const SUPPORT_KIND = "platform_support";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function profileIdByEmail(email) {
  const em = normalizeEmail(email);
  if (!em) return null;
  const [row] = await sql`
    select id from profiles where lower(trim(email)) = ${em} limit 1
  `;
  return row?.id || null;
}

export async function getPlatformSupportSellerId() {
  const envEmail =
    process.env.PLATFORM_SUPPORT_SELLER_EMAIL || process.env.OFFICIAL_SUPER_ADMIN_EMAIL;
  if (envEmail) {
    const id = await profileIdByEmail(envEmail);
    if (id) return id;
  }

  const [shopRow] = await sql`
    select user_id from shops where shop_name = ${SHOP_NAME} limit 1
  `;
  if (shopRow?.user_id) return shopRow.user_id;

  const [productRow] = await sql`
    select seller_id from products where name = ${PRODUCT_NAME} order by created_at asc limit 1
  `;
  return productRow?.seller_id || null;
}

export async function isPlatformSupportSellerId(sellerId) {
  if (!sellerId) return false;
  const officialId = await getPlatformSupportSellerId();
  return Boolean(officialId && officialId === sellerId);
}

export function isPlatformSupportConversation(conversation) {
  const topic = String(conversation?.support_topic || "").toLowerCase();
  return (
    String(conversation?.conversation_kind || "marketplace") === SUPPORT_KIND &&
    (topic === "help" || topic === "complaint")
  );
}

export async function ensurePlatformSupportShop(sellerId) {
  if (!sellerId) return null;
  const [shop] = await sql`
    insert into shops (user_id, shop_name, description, status, is_verified, updated_at)
    values (
      ${sellerId},
      ${SHOP_NAME},
      'Official FarmBondhu customer support',
      'approved',
      true,
      now()
    )
    on conflict (user_id) do nothing
    returning user_id, shop_name
  `;
  if (shop) return shop;
  const [existing] = await sql`
    select user_id, shop_name from shops where user_id = ${sellerId} limit 1
  `;
  return existing || null;
}

export async function ensurePlatformSupportProduct(sellerId) {
  if (!sellerId) return null;
  const [existing] = await sql`
    select id, seller_id, name
    from products
    where name = ${PRODUCT_NAME}
      and seller_id = ${sellerId}
    order by created_at asc
    limit 1
  `;
  if (existing?.id) return existing;

  const [created] = await sql`
    insert into products (
      seller_id,
      seller_name,
      name,
      description,
      price,
      stock,
      category,
      is_verified_seller,
      updated_at
    )
    values (
      ${sellerId},
      ${PRODUCT_SELLER_NAME},
      ${PRODUCT_NAME},
      'Internal anchor for platform customer support conversations',
      0,
      0,
      'general',
      true,
      now()
    )
    returning id, seller_id, name
  `;
  return created;
}

export async function getPlatformSupportMeta(fallbackUserId) {
  let sellerId = await getPlatformSupportSellerId();
  if (!sellerId && fallbackUserId) {
    sellerId = fallbackUserId;
  }
  if (!sellerId) return null;

  await ensurePlatformSupportShop(sellerId);
  const product = await ensurePlatformSupportProduct(sellerId);
  if (!product?.id) return null;

  return {
    seller_id: sellerId,
    shop_name: SHOP_NAME,
    support_product_id: product.id,
  };
}

function normalizeTopic(topic) {
  const t = String(topic || "").trim().toLowerCase();
  if (t === "help" || t === "complaint") return t;
  return null;
}

export async function openSupportConversation({ userId, topic, initialMessage }) {
  const normalizedTopic = normalizeTopic(topic);
  if (!normalizedTopic) {
    const err = new Error("topic must be help or complaint");
    err.code = "INVALID_TOPIC";
    throw err;
  }

  const meta = await getPlatformSupportMeta(userId);
  if (!meta) {
    const err = new Error("Platform support is not configured");
    err.code = "NOT_CONFIGURED";
    throw err;
  }

  const { seller_id: sellerId, support_product_id: productId } = meta;

  const [existing] = await sql`
    select id, buyer_id, seller_id, product_id, support_topic, support_status
    from conversations
    where buyer_id = ${userId}
      and seller_id = ${sellerId}
      and coalesce(conversation_kind, 'marketplace') = ${SUPPORT_KIND}
      and support_topic = ${normalizedTopic}
      and coalesce(support_status, 'open') = 'open'
    order by coalesce(last_message_at, created_at) desc
    limit 1
  `;

  let conversation = existing;
  if (!conversation) {
    const [created] = await sql`
      insert into conversations (
        buyer_id,
        seller_id,
        product_id,
        conversation_kind,
        support_topic,
        support_status
      )
      values (
        ${userId},
        ${sellerId},
        ${productId},
        ${SUPPORT_KIND},
        ${normalizedTopic},
        'open'
      )
      returning *
    `;
    conversation = created;
    await ensureConversationAnchorProductShare(sql, conversation);
  }

  const messageText = String(initialMessage || "").trim();
  if (messageText) {
    const preview = messageText.slice(0, 500);
    await sql`
      insert into chat_messages (
        conversation_id,
        sender_id,
        sender_role,
        message_type,
        text_body
      )
      values (
        ${conversation.id},
        ${userId},
        'buyer',
        'text',
        ${preview}
      )
    `;
    await sql`
      update conversations
      set
        last_message = ${preview},
        last_message_at = now(),
        last_sender_id = ${userId},
        last_sender_role = 'buyer',
        updated_at = now()
      where id = ${conversation.id}
    `;
  }

  return {
    conversation_id: conversation.id,
    support_topic: normalizedTopic,
    support_status: conversation.support_status || "open",
  };
}

export async function listUserSupportInbox(userId) {
  return sql`
    select
      c.id,
      c.buyer_id,
      c.seller_id,
      c.product_id,
      c.support_topic,
      c.support_status,
      coalesce(c.last_message, 'Started a conversation') as last_message,
      coalesce(c.last_message_at, c.created_at) as last_message_at,
      ${SHOP_NAME} as shop_name
    from conversations c
    where c.buyer_id = ${userId}
      and coalesce(c.conversation_kind, 'marketplace') = ${SUPPORT_KIND}
      and c.support_topic in ('help', 'complaint')
    order by coalesce(c.last_message_at, c.created_at) desc nulls last
    limit 100
  `;
}

export async function resolveSupportConversation(conversationId) {
  const [row] = await sql`
    update conversations
    set support_status = 'resolved', updated_at = now()
    where id = ${conversationId}
      and coalesce(conversation_kind, 'marketplace') = ${SUPPORT_KIND}
      and support_topic in ('help', 'complaint')
    returning id, support_status
  `;
  return row || null;
}
