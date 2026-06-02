import sql from "../db.js";

const PLATFORM_FEE_RATE = 0.15;

function toTextOrNull(value) {
  const text = value == null ? "" : String(value).trim();
  return text ? text : null;
}

export function toMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export async function computeSellerEarningsSummary(sellerUserId) {
  const [grossRow] = await sql`
    select
      coalesce(sum(coalesce(total, 0)), 0) as gross_earnings,
      count(*)::int as order_count
    from orders
    where seller_id = ${sellerUserId}
      and status = 'delivered'
  `;
  const [monthlyRow] = await sql`
    select
      coalesce(sum(coalesce(total, 0)), 0) as monthly_gross
    from orders
    where seller_id = ${sellerUserId}
      and status = 'delivered'
      and date_trunc('month', coalesce(updated_at, created_at)) = date_trunc('month', now())
  `;
  let withdrawRow = { withdrawn_total: 0, pending_withdraw_total: 0 };
  try {
    [withdrawRow] = await sql`
      select
        coalesce(sum(case when status in ('approved', 'paid') then request_amount else 0 end), 0) as withdrawn_total,
        coalesce(sum(case when status = 'pending' then request_amount else 0 end), 0) as pending_withdraw_total
      from seller_withdrawals
      where seller_user_id = ${sellerUserId}
    `;
  } catch (e) {
    const code = /** @type {{ code?: string }} */ (e)?.code;
    if (code !== "42P01") throw e;
  }
  const gross = toMoney(grossRow?.gross_earnings || 0);
  const monthlyGross = toMoney(monthlyRow?.monthly_gross || 0);
  const platformFee = toMoney(gross * PLATFORM_FEE_RATE);
  const net = toMoney(gross - platformFee);
  const withdrawnTotal = toMoney(withdrawRow?.withdrawn_total || 0);
  const pendingWithdrawTotal = toMoney(withdrawRow?.pending_withdraw_total || 0);
  const availableBalance = toMoney(Math.max(0, net - withdrawnTotal - pendingWithdrawTotal));

  return {
    gross_earnings: gross,
    order_count: Number(grossRow?.order_count || 0),
    monthly_gross: monthlyGross,
    platform_fee_rate: PLATFORM_FEE_RATE,
    platform_fee: platformFee,
    net_earnings: net,
    withdrawn_total: withdrawnTotal,
    pending_withdraw_total: pendingWithdrawTotal,
    available_balance: availableBalance,
  };
}

const ELIGIBILITY_RULE_KEY = "delivered_only";

export function mapSellerEarningsOrderRow(r) {
  return {
    id: r.id,
    buyer_name: r.buyer_name || "Customer",
    total: toMoney(r.total || 0),
    status: r.status,
    payment_status: r.payment_status,
    created_at: r.created_at,
    updated_at: r.updated_at,
    delivered_at: r.updated_at || r.created_at,
  };
}

export async function fetchSellerEarningsBreakdown(sellerUserId) {
  const summary = await computeSellerEarningsSummary(sellerUserId);

  const includedRows = await sql`
    select id, buyer_name, total, status, payment_status, created_at, updated_at
    from orders
    where seller_id = ${sellerUserId}
      and status = 'delivered'
    order by coalesce(updated_at, created_at) desc
  `;
  const included_orders = includedRows.map(mapSellerEarningsOrderRow);
  const included_total = toMoney(
    included_orders.reduce((sum, o) => sum + o.total, 0),
  );
  const gross_earnings = summary.gross_earnings;
  const matches = Math.abs(included_total - gross_earnings) < 0.01;

  const excludedByStatusRows = await sql`
    select
      status,
      count(*)::int as count,
      coalesce(sum(coalesce(total, 0)), 0) as total_amount
    from orders
    where seller_id = ${sellerUserId}
      and status is distinct from 'delivered'
    group by status
    order by total_amount desc nulls last, count desc
  `;
  const excluded_by_status = excludedByStatusRows.map((r) => ({
    status: r.status || "unknown",
    count: Number(r.count || 0),
    total_amount: toMoney(r.total_amount || 0),
  }));

  const excludedSampleRows = await sql`
    select id, buyer_name, total, status, payment_status, created_at, updated_at
    from (
      select
        id, buyer_name, total, status, payment_status, created_at, updated_at,
        row_number() over (
          partition by status
          order by coalesce(updated_at, created_at) desc
        ) as rn
      from orders
      where seller_id = ${sellerUserId}
        and status is distinct from 'delivered'
    ) sub
    where rn <= 5
    order by status, coalesce(updated_at, created_at) desc
    limit 100
  `;
  const excluded_sample = excludedSampleRows.map(mapSellerEarningsOrderRow);

  return {
    eligibility_rule: ELIGIBILITY_RULE_KEY,
    included_orders,
    included_total,
    included_count: included_orders.length,
    excluded_by_status,
    excluded_sample,
    summary,
    verification: {
      listed_included_sum: included_total,
      gross_earnings,
      matches,
    },
  };
}

