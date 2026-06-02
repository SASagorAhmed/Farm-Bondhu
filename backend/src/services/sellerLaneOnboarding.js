import sql from "../db.js";
import {
  isValidMarketplaceLane,
  laneForProductCategory,
  LICENSE_REQUIRED_LANES,
  validateSellerOnboardingBody,
} from "../lib/marketplaceLanes.js";
import { upsertShopFromApprovalRequest } from "./shopFromApproval.js";

export class SellerLaneError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function grantSellerCapabilities(userId, grantedBy) {
  for (const code of ["can_sell", "can_manage_store"]) {
    await sql`
      insert into user_capabilities (user_id, capability_code, is_enabled, granted_by, created_at)
      values (${userId}, ${code}, true, ${grantedBy}, now())
      on conflict (user_id, capability_code) do update set
        is_enabled = true,
        granted_by = coalesce(excluded.granted_by, user_capabilities.granted_by)
    `;
  }
}

async function revokeSellerCapabilitiesIfNoApprovedLanes(userId) {
  const [row] = await sql`
    select count(*)::int as n from seller_lane_grants
    where user_id = ${userId} and status = 'approved'
  `;
  if (Number(row?.n || 0) > 0) return;
  for (const code of ["can_sell", "can_manage_store"]) {
    await sql`
      insert into user_capabilities (user_id, capability_code, is_enabled, created_at)
      values (${userId}, ${code}, false, now())
      on conflict (user_id, capability_code) do update set is_enabled = false
    `;
  }
}

async function ensureShopFromBusinessName(userId, businessName) {
  const name = String(businessName || "").trim();
  if (!name) return;
  await sql`
    insert into shops (user_id, shop_name, updated_at)
    values (${userId}, ${name}, now())
    on conflict (user_id) do update set
      shop_name = coalesce(nullif(trim(shops.shop_name), ''), excluded.shop_name),
      updated_at = now()
  `;
}

async function syncParentRequestStatus(requestId, userId) {
  if (!requestId) return;
  const rows = await sql`
    select status from seller_lane_grants where user_id = ${userId} and request_id = ${requestId}::uuid
  `;
  if (!rows.length) return;
  const approved = rows.filter((r) => r.status === "approved").length;
  const rejected = rows.filter((r) => r.status === "rejected").length;
  const pending = rows.filter((r) => r.status === "pending").length;
  let status = "pending";
  if (approved > 0 && pending === 0 && rejected > 0) status = "partially_approved";
  else if (approved > 0 && pending === 0) status = "approved";
  else if (approved === 0 && rejected > 0 && pending === 0) status = "rejected";
  await sql`
    update approval_requests set status = ${status}, updated_at = now()
    where id = ${requestId}::uuid
  `;
}

export async function submitSellerOnboarding(userId, body) {
  const parsed = validateSellerOnboardingBody(body);
  if (parsed.error) throw new SellerLaneError(parsed.error);
  const { business_name, phone, location, lanes } = parsed.value;

  const pendingLanes = await sql`
    select lane from seller_lane_grants
    where user_id = ${userId} and status = 'pending'
  `;
  const pendingSet = new Set(pendingLanes.map((r) => r.lane));
  for (const { lane } of lanes) {
    if (pendingSet.has(lane)) {
      throw new SellerLaneError(`You already have a pending request for ${lane}`);
    }
  }

  const details = { business_name, phone, location, lanes };
  const [request] = await sql`
    insert into approval_requests (user_id, request_type, details, status, created_at, updated_at)
    values (${userId}, 'seller_onboarding', ${sql.json(details)}, 'pending', now(), now())
    returning *
  `;

  for (const laneRow of lanes) {
    const [existing] = await sql`
      select status from seller_lane_grants where user_id = ${userId} and lane = ${laneRow.lane} limit 1
    `;
    if (existing?.status === "approved") {
      throw new SellerLaneError(`You are already approved for ${laneRow.lane}`);
    }
    if (existing?.status === "pending") {
      throw new SellerLaneError(`You already have a pending request for ${laneRow.lane}`);
    }
    await sql`
      insert into seller_lane_grants (
        user_id, lane, status, license_number, license_file_url, request_id, created_at, updated_at
      ) values (
        ${userId},
        ${laneRow.lane},
        'pending',
        ${laneRow.license_number},
        ${laneRow.license_file_url},
        ${request.id},
        now(),
        now()
      )
      on conflict (user_id, lane) do update set
        status = 'pending',
        license_number = excluded.license_number,
        license_file_url = excluded.license_file_url,
        review_notes = null,
        reviewed_by = null,
        reviewed_at = null,
        request_id = excluded.request_id,
        updated_at = now()
    `;
  }

  return { request, lanes };
}

