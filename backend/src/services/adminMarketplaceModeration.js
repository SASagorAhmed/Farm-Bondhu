import crypto from "crypto";
import sql from "../db.js";
import { requestHasAnyRole } from "./medibondhuAccess.js";
import { isSuperAdminUser } from "./adminTeam.js";
import { buildUserBundle } from "./userBundle.js";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const CONFIRM_PHRASE = "greenbondhu";

const ACTIONS = new Set([
  "suspend",
  "activate",
  "block",
  "unblock",
  "remove_marketplace_access",
  "soft_delete",
  "permanent_delete",
]);

export class ModerationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function assertCanModerate(adminUserId, targetUserId) {
  if (!UUID_RE.test(targetUserId)) {
    throw new ModerationError("Invalid user id", 400);
  }
  if (adminUserId === targetUserId) {
    throw new ModerationError("You cannot moderate your own account", 400);
  }
  const [profile] = await sql`select id, status from profiles where id = ${targetUserId} limit 1`;
  if (!profile) {
    throw new ModerationError("User not found", 404);
  }
  const isTargetAdmin = await requestHasAnyRole({ userId: targetUserId }, ["admin"]);
  if (isTargetAdmin) {
    throw new ModerationError("Cannot moderate another admin account", 403);
  }
  return profile;
}

async function setCapability(userId, code, enabled, grantedBy) {
  const [existing] = await sql`
    select user_id from user_capabilities
    where user_id = ${userId} and capability_code = ${code}
    limit 1
  `;
  if (existing) {
    await sql`
      update user_capabilities
      set is_enabled = ${enabled}
      where user_id = ${userId} and capability_code = ${code}
    `;
    return;
  }
  await sql`
    insert into user_capabilities (user_id, capability_code, is_enabled, granted_by)
    values (${userId}, ${code}, ${enabled}, ${grantedBy})
  `;
}

async function buyerMarketplaceBlocked(userId) {
  const bundle = await buildUserBundle(userId);
  if (!bundle) return true;
  const canBuy = bundle.capabilities.includes("can_buy");
  const canBulk = bundle.capabilities.includes("can_bulk_buy");
  return !canBuy && !canBulk;
}

async function sellerMarketplaceBlocked(userId) {
  const [shop] = await sql`select status from shops where user_id = ${userId} limit 1`;
  const [cap] = await sql`
    select is_enabled from user_capabilities
    where user_id = ${userId} and capability_code = 'can_sell'
    limit 1
  `;
  return shop?.status === "blocked" || (cap ? !cap.is_enabled : false);
}

export async function getModerationState(userId, role) {
  const [profile] = await sql`
    select id, status, email, name, avatar_url from profiles where id = ${userId} limit 1
  `;
  const marketplace_blocked =
    role === "seller" ? await sellerMarketplaceBlocked(userId) : await buyerMarketplaceBlocked(userId);
  return {
    status: profile?.status || "active",
    marketplace_blocked,
    message: "OK",
  };
}

async function blockBuyer(userId, grantedBy) {
  await setCapability(userId, "can_buy", false, grantedBy);
}

async function blockSeller(userId, grantedBy) {
  await setCapability(userId, "can_sell", false, grantedBy);
  await sql`
    update shops set status = 'blocked', updated_at = now()
    where user_id = ${userId}
  `;
}

async function clearCapabilityOverride(userId, code) {
  await sql`
    delete from user_capabilities
    where user_id = ${userId} and capability_code = ${code}
  `;
}

/** Remove marketplace blocks and restore role-based defaults for buyer + seller access. */
async function restoreMarketplaceAccess(userId) {
  await clearCapabilityOverride(userId, "can_buy");
  await clearCapabilityOverride(userId, "can_sell");
  await sql`
    update shops set status = 'approved', updated_at = now()
    where user_id = ${userId}
  `;
}

async function removeMarketplaceAccess(userId, role, grantedBy) {
  if (role === "seller") {
    await setCapability(userId, "can_sell", false, grantedBy);
    await sql`
      update shops set status = 'blocked', updated_at = now()
      where user_id = ${userId}
    `;
    return;
  }
  await blockBuyer(userId, grantedBy);
}

