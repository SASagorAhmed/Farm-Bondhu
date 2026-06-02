import sql from "../db.js";

/** @param {string} sellerId */
export async function getShopLiveStats(sellerId) {
  const [products] = await sql`
    select count(*)::int as total_products
    from products
    where seller_id = ${sellerId}
      and listing_status = 'approved'
  `;
  const [units] = await sql`
    select coalesce(sum(
      coalesce(
        nullif(item->>'qty', '')::int,
        nullif(item->>'quantity', '')::int,
        0
      )
    ), 0)::int as total_units_sold
    from orders o
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
    ) as item
    where o.seller_id = ${sellerId}
      and o.status = 'delivered'
  `;
  return {
    total_products: products?.total_products ?? 0,
    total_units_sold: units?.total_units_sold ?? 0,
  };
}

/** @param {Record<string, unknown> | null | undefined} shop @param {string} sellerId */
export async function enrichShopWithLiveStats(shop, sellerId) {
  const stats = await getShopLiveStats(sellerId);
  if (!shop) {
    return { user_id: sellerId, ...stats };
  }
  return { ...shop, ...stats };
}