export async function resubmitSellerLanes(userId, body) {
  const lanesRaw = Array.isArray(body?.lanes) ? body.lanes : [];
  if (!lanesRaw.length) throw new SellerLaneError("lanes array is required");

  const updated = [];
  for (const item of lanesRaw) {
    const lane = typeof item === "string" ? item : item?.lane;
    if (!isValidMarketplaceLane(lane)) throw new SellerLaneError(`Invalid lane: ${lane}`);

    const [existing] = await sql`
      select * from seller_lane_grants where user_id = ${userId} and lane = ${lane} limit 1
    `;
    if (!existing || existing.status !== "rejected") {
      throw new SellerLaneError(`Lane ${lane} is not rejected and cannot be resubmitted`);
    }

    const license_number =
      item && typeof item === "object" && item.license_number != null
        ? String(item.license_number).trim()
        : existing.license_number;
    const license_file_url =
      item && typeof item === "object" && item.license_file_url != null
        ? String(item.license_file_url).trim()
        : existing.license_file_url;

    if (LICENSE_REQUIRED_LANES.has(lane)) {
      if (!license_number) throw new SellerLaneError(`License number required for ${lane}`);
      if (!license_file_url) throw new SellerLaneError(`License document required for ${lane}`);
    }

    const [row] = await sql`
      update seller_lane_grants set
        status = 'pending',
        license_number = ${license_number},
        license_file_url = ${license_file_url},
        review_notes = null,
        reviewed_by = null,
        reviewed_at = null,
        updated_at = now()
      where user_id = ${userId} and lane = ${lane}
      returning *
    `;
    if (row) updated.push(row);
    if (existing.request_id) {
      await sql`
        update approval_requests set status = 'pending', updated_at = now()
        where id = ${existing.request_id}::uuid
      `;
    }
  }

  return { lanes: updated };
}

export async function getSellerOnboardingMe(userId) {
  const grants = await sql`
    select * from seller_lane_grants where user_id = ${userId} order by lane asc
  `;
  const [latestRequest] = await sql`
    select * from approval_requests
    where user_id = ${userId} and request_type in ('seller_onboarding', 'seller_access')
    order by created_at desc limit 1
  `;
  const approvedLanes = grants.filter((g) => g.status === "approved").map((g) => g.lane);
  return {
    grants,
    latest_request: latestRequest || null,
    approved_lanes: approvedLanes,
    can_list: approvedLanes.length > 0,
  };
}

export async function listAdminSellerLanes({ status = "pending", userId = null } = {}) {
  const st = String(status || "pending").trim();
  const uid = userId ? String(userId).trim() : null;
  const rows = uid
    ? await sql`
        select g.*,
          p.name as user_name,
          p.email as user_email,
          ar.details as request_details
        from seller_lane_grants g
        join profiles p on p.id = g.user_id
        left join approval_requests ar on ar.id = g.request_id
        where g.user_id = ${uid}::uuid
          and (${st === "all"} or g.status = ${st})
        order by g.updated_at desc
        limit 500
      `
    : await sql`
        select g.*,
          p.name as user_name,
          p.email as user_email,
          ar.details as request_details
        from seller_lane_grants g
        join profiles p on p.id = g.user_id
        left join approval_requests ar on ar.id = g.request_id
        where g.status = ${st}
        order by g.updated_at desc
        limit 500
      `;
  return rows;
}

