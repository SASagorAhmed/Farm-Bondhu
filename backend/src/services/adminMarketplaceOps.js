import sql from "../db.js";
import { getModerationState } from "./adminMarketplaceModeration.js";

const UUID_RE = /^[0-9a-f-]{36}$/i;

function clampLimit(value, fallback = 50, max = 200) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

function clampOffset(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function searchPattern(search) {
  const s = String(search || "").trim();
  if (!s) return null;
  return `%${s.replace(/[%_\\]/g, "\\$&")}%`;
}

export async function listAdminBuyers({ search, limit, offset }) {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const pattern = searchPattern(search);

  const rows = await sql`
    with buyer_ids as (
      select distinct user_id as id from user_roles where role = 'buyer'
      union
      select distinct user_id as id from user_capabilities
      where capability_code = 'can_buy' and is_enabled = true
      union
      select distinct buyer_id as id from orders
    ),
    order_stats as (
      select
        buyer_id,
        count(*)::int as order_count,
        coalesce(sum(total), 0)::numeric as total_spent,
        max(created_at) as last_order_at
      from orders
      group by buyer_id
    ),
    role_agg as (
      select user_id, array_agg(role order by role) as roles
      from user_roles
      group by user_id
    )
    select
      p.id,
      p.name,
      p.email,
      p.phone,
      p.location,
      p.status,
      p.primary_role,
      p.avatar_url,
      p.created_at,
      coalesce(ra.roles, array[]::text[]) as roles,
      coalesce(os.order_count, 0) as order_count,
      coalesce(os.total_spent, 0) as total_spent,
      os.last_order_at,
      (
        exists (
          select 1 from user_capabilities uc
          where uc.user_id = p.id and uc.capability_code = 'can_buy' and uc.is_enabled = false
        )
      ) as marketplace_blocked
    from buyer_ids b
    join profiles p on p.id = b.id
    left join order_stats os on os.buyer_id = p.id
    left join role_agg ra on ra.user_id = p.id
    where (
      ${pattern}::text is null
      or p.name ilike ${pattern}
      or p.email ilike ${pattern}
      or coalesce(p.phone, '') ilike ${pattern}
    )
    order by coalesce(os.last_order_at, p.created_at) desc nulls last
    limit ${lim} offset ${off}
  `;

  const [{ count }] = await sql`
    with buyer_ids as (
      select distinct user_id as id from user_roles where role = 'buyer'
      union
      select distinct user_id as id from user_capabilities
      where capability_code = 'can_buy' and is_enabled = true
      union
      select distinct buyer_id as id from orders
    )
    select count(*)::int as count
    from buyer_ids b
    join profiles p on p.id = b.id
    where (
      ${pattern}::text is null
      or p.name ilike ${pattern}
      or p.email ilike ${pattern}
      or coalesce(p.phone, '') ilike ${pattern}
    )
  `;

  return { data: rows, total: count, limit: lim, offset: off };
}

export async function getAdminBuyerDetail(id) {
  if (!UUID_RE.test(id)) return null;

  const [profile] = await sql`
    select
      p.*,
      coalesce(
        (select array_agg(role order by role) from user_roles ur where ur.user_id = p.id),
        array[]::text[]
      ) as roles
    from profiles p
    where p.id = ${id}
    limit 1
  `;
  if (!profile) return null;

  const recentOrders = await sql`
    select id, status, total, payment_status, payment_method, created_at, seller_name
    from orders
    where buyer_id = ${id}
    order by created_at desc
    limit 20
  `;

  const [{ address_count }] = await sql`
    select count(*)::int as address_count from user_addresses where user_id = ${id}
  `;

  const [{ order_count, total_spent, last_order_at }] = await sql`
    select
      count(*)::int as order_count,
      coalesce(sum(total), 0)::numeric as total_spent,
      max(created_at) as last_order_at
    from orders
    where buyer_id = ${id}
  `;

  const moderation = await getModerationState(id, "buyer");

  return {
    profile,
    roles: profile.roles || [],
    stats: { order_count, total_spent, last_order_at },
    address_count,
    recent_orders: recentOrders,
    marketplace_blocked: moderation.marketplace_blocked,
    status: moderation.status,
  };
}

export async function listAdminSellers({ search, verified, limit, offset }) {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const pattern = searchPattern(search);
  const verifiedFilter =
    verified === "yes" ? true : verified === "no" ? false : null;

  const rows = await sql`
    with product_counts as (
      select seller_id, count(*)::int as product_count
      from products
      group by seller_id
    ),
    order_stats as (
      select
        seller_id,
        count(*)::int as order_count,
        coalesce(sum(total), 0)::numeric as revenue
      from orders
      group by seller_id
    ),
    role_agg as (
      select user_id, array_agg(role order by role) as roles
      from user_roles
      group by user_id
    )
    select
      s.user_id,
      s.shop_name,
      s.description,
      s.location,
      s.status,
      s.is_verified,
      s.total_products,
      s.total_sales,
      s.created_at,
      s.created_date,
      s.logo_url,
      p.name as owner_name,
      p.avatar_url as owner_avatar_url,
      p.email as owner_email,
      p.phone as owner_phone,
      p.status as owner_status,
      coalesce(ra.roles, array[]::text[]) as roles,
      coalesce(pc.product_count, 0) as product_count,
      coalesce(os.order_count, 0) as order_count,
      coalesce(os.revenue, 0) as revenue,
      (
        s.status = 'blocked'
        or exists (
          select 1 from user_capabilities uc
          where uc.user_id = s.user_id and uc.capability_code = 'can_sell' and uc.is_enabled = false
        )
      ) as marketplace_blocked
    from shops s
    join profiles p on p.id = s.user_id
    left join product_counts pc on pc.seller_id = s.user_id
    left join order_stats os on os.seller_id = s.user_id
    left join role_agg ra on ra.user_id = s.user_id
    where (
      ${pattern}::text is null
      or s.shop_name ilike ${pattern}
      or p.name ilike ${pattern}
      or p.email ilike ${pattern}
      or coalesce(p.phone, '') ilike ${pattern}
      or coalesce(s.location, '') ilike ${pattern}
    )
    and (
      ${verifiedFilter}::boolean is null
      or s.is_verified = ${verifiedFilter}
    )
    order by coalesce(os.revenue, 0) desc, s.created_at desc
    limit ${lim} offset ${off}
  `;

  const [{ count }] = await sql`
    select count(*)::int as count
    from shops s
    join profiles p on p.id = s.user_id
    where (
      ${pattern}::text is null
      or s.shop_name ilike ${pattern}
      or p.name ilike ${pattern}
      or p.email ilike ${pattern}
      or coalesce(p.phone, '') ilike ${pattern}
      or coalesce(s.location, '') ilike ${pattern}
    )
    and (
      ${verifiedFilter}::boolean is null
      or s.is_verified = ${verifiedFilter}
    )
  `;

  return { data: rows, total: count, limit: lim, offset: off };
}

export async function getAdminSellerDetail(userId) {
  if (!UUID_RE.test(userId)) return null;

  const [shop] = await sql`
    select s.*, p.name as owner_name, p.email as owner_email, p.phone as owner_phone,
      p.status as owner_status, p.location as owner_location, p.avatar_url as owner_avatar_url,
      p.created_at as owner_joined
    from shops s
    join profiles p on p.id = s.user_id
    where s.user_id = ${userId}
    limit 1
  `;
  if (!shop) return null;

  const roles = await sql`
    select role from user_roles where user_id = ${userId} order by role
  `;

  const products = await sql`
    select id, name, price, stock, category, is_verified_seller, created_at
    from products
    where seller_id = ${userId}
    order by created_at desc
    limit 20
  `;

  const recentOrders = await sql`
    select id, status, total, payment_status, buyer_name, created_at
    from orders
    where seller_id = ${userId}
    order by created_at desc
    limit 20
  `;

  const [{ product_count }] = await sql`
    select count(*)::int as product_count from products where seller_id = ${userId}
  `;

  const [{ order_count, revenue }] = await sql`
    select count(*)::int as order_count, coalesce(sum(total), 0)::numeric as revenue
    from orders where seller_id = ${userId}
  `;

  const moderation = await getModerationState(userId, "seller");

  return {
    shop,
    roles: roles.map((r) => r.role),
    stats: { product_count, order_count, revenue },
    products,
    recent_orders: recentOrders,
    marketplace_blocked: moderation.marketplace_blocked,
    owner_status: moderation.status,
  };
}

export async function listAdminOrders({ status, payment_status, search, limit, offset }) {
  const lim = clampLimit(limit, 50, 500);
  const off = clampOffset(offset);
  const pattern = searchPattern(search);
  const statusFilter = status && status !== "all" ? String(status) : null;
  const paymentFilter = payment_status && payment_status !== "all" ? String(payment_status) : null;

  const rows = await sql`
    select *
    from orders
    where (${statusFilter}::text is null or status = ${statusFilter})
      and (${paymentFilter}::text is null or payment_status = ${paymentFilter})
      and (
        ${pattern}::text is null
        or buyer_name ilike ${pattern}
        or seller_name ilike ${pattern}
        or id::text ilike ${pattern}
      )
    order by created_at desc
    limit ${lim} offset ${off}
  `;

  const [{ count }] = await sql`
    select count(*)::int as count
    from orders
    where (${statusFilter}::text is null or status = ${statusFilter})
      and (${paymentFilter}::text is null or payment_status = ${paymentFilter})
      and (
        ${pattern}::text is null
        or buyer_name ilike ${pattern}
        or seller_name ilike ${pattern}
        or id::text ilike ${pattern}
      )
  `;

  return { data: rows, total: count, limit: lim, offset: off };
}

export async function getAdminOrderDetail(id) {
  if (!UUID_RE.test(id)) return null;
  const [row] = await sql`select * from orders where id = ${id} limit 1`;
  return row || null;
}

function parseTimeline(timeline) {
  if (!timeline) return [];
  if (Array.isArray(timeline)) return timeline;
  if (typeof timeline === "string") {
    try {
      const parsed = JSON.parse(timeline);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function listAdminTransactions({ type, status, from, to, limit, offset }) {
  const lim = clampLimit(limit, 50, 500);
  const off = clampOffset(offset);
  const typeFilter = type && type !== "all" ? String(type) : null;
  const statusFilter = status && status !== "all" ? String(status) : null;

  let fromDate = null;
  let toDate = null;
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) fromDate = d.toISOString();
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) toDate = d.toISOString();
  }

  const orders = await sql`
    select *
    from orders
    where (${fromDate}::timestamptz is null or created_at >= ${fromDate})
      and (${toDate}::timestamptz is null or created_at <= ${toDate})
    order by created_at desc
    limit 1000
  `;

  const transactions = [];

  for (const order of orders) {
    const base = {
      order_id: order.id,
      buyer_name: order.buyer_name,
      seller_name: order.seller_name,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      order_status: order.status,
    };

    const paymentRow = {
      id: `${order.id}:payment`,
      type: "order_payment",
      amount: Number(order.total || 0),
      status: order.payment_status || "unpaid",
      note: null,
      created_at: order.created_at,
      ...base,
    };
    if (!typeFilter || typeFilter === "order_payment") {
      if (!statusFilter || statusFilter === paymentRow.status) {
        transactions.push(paymentRow);
      }
    }

    const timeline = parseTimeline(order.timeline);
    for (let i = 0; i < timeline.length; i++) {
      const entry = timeline[i] || {};
      const row = {
        id: `${order.id}:fulfillment:${i}`,
        type: "fulfillment",
        amount: Number(order.total || 0),
        status: entry.status || order.status,
        note: entry.note || null,
        created_at: entry.timestamp || order.created_at,
        ...base,
      };
      if (!typeFilter || typeFilter === "fulfillment") {
        if (!statusFilter || statusFilter === row.status) {
          transactions.push(row);
        }
      }
    }

    const isRefund =
      order.payment_status === "refunded" ||
      order.status === "refunded" ||
      order.status === "returned";
    if (isRefund) {
      const refundRow = {
        id: `${order.id}:refund`,
        type: "refund",
        amount: Number(order.total || 0),
        status: order.payment_status === "refunded" ? "refunded" : order.status,
        note: order.return_reason || order.return_note || null,
        created_at: order.updated_at || order.created_at,
        ...base,
      };
      if (!typeFilter || typeFilter === "refund") {
        if (!statusFilter || statusFilter === refundRow.status) {
          transactions.push(refundRow);
        }
      }
    }
  }

  transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const total = transactions.length;
  const page = transactions.slice(off, off + lim);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent = transactions.filter((t) => new Date(t.created_at) >= thirtyDaysAgo);
  const summary = {
    total_volume: recent
      .filter((t) => t.type === "order_payment")
      .reduce((s, t) => s + Number(t.amount || 0), 0),
    paid_count: recent.filter((t) => t.type === "order_payment" && t.status === "paid").length,
    unpaid_count: recent.filter((t) => t.type === "order_payment" && t.status !== "paid").length,
    refund_count: recent.filter((t) => t.type === "refund").length,
  };

  return { data: page, total, limit: lim, offset: off, summary };
}
