import sql from "../db.js";

const MARKETPLACE_SELLER_FALLBACK = "Marketplace seller";
const SUPPORT_SHOP_LABEL = "FarmBondhu Support";

/**
 * @param {import("postgres").Sql} db
 * @param {{ type?: string, status?: string, limit?: number }} opts
 */
export async function listModerationReports(db, opts = {}) {
  const type = String(opts.type || "all").toLowerCase();
  const status = String(opts.status || "pending").toLowerCase();
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 400);
  const includeCommunity = type === "all" || type === "community";
  const includeMarketplace = type === "all" || type === "marketplace";
  const statusFilter = status === "all" ? null : status === "resolved" ? "resolved" : "pending";

  const rows = [];

  if (includeCommunity) {
    const communityRows = await db`
      select
        cr.id,
        'community'::text as type,
        case when cr.status in ('resolved', 'closed') then 'resolved' else 'pending' end as status,
        cr.reason,
        cr.details::text as details,
        cr.created_at,
        cr.reported_by,
        rp.name as reporter_name,
        cr.post_id,
        cp.title as post_title
      from community_reports cr
      left join profiles rp on rp.id = cr.reported_by
      left join community_posts cp on cp.id = cr.post_id
      where (
        ${statusFilter === null}::boolean = true
        or (
          ${statusFilter === "pending"}::boolean = true
          and coalesce(cr.status, 'open') not in ('resolved', 'closed')
        )
        or (
          ${statusFilter === "resolved"}::boolean = true
          and coalesce(cr.status, 'open') in ('resolved', 'closed')
        )
      )
      order by cr.created_at desc
      limit ${limit}
    `;
    for (const r of communityRows) {
      const summary = r.post_title
        ? `Post: ${String(r.post_title).slice(0, 80)}`
        : r.post_id
          ? `Post ${String(r.post_id).slice(0, 8)}…`
          : "Community content";
      rows.push({
        id: r.id,
        type: "community",
        status: r.status,
        reason: r.reason || "",
        details: r.details || null,
        created_at: r.created_at,
        reporter: { id: r.reported_by, name: r.reporter_name || "Unknown" },
        target: {
          summary,
          post_id: r.post_id || null,
        },
        action_url: "/admin/community",
      });
    }
  }

  if (includeMarketplace) {
    const marketplaceRows = await db`
      select
        mcr.id,
        'marketplace'::text as type,
        case when mcr.status = 'resolved' then 'resolved' else 'pending' end as status,
        mcr.reason,
        mcr.details,
        mcr.created_at,
        mcr.reported_by,
        mcr.reporter_role,
        mcr.conversation_id,
        rp.name as reporter_name,
        bp.name as buyer_name,
        sp.name as seller_name,
        spp.phone as seller_phone,
        coalesce(
          nullif(trim(s.shop_name), ${SUPPORT_SHOP_LABEL}),
          nullif(trim(ar.request_shop_name), ${SUPPORT_SHOP_LABEL}),
          nullif(trim(s.shop_name), ''),
          nullif(trim(ar.request_shop_name), ''),
          ${MARKETPLACE_SELLER_FALLBACK}
        ) as shop_name,
        p.name as product_name
      from marketplace_conversation_reports mcr
      join conversations c on c.id = mcr.conversation_id
      left join profiles rp on rp.id = mcr.reported_by
      left join profiles bp on bp.id = c.buyer_id
      left join profiles sp on sp.id = c.seller_id
      left join profiles spp on spp.id = c.seller_id
      left join shops s on s.user_id = c.seller_id
      left join lateral (
        select trim(coalesce(ar.details->>'shopName', ar.payload->>'shopName', '')) as request_shop_name
        from approval_requests ar
        where ar.user_id = c.seller_id
          and ar.request_type = 'shop_access'
          and ar.status = 'approved'
        order by ar.updated_at desc
        limit 1
      ) ar on true
      left join products p on p.id = c.product_id
      where coalesce(c.conversation_kind, 'marketplace') = 'marketplace'
        and (
          ${statusFilter === null}::boolean = true
          or mcr.status = ${statusFilter || "pending"}
        )
      order by mcr.created_at desc
      limit ${limit}
    `;
    for (const r of marketplaceRows) {
      const sellerLine = [r.shop_name, r.seller_name, r.seller_phone].filter(Boolean).join(" · ");
      rows.push({
        id: r.id,
        type: "marketplace",
        status: r.status,
        reason: r.reason || "",
        details: r.details || null,
        created_at: r.created_at,
        reporter: {
          id: r.reported_by,
          name: r.reporter_name || "Unknown",
          role: r.reporter_role,
        },
        target: {
          summary: r.product_name
            ? `${r.buyer_name || "Buyer"} ↔ ${sellerLine || r.seller_name || "Seller"} (${r.product_name})`
            : `${r.buyer_name || "Buyer"} ↔ ${sellerLine || r.seller_name || "Seller"}`,
          conversation_id: r.conversation_id,
          buyer_name: r.buyer_name,
          seller_name: r.seller_name,
          shop_name: r.shop_name,
          seller_phone: r.seller_phone,
          product_name: r.product_name,
        },
        action_url: `/admin/marketplace/messages?conversation=${r.conversation_id}`,
      });
    }
  }

  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return rows.slice(0, limit);
}

/** @param {import("postgres").Sql} db @param {string} reportId */
export async function resolveMarketplaceReport(db, reportId) {
  const [updated] = await db`
    update marketplace_conversation_reports
    set status = 'resolved', updated_at = now()
    where id = ${reportId}
    returning *
  `;
  return updated || null;
}

/** @param {import("postgres").Sql} db @param {string} conversationId @param {string} userId */
export async function conversationHasPendingReport(db, conversationId) {
  const [row] = await db`
    select 1 as ok
    from marketplace_conversation_reports
    where conversation_id = ${conversationId}
      and status = 'pending'
    limit 1
  `;
  return Boolean(row);
}

/** Admin may read marketplace threads only when a user has filed a report. */
export async function conversationHasModerationAccess(db, conversationId) {
  const [row] = await db`
    select 1 as ok
    from marketplace_conversation_reports
    where conversation_id = ${conversationId}
    limit 1
  `;
  return Boolean(row);
}

/** @param {import("postgres").Sql} db @param {string} conversationId @param {string} userId */
export async function userHasReportedConversation(db, conversationId, userId) {
  const [row] = await db`
    select 1 as ok
    from marketplace_conversation_reports
    where conversation_id = ${conversationId}
      and reported_by = ${userId}
    limit 1
  `;
  return Boolean(row);
}
