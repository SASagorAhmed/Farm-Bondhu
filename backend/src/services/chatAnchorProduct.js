/**
 * Ensures the conversation anchor product_share exists (idempotent).
 * Does not update conversations.last_message when the thread already has messages.
 *
 * @param {import("postgres").Sql} sql
 * @param {{ id: string; buyer_id: string; seller_id: string; product_id?: string | null; created_at?: string | Date | null }} conversation
 */
export async function ensureConversationAnchorProductShare(sql, conversation) {
  const productId = conversation.product_id;
  if (!productId) {
    return { created: false, message: null };
  }

  const [existing] = await sql`
    select id
    from chat_messages
    where conversation_id = ${conversation.id}
      and message_type = 'product_share'
      and shared_product_id = ${productId}
    limit 1
  `;
  if (existing) {
    return { created: false, message: null };
  }

  const [countRow] = await sql`
    select count(*)::int as n
    from chat_messages
    where conversation_id = ${conversation.id}
  `;
  const hasOtherMessages = Number(countRow?.n || 0) > 0;

  const [product] = await sql`
    select name from products where id = ${productId} limit 1
  `;
  const preview = product?.name ? `Shared: ${product.name}` : "Shared a product";
  const anchorCreatedAt = conversation.created_at
    ? new Date(conversation.created_at).toISOString()
    : new Date().toISOString();

  const [inserted] = await sql`
    insert into chat_messages ${sql({
      conversation_id: conversation.id,
      sender_id: conversation.buyer_id,
      sender_role: "buyer",
      message_type: "product_share",
      shared_product_id: productId,
      created_at: anchorCreatedAt,
    })}
    returning *
  `;

  if (!hasOtherMessages) {
    await sql`
      update conversations
      set
        last_message = ${preview},
        last_message_at = ${anchorCreatedAt},
        last_sender_id = ${conversation.buyer_id},
        last_sender_role = 'buyer'
      where id = ${conversation.id}
    `;
  }

  return { created: true, message: inserted };
}

/** @param {{ message_type?: string; shared_product_id?: string | null }} msg @param {string | null | undefined} productId */
export function isAnchorProductShareMessage(msg, productId) {
  return (
    msg?.message_type === "product_share" &&
    Boolean(productId) &&
    msg.shared_product_id === productId
  );
}