export async function fetchSellerMonthlyTrend(sellerUserId, months = 6) {
  const rows = await sql`
    select
      to_char(date_trunc('month', coalesce(updated_at, created_at)), 'Mon') as month_label,
      date_trunc('month', coalesce(updated_at, created_at)) as month_start,
      coalesce(sum(coalesce(total, 0)), 0) as amount
    from orders
    where seller_id = ${sellerUserId}
      and status = 'delivered'
      and coalesce(updated_at, created_at) >= date_trunc('month', now()) - (${months - 1} * interval '1 month')
    group by 1, 2
    order by month_start asc
  `;
  return rows.map((r) => ({
    month: r.month_label,
    amount: toMoney(r.amount || 0),
  }));
}

async function listPlatformAdminUserIds() {
  const rows = await sql`
    select distinct user_id
    from user_roles
    where role = 'admin'
  `;
  return rows.map((r) => r.user_id).filter(Boolean);
}

async function insertSellerPayoutNotification({ userId, type, title, message, actionUrl, priority = "normal" }) {
  const url = actionUrl || null;
  try {
    await sql`
      insert into notifications ${sql({
        user_id: userId,
        type,
        context: "marketplace",
        priority,
        title,
        message,
        link: url,
        action_url: url,
        read: false,
        created_at: new Date().toISOString(),
      })}
    `;
  } catch (err) {
    console.error("[sellerPayouts] notification insert failed:", err?.message || err);
  }
}

async function loadSellerPayoutSellerMeta(sellerUserId) {
  const [row] = await sql`
    select p.name as seller_name, s.shop_name
    from profiles p
    left join shops s on s.user_id = p.id
    where p.id = ${sellerUserId}
    limit 1
  `;
  const shopName = row?.shop_name ? String(row.shop_name).trim() : "";
  const sellerName = row?.seller_name ? String(row.seller_name).trim() : "";
  return shopName || sellerName || "A seller";
}

export async function notifySellerWithdrawalSubmitted(sellerUserId, withdrawal) {
  const amount = toMoney(withdrawal?.request_amount || 0);
  await insertSellerPayoutNotification({
    userId: sellerUserId,
    type: "seller_withdrawal_submitted",
    title: "Withdrawal request submitted",
    message: `Your withdrawal request for ৳${amount.toFixed(2)} is pending admin review.`,
    actionUrl: "/seller/payouts",
    priority: "normal",
  });
}

export async function notifyAdminsNewSellerWithdrawal(withdrawal, sellerUserId) {
  const requestId = withdrawal?.id;
  if (!requestId) return;
  const amount = toMoney(withdrawal?.request_amount || 0);
  const shopLabel = await loadSellerPayoutSellerMeta(sellerUserId);
  const actionUrl = `/admin/marketplace/payouts?request=${encodeURIComponent(String(requestId))}`;
  const adminIds = await listPlatformAdminUserIds();
  await Promise.all(
    adminIds.map((userId) =>
      insertSellerPayoutNotification({
        userId,
        type: "seller_withdrawal_new",
        title: "New seller payout request",
        message: `${shopLabel} requested ৳${amount.toFixed(2)}.`,
        actionUrl,
        priority: "high",
      }),
    ),
  );
}

export async function createSellerWithdrawalReviewNotification(sellerUserId, requestId, status, reviewNote) {
  const title = status === "approved" ? "Withdrawal approved" : "Withdrawal rejected";
  const message = reviewNote
    ? `Your withdrawal request has been ${status}. Reason: ${reviewNote}`
    : `Your withdrawal request has been ${status}.`;
  await insertSellerPayoutNotification({
    userId: sellerUserId,
    type: "seller_withdrawal_review",
    title,
    message,
    actionUrl: "/seller/payouts",
    priority: status === "approved" ? "normal" : "high",
  });
}

export async function listSellerWithdrawalsForUser(sellerUserId) {
  try {
    const rows = await sql`
      select
        id,
        request_amount,
        gross_earnings,
        platform_fee,
        net_earnings,
        available_balance,
        status,
        note,
        review_note,
        reviewed_by,
        reviewed_at,
        paid_at,
        created_at,
        updated_at
      from seller_withdrawals
      where seller_user_id = ${sellerUserId}
      order by created_at desc
      limit 200
    `;
    return rows.map((r) => ({
      ...r,
      request_amount: toMoney(r.request_amount || 0),
      gross_earnings: toMoney(r.gross_earnings || 0),
      platform_fee: toMoney(r.platform_fee || 0),
      net_earnings: toMoney(r.net_earnings || 0),
      available_balance: toMoney(r.available_balance || 0),
    }));
  } catch (e) {
    const code = /** @type {{ code?: string }} */ (e)?.code;
    if (code === "42P01") return [];
    throw e;
  }
}

