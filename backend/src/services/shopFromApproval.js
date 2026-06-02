/** @param {unknown} row */
export function parseApprovalShopDetails(row) {
  const raw = row?.details ?? row?.payload ?? {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? raw : {};
}

/** @param {import("postgres").Sql} sql @param {Record<string, unknown>} requestRow */
export async function upsertShopFromApprovalRequest(sql, requestRow) {
  if (!requestRow || requestRow.request_type !== "shop_access" || requestRow.status !== "approved") {
    return null;
  }

  const details = parseApprovalShopDetails(requestRow);
  const shopName = String(details.shopName || details.shop_name || "").trim();
  if (!shopName) return null;

  const description = String(details.description || "").trim() || null;
  const userId = requestRow.user_id;

  const [shop] = await sql`
    insert into shops (user_id, shop_name, description, updated_at)
    values (${userId}, ${shopName}, ${description}, now())
    on conflict (user_id) do update set
      shop_name = excluded.shop_name,
      description = coalesce(excluded.description, shops.description),
      updated_at = now()
    returning *
  `;
  return shop || null;
}