export async function reviewSellerLane({ userId, lane, action, reviewNotes, adminUserId }) {
  if (!isValidMarketplaceLane(lane)) throw new SellerLaneError("Invalid lane");
  const act = String(action || "").toLowerCase();
  if (act !== "approve" && act !== "reject") throw new SellerLaneError("action must be approve or reject");

  const [grant] = await sql`
    select * from seller_lane_grants where user_id = ${userId} and lane = ${lane} limit 1
  `;
  if (!grant) throw new SellerLaneError("Lane grant not found", 404);
  if (grant.status !== "pending") throw new SellerLaneError("Lane is not pending review");

  const notes = reviewNotes ? String(reviewNotes).trim().slice(0, 2000) : null;
  const newStatus = act === "approve" ? "approved" : "rejected";

  const [updated] = await sql`
    update seller_lane_grants set
      status = ${newStatus},
      review_notes = ${notes},
      reviewed_by = ${adminUserId},
      reviewed_at = now(),
      updated_at = now()
    where user_id = ${userId} and lane = ${lane}
    returning *
  `;

  if (newStatus === "approved") {
    const details =
      grant.request_id &&
      (await sql`select details from approval_requests where id = ${grant.request_id} limit 1`)[0]?.details;
    const businessName = details?.business_name || details?.businessName;
    await grantSellerCapabilities(userId, adminUserId);
    await ensureShopFromBusinessName(userId, businessName);
  }

  await syncParentRequestStatus(grant.request_id, userId);

  if (newStatus === "rejected") {
    await revokeSellerCapabilitiesIfNoApprovedLanes(userId);
  }

  return updated;
}

export async function assertSellerMayListCategory(userId, category) {
  const lane = laneForProductCategory(category);
  if (!lane) throw new SellerLaneError("Unknown product category");
  const [grant] = await sql`
    select status from seller_lane_grants
    where user_id = ${userId} and lane = ${lane} limit 1
  `;
  if (!grant || grant.status !== "approved") {
    throw new SellerLaneError(
      `You are not approved to sell in the ${lane} category. Complete seller onboarding or wait for admin approval.`,
      403
    );
  }
  return lane;
}

export async function isProductPubliclyVisible(product) {
  const status = String(product?.listing_status || "approved");
  return status === "approved";
}

export async function moderateProductListing({ productId, action, reviewNotes, adminUserId }) {
  const act = String(action || "").toLowerCase();
  if (act !== "approve" && act !== "reject") throw new SellerLaneError("action must be approve or reject");
  const [product] = await sql`select * from products where id = ${productId}::uuid limit 1`;
  if (!product) throw new SellerLaneError("Product not found", 404);

  const notes = reviewNotes ? String(reviewNotes).trim().slice(0, 2000) : null;
  const listing_status = act === "approve" ? "approved" : "rejected";

  const [updated] = await sql`
    update products set
      listing_status = ${listing_status},
      listing_review_notes = ${notes},
      listing_reviewed_by = ${adminUserId},
      listing_reviewed_at = now(),
      updated_at = now()
    where id = ${productId}::uuid
    returning *
  `;
  return updated;
}

export async function listAdminProductsByListingStatus(listingStatus = "pending_review") {
  const st = String(listingStatus || "pending_review");
  return sql`
    select p.*, pr.name as seller_profile_name, pr.email as seller_email
    from products p
    left join profiles pr on pr.id = p.seller_id
    where coalesce(p.listing_status, 'approved') = ${st}
    order by coalesce(p.listing_submitted_at, p.created_at) desc
    limit 500
  `;
}

export { upsertShopFromApprovalRequest };