export async function createSellerWithdrawal(sellerUserId, requestAmount, note) {
  const amount = toMoney(requestAmount);
  const summary = await computeSellerEarningsSummary(sellerUserId);
  if (amount > summary.available_balance) {
    const err = new Error("Requested amount exceeds available balance");
    err.status = 400;
    throw err;
  }
  const [created] = await sql`
    insert into seller_withdrawals ${sql({
      seller_user_id: sellerUserId,
      request_amount: amount,
      gross_earnings: summary.gross_earnings,
      platform_fee: summary.platform_fee,
      net_earnings: summary.net_earnings,
      available_balance: summary.available_balance,
      status: "pending",
      note: toTextOrNull(note),
      review_note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })}
    returning *
  `;
  const result = { ...created, request_amount: toMoney(created.request_amount || 0) };
  try {
    await notifySellerWithdrawalSubmitted(sellerUserId, result);
    await notifyAdminsNewSellerWithdrawal(result, sellerUserId);
  } catch (err) {
    console.error("[sellerPayouts] post-create notifications failed:", err?.message || err);
  }
  return result;
}

export async function listAdminSellerWithdrawals(statusFilter) {
  const status = toTextOrNull(statusFilter);
  const rows = await sql`
    select
      sw.*,
      p.name as seller_name,
      p.email as seller_email,
      s.shop_name
    from seller_withdrawals sw
    left join profiles p on p.id = sw.seller_user_id
    left join shops s on s.user_id = sw.seller_user_id
    where (${status ? sql`sw.status = ${status}` : sql`true`})
    order by sw.created_at desc
    limit 300
  `;
  return rows.map((r) => ({ ...r, request_amount: toMoney(r.request_amount || 0) }));
}

export async function getAdminSellerWithdrawalDetails(requestId) {
  const [request] = await sql`
    select sw.*, p.name as seller_name, p.email as seller_email, p.phone as seller_phone, p.location as seller_location,
      s.shop_name, s.description as shop_description
    from seller_withdrawals sw
    left join profiles p on p.id = sw.seller_user_id
    left join shops s on s.user_id = sw.seller_user_id
    where sw.id = ${requestId}
    limit 1
  `;
  if (!request) return null;
  const summary = await computeSellerEarningsSummary(request.seller_user_id);
  const orders = await sql`
    select id, buyer_name, total, status, payment_status, created_at, updated_at
    from orders
    where seller_id = ${request.seller_user_id}
      and status = 'delivered'
    order by coalesce(updated_at, created_at) desc
    limit 120
  `;
  const requestHistory = await sql`
    select id, request_amount, status, note, review_note, created_at, reviewed_at
    from seller_withdrawals
    where seller_user_id = ${request.seller_user_id}
    order by created_at desc
    limit 30
  `;
  return {
    request: { ...request, request_amount: toMoney(request.request_amount || 0) },
    summary,
    orders: orders.map((o) => ({ ...o, total: toMoney(o.total || 0) })),
    seller_profile: {
      name: request.seller_name,
      email: request.seller_email,
      phone: request.seller_phone,
      location: request.seller_location,
      shop_name: request.shop_name,
      shop_description: request.shop_description,
    },
    request_history: requestHistory.map((r) => ({
      ...r,
      request_amount: toMoney(r.request_amount || 0),
    })),
  };
}

export async function reviewSellerWithdrawal(requestId, adminUserId, action, reviewNote) {
  const [current] = await sql`select * from seller_withdrawals where id = ${requestId} limit 1`;
  if (!current) {
    const err = new Error("Withdrawal request not found");
    err.status = 404;
    throw err;
  }
  if (String(current.status) !== "pending") {
    const err = new Error(`Only pending requests can be ${action}d`);
    err.status = 409;
    throw err;
  }
  const nextStatus = action === "approve" ? "approved" : "rejected";
  const note =
    action === "reject"
      ? toTextOrNull(reviewNote) || "Rejected by admin"
      : toTextOrNull(reviewNote) || toTextOrNull(current.note);
  const [updated] = await sql`
    update seller_withdrawals
    set ${sql({
      status: nextStatus,
      review_note: note,
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })}
    where id = ${requestId}
    returning *
  `;
  await createSellerWithdrawalReviewNotification(
    updated.seller_user_id,
    updated.id,
    nextStatus,
    updated.review_note,
  );
  return { ...updated, request_amount: toMoney(updated.request_amount || 0) };
}