async function softDeleteUser(userId) {
  const suffix = crypto.randomUUID().slice(0, 8);
  await sql`
    update profiles set
      status = 'deleted',
      email = ${`deleted+${suffix}@removed.farmbondhu.local`},
      name = 'Deleted User',
      phone = null,
      avatar_url = null,
      updated_at = now()
    where id = ${userId}
  `;
  await blockBuyer(userId, userId);
  await blockSeller(userId, userId);
}

async function permanentDeleteUser(userId) {
  const [{ count }] = await sql`
    select count(*)::int as count from orders
    where buyer_id = ${userId} or seller_id = ${userId}
  `;
  if (count > 0) {
    throw new ModerationError(
      "Cannot permanently delete: user has order history. Use soft delete or remove marketplace access instead.",
      409
    );
  }

  await sql`delete from products where seller_id = ${userId}`;
  await sql`delete from shops where user_id = ${userId}`;
  await sql`delete from user_capabilities where user_id = ${userId}`;
  await sql`delete from user_roles where user_id = ${userId}`;
  await sql`delete from user_addresses where user_id = ${userId}`;
  await sql`delete from auth_credentials where user_id = ${userId}`;
  await sql`delete from profiles where id = ${userId}`;
}

export async function moderateMarketplaceUser({
  adminUserId,
  targetUserId,
  action,
  confirmPhrase,
  role,
}) {
  if (String(confirmPhrase || "").trim().toLowerCase() !== CONFIRM_PHRASE) {
    throw new ModerationError('Confirmation phrase must be "greenbondhu"', 400);
  }
  if (!ACTIONS.has(action)) {
    throw new ModerationError("Invalid action", 400);
  }
  if (role !== "buyer" && role !== "seller") {
    throw new ModerationError("Invalid role", 400);
  }

  await assertCanModerate(adminUserId, targetUserId);

  if (action === "permanent_delete" && !(await isSuperAdminUser(adminUserId))) {
    throw new ModerationError("Super Admin required for permanent delete", 403);
  }

  switch (action) {
    case "suspend":
      await sql`update profiles set status = 'suspended', updated_at = now() where id = ${targetUserId}`;
      break;
    case "activate":
      await sql`update profiles set status = 'active', updated_at = now() where id = ${targetUserId}`;
      await restoreMarketplaceAccess(targetUserId);
      break;
    case "block":
      if (role === "seller") await blockSeller(targetUserId, adminUserId);
      else await blockBuyer(targetUserId, adminUserId);
      break;
    case "unblock":
      await restoreMarketplaceAccess(targetUserId);
      break;
    case "remove_marketplace_access":
      await removeMarketplaceAccess(targetUserId, role, adminUserId);
      break;
    case "soft_delete":
      await softDeleteUser(targetUserId);
      break;
    case "permanent_delete":
      await permanentDeleteUser(targetUserId);
      return { ok: true, deleted: true, message: "Account permanently deleted" };
    default:
      break;
  }

  const state = await getModerationState(targetUserId, role);
  const restoredMessage =
    action === "unblock" || action === "activate"
      ? "Marketplace access restored. User may need to refresh the page if already logged in."
      : "OK";
  return { ok: true, ...state, message: restoredMessage };
}

export async function assertBuyerCanPurchase(userId) {
  const [profile] = await sql`select status from profiles where id = ${userId} limit 1`;
  if (!profile) throw new ModerationError("Profile not found", 404);
  if (profile.status === "suspended") {
    throw new ModerationError("Your account is suspended", 403);
  }
  if (profile.status === "deleted") {
    throw new ModerationError("Your account is no longer active", 403);
  }
  if (await buyerMarketplaceBlocked(userId)) {
    throw new ModerationError("Marketplace access is blocked for this account", 403);
  }
}

export async function assertSellerCanOperate(userId) {
  const [profile] = await sql`select status from profiles where id = ${userId} limit 1`;
  if (!profile) throw new ModerationError("Profile not found", 404);
  if (profile.status === "suspended" || profile.status === "deleted") {
    throw new ModerationError("Seller account is not active", 403);
  }
  if (await sellerMarketplaceBlocked(userId)) {
    throw new ModerationError("Seller marketplace access is blocked", 403);
  }
}
