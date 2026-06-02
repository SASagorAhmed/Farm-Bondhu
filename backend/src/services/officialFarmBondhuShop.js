import sql from "../db.js";

const SHOP_NAME = "FarmBondhu";

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

/** Earliest FarmBondhu product seller, or official super-admin profile when no products yet. */
export async function getOfficialFarmBondhuSellerId() {
  const [productRow] = await sql`
    select seller_id
    from products
    where seller_name = ${SHOP_NAME}
    order by created_at asc
    limit 1
  `;
  if (productRow?.seller_id) return productRow.seller_id;

  const envEmail = process.env.OFFICIAL_SUPER_ADMIN_EMAIL;
  if (envEmail) {
    const id = await profileIdByEmail(envEmail);
    if (id) return id;
  }
  return null;
}

export async function isOfficialFarmBondhuSellerId(sellerId) {
  if (!sellerId) return false;
  const officialId = await getOfficialFarmBondhuSellerId();
  return Boolean(officialId && officialId === sellerId);
}

export async function ensureOfficialFarmBondhuShop(sellerId) {
  if (!sellerId) return null;
  const [shop] = await sql`
    insert into shops (user_id, shop_name, description, status, is_verified, updated_at)
    values (
      ${sellerId},
      ${SHOP_NAME},
      'Official FarmBondhu marketplace shop',
      'approved',
      true,
      now()
    )
    on conflict (user_id) do update set
      shop_name = excluded.shop_name,
      status = 'approved',
      is_verified = true,
      updated_at = now()
    returning user_id, shop_name
  `;
  return shop;
}

export async function getOfficialFarmBondhuShopMeta(fallbackUserId) {
  let sellerId = await getOfficialFarmBondhuSellerId();
  if (!sellerId && fallbackUserId) {
    sellerId = fallbackUserId;
  }
  if (!sellerId) {
    return null;
  }
  await ensureOfficialFarmBondhuShop(sellerId);
  return { seller_id: sellerId, shop_name: SHOP_NAME };
}

/** Resolve official shop seller id for admin APIs; uses fallback admin user when no products yet. */
export async function resolveOfficialShopSellerId(fallbackUserId) {
  const meta = await getOfficialFarmBondhuShopMeta(fallbackUserId);
  return meta?.seller_id ?? null;
}
