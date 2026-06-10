import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { getOrSetCachedValue, invalidateByPrefix, makeCacheKey } from "../../services/responseCache.js";
import { uploadToCloudinary } from "../../services/cloudinaryUpload.js";
import { validateProductPayload } from "../../validators/product.js";
import { requestHasAnyRole } from "../../services/medibondhuAccess.js";
import { upsertShopFromApprovalRequest } from "../../services/shopFromApproval.js";
import { getOrCreateChatTranslation } from "../../services/chatMessageTranslate.js";
import { ensureConversationAnchorProductShare } from "../../services/chatAnchorProduct.js";
import {
  MarketplaceChatOpenError,
  conversationHasAnyReport,
  deleteSupersededMarketplaceConversation,
  findCanonicalMarketplaceConversation,
  listSupersededDuplicatesMeta,
  openMarketplaceConversation,
} from "../../services/marketplaceChatOpen.js";
import {
  getChatSendRestriction,
  recordChatContactViolation,
} from "../../services/chatContactGuard.js";
import { isSuperAdminUser } from "../../services/adminTeam.js";
import { blockNonSuperAdminPreviewWrite } from "../../middleware/blockNonSuperAdminPreviewWrite.js";
import {
  getAdminBuyerDetail,
  getAdminOrderDetail,
  getAdminSellerDetail,
  listAdminBuyers,
  listAdminOrders,
  listAdminSellers,
  listAdminTransactions,
} from "../../services/adminMarketplaceOps.js";
import {
  applyShopStorefrontUpdates,
  ShopStorefrontError,
} from "../../services/shopStorefront.js";
import {
  getChatSoundConfig,
  getUserChatSoundPreference,
  updateChatSoundSettings,
  updateUserChatSoundPreference,
} from "../../services/marketplaceChatSoundSettings.js";
import {
  moderateMarketplaceUser,
  ModerationError,
  assertSellerCanOperate,
} from "../../services/adminMarketplaceModeration.js";
import {
  getOfficialFarmBondhuShopMeta,
  resolveOfficialShopSellerId,
  isOfficialFarmBondhuSellerId,
  ensureOfficialFarmBondhuShop,
} from "../../services/officialFarmBondhuShop.js";
import {
  getPlatformSupportMeta,
  isPlatformSupportConversation,
  isPlatformSupportSellerId,
  listUserSupportInbox,
  openSupportConversation,
  resolveSupportConversation,
} from "../../services/platformSupport.js";
import {
  conversationHasPendingReport,
  conversationHasModerationAccess,
  userHasReportedConversation,
} from "../../services/adminModerationReports.js";
import { adminMayReadConversation } from "../../lib/adminChatAccess.js";
import {
  submitSellerOnboarding,
  resubmitSellerLanes,
  getSellerOnboardingMe,
  listAdminSellerLanes,
  reviewSellerLane,
  assertSellerMayListCategory,
  moderateProductListing,
  listAdminProductsByListingStatus,
  SellerLaneError,
} from "../../services/sellerLaneOnboarding.js";
import {
  computeSellerEarningsSummary,
  createSellerWithdrawal,
  fetchSellerEarningsBreakdown,
  fetchSellerMonthlyTrend,
  getAdminSellerWithdrawalDetails,
  listAdminSellerWithdrawals,
  listSellerWithdrawalsForUser,
  reviewSellerWithdrawal,
  toMoney as sellerPayoutToMoney,
} from "../../services/sellerPayouts.js";
import {
  createReview,
  listProductReviews,
  listPendingReviewables,
  adminDeleteReview,
  listAdminReviews,
  listSellerReviews,
  upsertSellerReviewReply,
  ReviewError,
} from "../../services/marketplaceReviews.js";
import { enrichShopWithLiveStats } from "../../services/marketplaceShopStats.js";
import { listSellerInventory } from "../../services/marketplaceSellerInventory.js";
import {
  createProductComment,
  listProductComments,
  adminDeleteProductComment,
  listAdminProductComments,
  listSellerProductComments,
  upsertSellerCommentReply,
} from "../../services/marketplaceProductComments.js";

const router = Router();
const UUID_RE = /^[0-9a-f-]{36}$/i;
const userChain = [requireDatabase, requireUser];
const nowMs = () => Number(process.hrtime.bigint() / 1000000n);
const MARKETPLACE_CACHE_PREFIX = "marketplace";
const CLOUDINARY_FOLDER_MARKETPLACE_BANNERS = "marketplace/banners";

function invalidateMarketplaceBannersCache() {
  invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|`);
}

function invalidateMarketplaceProductsCache() {
  invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|`);
}

const FLASH_SALE_REQUEST_STRIP_KEYS = [
  "is_flash_sale",
  "flash_sale_end",
  "flash_sale_request_status",
  "flash_sale_requested_at",
  "flash_sale_requested_original_price",
  "flash_sale_request_notes",
  "flash_sale_reviewed_at",
  "flash_sale_reviewed_by",
  "flash_sale_review_notes",
];

function stripFlashSaleFromBody(body) {
  if (!body || typeof body !== "object") return;
  for (const key of FLASH_SALE_REQUEST_STRIP_KEYS) delete body[key];
}

function stripFlashSaleFromValidated(validated) {
  if (!validated || typeof validated !== "object") return;
  for (const key of FLASH_SALE_REQUEST_STRIP_KEYS) delete validated[key];
}

function isValidBannerImageUrl(value) {
  const s = String(value || "").trim();
  if (!s.startsWith("https://")) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidBannerLinkUrl(value) {
  if (value == null || value === "") return true;
  const s = String(value).trim();
  if (s.startsWith("/")) return true;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeBannerLinkUrl(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  return s || null;
}

function normalizeDisplaySeconds(value, { required = false } = {}) {
  if (value == null || value === "") {
    if (required) return { error: "display_seconds is required" };
    return { value: 5 };
  }
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 3 || n > 120) {
    return { error: "display_seconds must be an integer between 3 and 120" };
  }
  return { value: n };
}

function normalizeBannerTimestamp(value) {
  if (value == null || value === "") return { value: null };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { error: "Invalid timestamp" };
  return { value: d.toISOString() };
}

function validateBannerSchedule(startsAt, endsAt) {
  if (startsAt && endsAt && new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
    return { error: "starts_at must be before ends_at" };
  }
  return null;
}

function parseBannerTimerFields(body, { requireDisplaySeconds = false } = {}) {
  const out = {};
  if ("display_seconds" in body || requireDisplaySeconds) {
    const parsed = normalizeDisplaySeconds(body.display_seconds, { required: requireDisplaySeconds });
    if (parsed.error) return { error: parsed.error };
    out.display_seconds = parsed.value;
  }
  let startsAt;
  let endsAt;
  if ("starts_at" in body) {
    const parsed = normalizeBannerTimestamp(body.starts_at);
    if (parsed.error) return { error: parsed.error };
    out.starts_at = parsed.value;
    startsAt = parsed.value;
  }
  if ("ends_at" in body) {
    const parsed = normalizeBannerTimestamp(body.ends_at);
    if (parsed.error) return { error: parsed.error };
    out.ends_at = parsed.value;
    endsAt = parsed.value;
  }
  if ("starts_at" in body && "ends_at" in body) {
    const scheduleErr = validateBannerSchedule(out.starts_at, out.ends_at);
    if (scheduleErr) return scheduleErr;
  }
  return { value: out };
}

let marketplaceBannersTableReady = false;
async function ensureMarketplaceBannersTable() {
  if (marketplaceBannersTableReady || !sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS public.marketplace_banners (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      image_url text NOT NULL,
      alt_text text,
      link_url text,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      display_seconds integer NOT NULL DEFAULT 5,
      starts_at timestamptz,
      ends_at timestamptz,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql.unsafe(`ALTER TABLE public.marketplace_banners ADD COLUMN IF NOT EXISTS display_seconds integer NOT NULL DEFAULT 5`);
  await sql.unsafe(`ALTER TABLE public.marketplace_banners ADD COLUMN IF NOT EXISTS starts_at timestamptz`);
  await sql.unsafe(`ALTER TABLE public.marketplace_banners ADD COLUMN IF NOT EXISTS ends_at timestamptz`);
  marketplaceBannersTableReady = true;
}

function invalidateMarketplaceChatCache(buyerId, sellerId) {
  if (buyerId) invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:${buyerId}|`);
  if (sellerId) invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:${sellerId}|`);
}

function serializeChatGuard(restriction) {
  return {
    restricted_until: restriction.restrictedUntil,
    violation_count: restriction.violationCount,
  };
}

const SUPPORT_SHOP_LABEL = "FarmBondhu Support";
const MARKETPLACE_SELLER_FALLBACK = "Marketplace Seller";

/** Shop brand only — never products.seller_name or profile names (buyer-facing). */
function marketplaceChatShopLabel(shop, requestShopName) {
  const fromShop = String(shop?.shop_name || "").trim();
  const fromRequest = String(requestShopName || "").trim();
  if (fromShop && fromShop !== SUPPORT_SHOP_LABEL) return fromShop;
  if (fromRequest && fromRequest !== SUPPORT_SHOP_LABEL) return fromRequest;
  return MARKETPLACE_SELLER_FALLBACK;
}

const chatApprovalShopJoin = sql`
  left join lateral (
    select trim(coalesce(ar.details->>'shopName', ar.payload->>'shopName', '')) as request_shop_name
    from approval_requests ar
    where ar.user_id = c.seller_id
      and ar.request_type = 'shop_access'
      and ar.status = 'approved'
    order by ar.updated_at desc
    limit 1
  ) ar on true
`;

const marketplaceChatShopNameSql = sql`
  coalesce(
    nullif(trim(s.shop_name), ${SUPPORT_SHOP_LABEL}),
    nullif(trim(ar.request_shop_name), ${SUPPORT_SHOP_LABEL}),
    nullif(trim(s.shop_name), ''),
    nullif(trim(ar.request_shop_name), ''),
    ${MARKETPLACE_SELLER_FALLBACK}
  ) as shop_name
`;

/** @param {import("postgres").Sql} sql */
async function buildConversationBootstrap(sql, conversation, uid) {
  await ensureConversationAnchorProductShare(sql, conversation);

  const otherId = conversation.buyer_id === uid ? conversation.seller_id : conversation.buyer_id;
  const isSupport = isPlatformSupportConversation(conversation);
  const [[profile] = [], [shopMeta] = [], [product] = [], messages, [reportMeta] = []] = await Promise.all([
    sql`select name from profiles where id = ${otherId} limit 1`,
    sql`
      select
        s.shop_name,
        ar.request_shop_name
      from (select ${conversation.seller_id}::uuid as seller_id) sel
      left join shops s on s.user_id = sel.seller_id
      left join lateral (
        select trim(coalesce(ar.details->>'shopName', ar.payload->>'shopName', '')) as request_shop_name
        from approval_requests ar
        where ar.user_id = sel.seller_id
          and ar.request_type = 'shop_access'
          and ar.status = 'approved'
        order by ar.updated_at desc
        limit 1
      ) ar on true
    `,
    conversation.product_id
      ? sql`select id, name, price, image, seller_name, location, rating, stock, category from products where id = ${conversation.product_id} limit 1`
      : Promise.resolve([]),
    sql`select * from chat_messages where conversation_id = ${conversation.id} order by created_at asc`,
    isSupport
      ? Promise.resolve([{}])
      : sql`
          select
            exists (
              select 1 from marketplace_conversation_reports
              where conversation_id = ${conversation.id}
                and reported_by = ${uid}
            ) as user_has_reported,
            exists (
              select 1 from marketplace_conversation_reports
              where conversation_id = ${conversation.id}
                and status = 'pending'
            ) as has_pending_report
        `,
  ]);

  const sharedIds = [...new Set((messages || []).map((m) => m.shared_product_id).filter(Boolean))];
  let sharedMap = new Map();
  if (sharedIds.length) {
    const sharedProducts = await sql`
      select id, name, price, image, seller_name, location, stock
      from products
      where id in ${sql(sharedIds)}
    `;
    sharedMap = new Map(sharedProducts.map((p) => [p.id, p]));
  }

  const enrichedMessages = (messages || []).map((m) => ({
    ...m,
    shared_product: m.shared_product_id ? sharedMap.get(m.shared_product_id) || null : null,
  }));

  const chatGuard = serializeChatGuard(await getChatSendRestriction(sql, uid));
  const shopName = isSupport
    ? SUPPORT_SHOP_LABEL
    : marketplaceChatShopLabel(
        { shop_name: shopMeta?.shop_name },
        shopMeta?.request_shop_name
      );

  let isCanonical = true;
  let canonicalRow = null;
  if (!isSupport && conversation.buyer_id !== conversation.seller_id) {
    canonicalRow = await findCanonicalMarketplaceConversation(
      sql,
      conversation.buyer_id,
      conversation.seller_id,
    );
    isCanonical = Boolean(canonicalRow && canonicalRow.id === conversation.id);
  }
  const hasConversationReport = isSupport
    ? false
    : await conversationHasAnyReport(sql, conversation.id);

  const supersededDuplicates =
    !isSupport && isCanonical && canonicalRow
      ? await listSupersededDuplicatesMeta(
          sql,
          conversation.buyer_id,
          conversation.seller_id,
          canonicalRow.id,
        )
      : [];

  return {
    conversation: {
      id: conversation.id,
      buyer_id: conversation.buyer_id,
      seller_id: conversation.seller_id,
      is_self_chat: conversation.buyer_id === conversation.seller_id,
      product_id: conversation.product_id,
      support_topic: conversation.support_topic ?? null,
      support_status: conversation.support_status ?? null,
      product: product || null,
      other_name: profile?.name || "User",
      shop_name: shopName,
      user_has_reported: Boolean(reportMeta?.user_has_reported),
      has_pending_report: Boolean(reportMeta?.has_pending_report),
      is_canonical: isCanonical,
      is_superseded_duplicate: !isSupport && !isCanonical,
      has_conversation_report: hasConversationReport,
    },
    messages: enrichedMessages,
    chat_guard: chatGuard,
    superseded_duplicates: supersededDuplicates,
  };
}

const MEDIBONDHU_CATEGORIES = [
  "medicine",
  "vaccines",
  "supplements",
  "first_aid",
  "health_care_items",
  "medical_equipment",
  "baby_care",
  "diabetes_care",
  "skin_personal_care",
];

const VETBONDHU_CATEGORIES = [
  "animal_medicine",
  "pet_medicine",
  "animal_vaccine",
  "animal_vitamins_supplements",
  "dewormer",
  "wound_care",
  "animal_first_aid",
  "vet_equipment",
];

const FARM_CATEGORIES = [
  "animal_feed",
  "seeds_plants_nursery",
  "fertilizer",
  "pesticide",
  "rice_grains_pulses",
  "vegetables_fruits",
  "bags_packaging_storage",
  "organic_products",
  "farm_accessories_grooming",
  // Legacy values still stored in DB
  "feed",
  "poultry feed",
  "cattle feed",
  "pest control",
  "pest_control",
  "produce",
  "organic",
  "grooming",
  "packaging",
];

const PET_CATEGORIES = [
  "pet_food",
  "pet_medicine_health",
  "pet_care_grooming",
  "pet_accessories",
  "pet_cage_carrier",
  "pet_bowl_feeder",
  "pet_toys",
  "pet_litter_cleaning",
];

const LIVESTOCK_DAIRY_CATEGORIES = [
  "livestock",
  "meat",
  "milk_dairy",
  "eggs",
  "fish_fishery",
  // Legacy values still stored in DB
  "milk",
  "dairy",
];

const FARM_MACHINERY_CATEGORIES = [
  "farm_machines",
  "farm_tools_equipment",
  "water_irrigation",
  // Legacy values still stored in DB
  "equipment",
];

function resolveLaneCategoryList(lane) {
  const key = String(lane || "").trim().toLowerCase();
  if (key === "pharmacy" || key === "medibondhu") return MEDIBONDHU_CATEGORIES;
  if (key === "vetbondhu") return VETBONDHU_CATEGORIES;
  if (key === "farm") return FARM_CATEGORIES;
  if (key === "pet") return PET_CATEGORIES;
  if (key === "livestock_dairy") return LIVESTOCK_DAIRY_CATEGORIES;
  if (key === "farm_machinery") return FARM_MACHINERY_CATEGORIES;
  return null;
}

function normalizeCategory(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveSortClause(sort) {
  switch (String(sort || "newest")) {
    case "price_asc":
      return sql`order by p.price asc nulls last, p.created_at desc`;
    case "price_desc":
      return sql`order by p.price desc nulls last, p.created_at desc`;
    case "rating":
      return sql`order by p.rating desc nulls last, p.created_at desc`;
    case "storefront":
      return sql`order by p.shop_pin_order asc nulls last, p.shop_sort_order asc, p.created_at desc`;
    case "newest":
    default:
      return sql`order by p.created_at desc`;
  }
}

/** Coalesce shop display name from shops row or latest approved shop request. */
const productShopJoin = sql`
  from products p
  left join shops s on s.user_id = p.seller_id
  left join lateral (
    select trim(coalesce(ar.details->>'shopName', ar.payload->>'shopName', '')) as request_shop_name
    from approval_requests ar
    where ar.user_id = p.seller_id
      and ar.request_type = 'shop_access'
      and ar.status = 'approved'
    order by ar.updated_at desc
    limit 1
  ) ar on true
`;

const coalescedShopName = sql`
  coalesce(
    nullif(trim(s.shop_name), ''),
    nullif(trim(ar.request_shop_name), '')
  ) as shop_name
`;

function isStorefrontSchemaError(err) {
  const code = String(err?.code || "");
  const message = String(err?.message || err || "").toLowerCase();
  return code === "42703" || message.includes("shop_pin_order") || message.includes("shop_sort_order");
}

async function queryProductsWithShopName(queryParts) {
  try {
    return await queryParts();
  } catch (err) {
    console.warn("[marketplace] shop name join failed, using simple products query:", err instanceof Error ? err.message : err);
    return null;
  }
}

router.use((req, res, next) => {
  if (req.method === "GET") return next();
  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    if (req.userId) invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:${req.userId}|`);
    invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:anon|products`);
    invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:anon|product`);
  });
  next();
});

/** Public product lists */
router.get(
  "/chat/inbox",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const startedAt = nowMs();
    const uid = req.userId;
    const cacheKey = makeCacheKey(MARKETPLACE_CACHE_PREFIX, { userId: uid, parts: ["chat-inbox"] });
    const { value: rows, cacheHit } = await getOrSetCachedValue(cacheKey, 2_000, () => sql`
      select *
      from (
        select distinct on (c.seller_id)
          c.id,
          c.buyer_id,
          c.seller_id,
          c.product_id,
          coalesce(c.last_message, 'Started a conversation') as last_message,
          coalesce(c.last_message_at, c.created_at) as last_message_at,
          c.last_sender_id,
          c.last_sender_role,
          exists (
            select 1 from chat_messages m
            where m.conversation_id = c.id
              and m.sender_role in ('seller', 'admin')
              and m.buyer_read_at is null
          ) as has_unread,
          p.name as product_name,
          p.image as product_image,
          p.price as product_price,
          ${marketplaceChatShopNameSql},
          (c.buyer_id = c.seller_id) as is_self_chat,
          op.name as other_name
        from conversations c
        left join products p on p.id = c.product_id
        left join shops s on s.user_id = c.seller_id
        ${chatApprovalShopJoin}
        left join profiles op on op.id = c.seller_id
        where c.buyer_id = ${uid}
          and coalesce(c.conversation_kind, 'marketplace') = 'marketplace'
        order by c.seller_id, coalesce(c.last_message_at, c.created_at) desc nulls last
      ) inbox
      order by inbox.last_message_at desc nulls last
      limit 500
    `);
    res.setHeader("x-fb-cache", cacheHit ? "hit" : "miss");
    res.json({ data: rows });
  })
);

router.get(
  "/chat/seller/:sellerId/bootstrap",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const startedAt = nowMs();
    const sellerId = String(req.params.sellerId || "");
    if (!UUID_RE.test(sellerId)) {
      res.status(400).json({ error: "Invalid seller id" });
      return;
    }
    if (req.userId !== sellerId) {
      const isAdmin = await requestHasAnyRole(req, ["admin"]);
      const officialSeller =
        isAdmin &&
        ((await isOfficialFarmBondhuSellerId(sellerId)) || (await isPlatformSupportSellerId(sellerId)));
      if (!officialSeller) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    const cacheKey = makeCacheKey(MARKETPLACE_CACHE_PREFIX, { userId: sellerId, parts: ["seller-bootstrap"] });
    const { value: rows, cacheHit } = await getOrSetCachedValue(cacheKey, 2_000, () => sql`
      select
        c.id,
        c.buyer_id,
        c.seller_id,
        c.product_id,
        coalesce(c.last_message, 'New conversation') as last_message,
        coalesce(c.last_message_at, c.created_at) as last_message_at,
        c.last_sender_id,
        c.last_sender_role,
        exists (
          select 1 from chat_messages m
          where m.conversation_id = c.id
            and m.sender_role = 'buyer'
            and m.seller_read_at is null
        ) as has_unread,
        bp.name as buyer_name,
        ${marketplaceChatShopNameSql},
        (c.buyer_id = c.seller_id) as is_self_chat,
        p.name as product_name,
        p.image as product_image,
        p.price as product_price,
        (c.id = canon.canonical_id) as is_canonical,
        (c.id <> canon.canonical_id) as is_superseded_duplicate,
        coalesce(rep.has_pending_report, false) as has_pending_report
      from conversations c
      left join profiles bp on bp.id = c.buyer_id
      left join shops s on s.user_id = c.seller_id
      left join products p on p.id = c.product_id
      ${chatApprovalShopJoin}
      left join lateral (
        select c2.id as canonical_id
        from conversations c2
        where c2.buyer_id = c.buyer_id
          and c2.seller_id = c.seller_id
          and coalesce(c2.conversation_kind, 'marketplace') = 'marketplace'
        order by coalesce(c2.last_message_at, c2.created_at) desc nulls last
        limit 1
      ) canon on true
      left join lateral (
        select exists (
          select 1 from marketplace_conversation_reports mcr
          where mcr.conversation_id = c.id
            and mcr.status = 'pending'
        ) as has_pending_report
      ) rep on true
      where c.seller_id = ${sellerId}
        and coalesce(c.conversation_kind, 'marketplace') = 'marketplace'
      order by coalesce(c.last_message_at, c.created_at) desc nulls last
      limit 300
    `);
    res.setHeader("Cache-Control", "private, max-age=10");
    res.setHeader("x-fb-seller-inbox-ms", String(Math.max(0, nowMs() - startedAt)));
    res.setHeader("x-fb-cache", cacheHit ? "hit" : "miss");
    const chatGuard = serializeChatGuard(await getChatSendRestriction(sql, sellerId));
    res.json({ data: rows, chat_guard: chatGuard });
  })
);

router.get(
  "/chat/admin/bootstrap",
  requireDatabase,
  requireUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const startedAt = nowMs();
    const scope = String(req.query.scope || "reported").toLowerCase();
    const farmbondhuOnly = scope === "farmbondhu";
    const platformSupportOnly = scope === "platform_support";
    const reportedOnly = scope === "reported" || scope === "all";
    const rows = await sql`
      select
        c.id,
        c.buyer_id,
        c.seller_id,
        c.product_id,
        c.support_topic,
        c.support_status,
        coalesce(c.last_message, 'New conversation') as last_message,
        coalesce(c.last_message_at, c.created_at) as last_message_at,
        bp.name as buyer_name,
        sp.name as seller_name,
        sp.phone as seller_phone,
        ${marketplaceChatShopNameSql},
        coalesce(rep.report_count, 0)::int as report_count,
        rep.latest_report_at,
        rep.latest_report_reason,
        coalesce(rep.has_pending_report, false) as has_pending_report,
        (coalesce(rep.report_count, 0) > 0) as has_report,
        p.name as product_name,
        p.image as product_image,
        p.price as product_price,
        p.category as product_category,
        p.seller_name as product_seller_name
      from conversations c
      left join profiles bp on bp.id = c.buyer_id
      left join profiles sp on sp.id = c.seller_id
      left join shops s on s.user_id = c.seller_id
      ${chatApprovalShopJoin}
      left join lateral (
        select
          count(*)::int as report_count,
          max(mcr.created_at) as latest_report_at,
          (array_agg(mcr.reason order by mcr.created_at desc))[1] as latest_report_reason,
          bool_or(mcr.status = 'pending') as has_pending_report
        from marketplace_conversation_reports mcr
        where mcr.conversation_id = c.id
      ) rep on true
      left join products p on p.id = c.product_id
      where (
        (${platformSupportOnly}::boolean = true
          and coalesce(c.conversation_kind, 'marketplace') = 'platform_support'
          and c.support_topic in ('help', 'complaint'))
        or (${platformSupportOnly}::boolean = false
          and coalesce(c.conversation_kind, 'marketplace') = 'marketplace'
          and (
            ${reportedOnly}::boolean = false
            or coalesce(rep.report_count, 0) > 0
          )
          and (
            ${farmbondhuOnly}::boolean = false
            or coalesce(p.seller_name, '') = 'FarmBondhu'
            or c.seller_id in (
              select distinct seller_id from products where seller_name = 'FarmBondhu'
            )
          ))
      )
      order by coalesce(c.last_message_at, c.created_at) desc nulls last
      limit 400
    `;
    res.setHeader("Cache-Control", "private, max-age=10");
    res.setHeader("x-fb-admin-inbox-ms", String(Math.max(0, nowMs() - startedAt)));
    res.json({ data: rows });
  })
);

router.post(
  "/chat/conversations/:id/report",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const convoId = String(req.params.id || "");
    if (!UUID_RE.test(convoId)) {
      res.status(400).json({ error: "Invalid conversation id" });
      return;
    }
    const uid = req.userId;
    const reason = String(req.body?.reason || "").trim();
    const details = typeof req.body?.details === "string" ? req.body.details.trim().slice(0, 500) : null;
    if (!reason) {
      res.status(400).json({ error: "Reason is required" });
      return;
    }

    const [conversation] = await sql`
      select id, buyer_id, seller_id, conversation_kind
      from conversations
      where id = ${convoId}
      limit 1
    `;
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    if (String(conversation.conversation_kind || "marketplace") !== "marketplace") {
      res.status(400).json({ error: "Only marketplace conversations can be reported here" });
      return;
    }
    const isBuyer = conversation.buyer_id === uid;
    const isSeller = conversation.seller_id === uid;
    if (!isBuyer && !isSeller) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const alreadyReported = await userHasReportedConversation(sql, convoId, uid);
    if (alreadyReported) {
      res.status(409).json({ error: "You have already reported this conversation", code: "already_reported" });
      return;
    }

    const reporterRole = isBuyer ? "buyer" : "seller";
    const [created] = await sql`
      insert into marketplace_conversation_reports ${sql({
        conversation_id: convoId,
        reported_by: uid,
        reporter_role: reporterRole,
        reason,
        details,
        status: "pending",
      })}
      returning *
    `;
    res.status(201).json({ data: created });
  })
);

router.get(
  "/chat/support/inbox",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const rows = await listUserSupportInbox(req.userId);
    res.json({ data: rows });
  })
);

router.post(
  "/chat/open",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const sellerId = String(req.body?.seller_id || req.body?.sellerId || "").trim();
    const productId = String(req.body?.product_id || req.body?.productId || "").trim();
    try {
      const result = await openMarketplaceConversation(sql, {
        buyerId: req.userId,
        sellerId,
        productId,
      });
      invalidateMarketplaceChatCache(req.userId, sellerId);
      res.json({ data: result });
    } catch (err) {
      if (err instanceof MarketplaceChatOpenError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  "/chat/support/open",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    try {
      const result = await openSupportConversation({
        userId: req.userId,
        topic: req.body?.topic,
        initialMessage: req.body?.message,
      });
      const meta = await getPlatformSupportMeta(req.userId);
      if (meta?.seller_id) {
        invalidateMarketplaceChatCache(req.userId, meta.seller_id);
      }
      res.json({ data: result });
    } catch (err) {
      if (err?.code === "INVALID_TOPIC") {
        res.status(400).json({ error: err.message });
        return;
      }
      if (err?.code === "NOT_CONFIGURED") {
        res.status(503).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.patch(
  "/chat/support/:id/resolve",
  requireDatabase,
  requireUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const convoId = String(req.params.id || "");
    if (!UUID_RE.test(convoId)) {
      res.status(400).json({ error: "Invalid conversation id" });
      return;
    }
    const row = await resolveSupportConversation(convoId);
    if (!row) {
      res.status(404).json({ error: "Support conversation not found" });
      return;
    }
    res.json({ data: row });
  })
);

router.get(
  "/chat/conversations/:id/bootstrap",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const convoId = String(req.params.id || "");
    if (!UUID_RE.test(convoId)) {
      res.status(400).json({ error: "Invalid conversation id" });
      return;
    }
    const uid = req.userId;
    const [conversation] = await sql`
      select *
      from conversations
      where id = ${convoId}
      limit 1
    `;
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const isParticipant = conversation.buyer_id === uid || conversation.seller_id === uid;
    const adminRows = await sql`
      select 1 from user_roles where user_id = ${uid} and role = 'admin' limit 1
    `;
    const isAdmin = adminRows.length > 0;
    const isPlatformSupport = isPlatformSupportConversation(conversation);
    const hasModerationReport = isAdmin && !isParticipant && !isPlatformSupport
      ? await conversationHasModerationAccess(sql, convoId)
      : false;

    const allowed = adminMayReadConversation({
      isParticipant,
      isAdmin,
      isPlatformSupport,
      hasModerationReport,
    });

    if (!allowed) {
      res.status(403).json({
        error: isAdmin && !isPlatformSupport && !hasModerationReport
          ? "Admin cannot access private marketplace conversations without a report"
          : "Forbidden",
      });
      return;
    }

    if (
      !isPlatformSupport &&
      conversation.buyer_id !== conversation.seller_id
    ) {
      const canonical = await findCanonicalMarketplaceConversation(
        sql,
        conversation.buyer_id,
        conversation.seller_id,
      );
      if (canonical && canonical.id !== conversation.id) {
        res.json({ data: { redirect_conversation_id: canonical.id } });
        return;
      }
    }

    const data = await buildConversationBootstrap(sql, conversation, uid);
    res.json({ data });
  })
);

router.delete(
  "/chat/conversations/:id",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const convoId = String(req.params.id || "");
    if (!UUID_RE.test(convoId)) {
      res.status(400).json({ error: "Invalid conversation id" });
      return;
    }
    try {
      const result = await deleteSupersededMarketplaceConversation(sql, {
        userId: req.userId,
        conversationId: convoId,
      });
      invalidateMarketplaceChatCache(result.buyerId, result.sellerId);
      res.json({ data: { deleted: true, id: result.deletedId } });
    } catch (err) {
      if (err instanceof MarketplaceChatOpenError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  })
);

router.get(
  "/chat/support/conversations/:id/bootstrap",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const convoId = String(req.params.id || "");
    if (!UUID_RE.test(convoId)) {
      res.status(400).json({ error: "Invalid conversation id" });
      return;
    }
    const uid = req.userId;
    const [conversation] = await sql`
      select *
      from conversations
      where id = ${convoId}
      limit 1
    `;
    if (!conversation || !isPlatformSupportConversation(conversation)) {
      res.status(404).json({ error: "Support conversation not found" });
      return;
    }

    const adminRows = await sql`
      select 1 from user_roles where user_id = ${uid} and role = 'admin' limit 1
    `;
    const allowed = conversation.buyer_id === uid || adminRows.length > 0;
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const data = await buildConversationBootstrap(sql, conversation, uid);
    res.json({ data });
  })
);

router.post(
  "/chat/contact-violations",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = req.userId;
    const conversationId = String(req.body?.conversation_id || "");
    const reason = String(req.body?.reason || "contact_guard").slice(0, 64);

    if (conversationId && !UUID_RE.test(conversationId)) {
      res.status(400).json({ error: "Invalid conversation id" });
      return;
    }

    if (conversationId) {
      const [conversation] = await sql`
        select buyer_id, seller_id from conversations where id = ${conversationId} limit 1
      `;
      if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }
      if (conversation.buyer_id !== uid && conversation.seller_id !== uid) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    const guard = await recordChatContactViolation(sql, {
      userId: uid,
      conversationId: conversationId || null,
      reason,
    });

    res.json({
      data: serializeChatGuard(guard),
    });
  })
);

router.get(
  "/chat/conversations/:id/shop-products",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const convoId = String(req.params.id || "");
    if (!UUID_RE.test(convoId)) {
      res.status(400).json({ error: "Invalid conversation id" });
      return;
    }
    const uid = req.userId;
    const [conversation] = await sql`
      select id, buyer_id, seller_id from conversations where id = ${convoId} limit 1
    `;
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const adminRows = await sql`
      select 1 from user_roles where user_id = ${uid} and role = 'admin' limit 1
    `;
    const allowed =
      conversation.buyer_id === uid ||
      conversation.seller_id === uid ||
      adminRows.length > 0;
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const rows = q
      ? await sql`
          select id, name, price, image, category, stock
          from products
          where seller_id = ${conversation.seller_id}
            and name ilike ${`%${q}%`}
          order by created_at desc
          limit ${limit}
        `
      : await sql`
          select id, name, price, image, category, stock
          from products
          where seller_id = ${conversation.seller_id}
          order by created_at desc
          limit ${limit}
        `;
    res.json({ data: rows });
  })
);

router.post(
  "/chat/conversations/:id/receipts",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const convoId = String(req.params.id || "");
    if (!UUID_RE.test(convoId)) {
      res.status(400).json({ error: "Invalid conversation id" });
      return;
    }

    const level = String(req.body?.level || "");
    const viewerRole = String(req.body?.viewer_role || "");
    if (level !== "delivered" && level !== "read") {
      res.status(400).json({ error: "level must be delivered or read" });
      return;
    }
    if (viewerRole !== "buyer" && viewerRole !== "seller") {
      res.status(400).json({ error: "viewer_role must be buyer or seller" });
      return;
    }

    const uid = req.userId;
    const [conversation] = await sql`
      select id, buyer_id, seller_id
      from conversations
      where id = ${convoId}
      limit 1
    `;
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const isParticipant = conversation.buyer_id === uid || conversation.seller_id === uid;
    const isAdmin = await requestHasAnyRole(req, ["admin"]);
    if (!isParticipant && !isAdmin) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const oppositeRole = viewerRole === "buyer" ? "seller" : "buyer";
    const deliveredCol = viewerRole === "buyer" ? "buyer_delivered_at" : "seller_delivered_at";
    const readCol = viewerRole === "buyer" ? "buyer_read_at" : "seller_read_at";

    let updated = 0;
    if (level === "delivered") {
      const rows = await sql`
        update chat_messages
        set ${sql.unsafe(deliveredCol)} = now()
        where conversation_id = ${convoId}
          and sender_role = ${oppositeRole}
          and ${sql.unsafe(deliveredCol)} is null
        returning id
      `;
      updated = rows.length;
    } else {
      const rows = await sql`
        update chat_messages
        set
          ${sql.unsafe(deliveredCol)} = coalesce(${sql.unsafe(deliveredCol)}, now()),
          ${sql.unsafe(readCol)} = now()
        where conversation_id = ${convoId}
          and sender_role = ${oppositeRole}
          and ${sql.unsafe(readCol)} is null
        returning id
      `;
      updated = rows.length;
    }

    invalidateMarketplaceChatCache(conversation.buyer_id, conversation.seller_id);
    res.json({ data: { updated } });
  })
);

router.post(
  "/chat/messages/:messageId/translate",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const messageId = String(req.params.messageId || "");
    if (!UUID_RE.test(messageId)) {
      res.status(400).json({ error: "Invalid message id" });
      return;
    }

    const targetLang = String(req.body?.target_lang || "");
    if (targetLang !== "en" && targetLang !== "bn") {
      res.status(400).json({ error: "target_lang must be en or bn" });
      return;
    }

    const uid = req.userId;
    const [row] = await sql`
      select
        m.id,
        m.conversation_id,
        m.message_type,
        m.text_body,
        c.buyer_id,
        c.seller_id
      from chat_messages m
      join conversations c on c.id = m.conversation_id
      where m.id = ${messageId}
      limit 1
    `;
    if (!row) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    const isParticipant = row.buyer_id === uid || row.seller_id === uid;
    const isAdmin = await requestHasAnyRole(req, ["admin"]);
    if (!isParticipant && !isAdmin) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (row.message_type !== "text") {
      res.status(400).json({ error: "Only text chat messages can be translated" });
      return;
    }

    const original = String(row.text_body || "").trim();
    if (!original) {
      res.status(400).json({ error: "Message has no text to translate" });
      return;
    }

    try {
      const result = await getOrCreateChatTranslation(sql, messageId, targetLang, original);
      res.json({ data: result });
    } catch (err) {
      if (err?.code === "NOT_CONFIGURED") {
        res.status(503).json({ error: "Translation service not configured" });
        return;
      }
      console.error("[marketplace] chat translate failed:", err instanceof Error ? err.message : err);
      res.status(502).json({ error: "Translation failed" });
    }
  })
);

router.get(
  "/chat/share-products",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const uid = req.userId;
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const rows = q
      ? await sql`
          select id, name, price, image, category, stock
          from products
          where seller_id = ${uid}
            and name ilike ${`%${q}%`}
          order by created_at desc
          limit ${limit}
        `
      : await sql`
          select id, name, price, image, category, stock
          from products
          where seller_id = ${uid}
          order by created_at desc
          limit ${limit}
        `;
    res.json({ data: rows });
  })
);

router.get(
  "/products",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const sellerName = req.query.seller_name;
    const sellerId = req.query.seller_id;
    const category = normalizeCategory(req.query.category);
    const lane = normalizeCategory(req.query.lane);
    const inStock = req.query.in_stock === "true";
    const sort = String(req.query.sort || "newest");
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const cacheKey = makeCacheKey(MARKETPLACE_CACHE_PREFIX, {
      userId: "anon",
      parts: ["products", sellerName || "", sellerId || "", category, lane, inStock ? "1" : "0", sort, limit],
    });
    const { value: rows, cacheHit } = await getOrSetCachedValue(cacheKey, 15_000, async () => {
      const runJoined = async (whereSql, sortValue, rowLimit) => {
        const runQuery = async (sortClause) => {
          const joined = await queryProductsWithShopName(() => sql`
            select p.*, ${coalescedShopName}
            ${productShopJoin}
            ${whereSql}
            ${sortClause} limit ${rowLimit}
          `);
          if (joined) return joined;
          return sql`
            select p.*, s.shop_name
            from products p
            left join shops s on s.user_id = p.seller_id
            ${whereSql}
            ${sortClause} limit ${rowLimit}
          `;
        };

        try {
          return await runQuery(resolveSortClause(sortValue));
        } catch (err) {
          if (sortValue === "storefront" && isStorefrontSchemaError(err)) {
            console.warn(
              "[marketplace] storefront sort columns missing, falling back to newest. Run: npm run db:ensure"
            );
            return runQuery(resolveSortClause("newest"));
          }
          throw err;
        }
      };

      if (sellerName) {
        return runJoined(
          sql`where p.seller_name = ${sellerName} and coalesce(p.listing_status, 'approved') = 'approved'`,
          sort,
          limit
        );
      }
      if (sellerId && typeof sellerId === "string") {
        return runJoined(
          sql`where p.seller_id = ${sellerId} and coalesce(p.listing_status, 'approved') = 'approved'`,
          sort,
          limit
        );
      }

      const laneList = resolveLaneCategoryList(lane);

      if (laneList && category) {
        return runJoined(
          sql`
            where lower(trim(coalesce(p.category, ''))) in ${sql(laneList)}
              and lower(trim(coalesce(p.category, ''))) = ${category}
              and coalesce(p.listing_status, 'approved') = 'approved'
              ${inStock ? sql`and coalesce(p.stock, 0) > 0` : sql``}
          `,
          sort,
          limit
        );
      }
      if (laneList) {
        return runJoined(
          sql`
            where lower(trim(coalesce(p.category, ''))) in ${sql(laneList)}
              and coalesce(p.listing_status, 'approved') = 'approved'
              ${inStock ? sql`and coalesce(p.stock, 0) > 0` : sql``}
          `,
          sort,
          limit
        );
      }
      if (category) {
        return runJoined(
          sql`
            where lower(trim(coalesce(p.category, ''))) = ${category}
              and coalesce(p.listing_status, 'approved') = 'approved'
              ${inStock ? sql`and coalesce(p.stock, 0) > 0` : sql``}
          `,
          sort,
          limit
        );
      }
      if (inStock) {
        return runJoined(
          sql`where coalesce(p.stock, 0) > 0 and coalesce(p.listing_status, 'approved') = 'approved'`,
          sort,
          limit
        );
      }
      return runJoined(
        sql`where coalesce(p.listing_status, 'approved') = 'approved'`,
        sort,
        limit
      );
    });
    res.setHeader("Cache-Control", "public, s-maxage=45, max-age=20");
    res.setHeader("x-fb-cache", cacheHit ? "hit" : "miss");
    res.json({ data: rows });
  })
);

router.get(
  "/products/featured",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select * from products
      where coalesce(listing_status, 'approved') = 'approved'
      order by rating desc nulls last limit 4
    `;
    res.setHeader("Cache-Control", "public, s-maxage=60, max-age=30");
    res.json({ data: rows });
  })
);

async function loadProductWithShop(product) {
  let [shop] = await sql`
    select * from shops where user_id = ${product.seller_id} limit 1
  `;

  if (!shop) {
    const [approvedRequest] = await sql`
      select *
      from approval_requests
      where user_id = ${product.seller_id}
        and request_type = 'shop_access'
        and status = 'approved'
      order by updated_at desc
      limit 1
    `;
    if (approvedRequest) {
      try {
        shop = await upsertShopFromApprovalRequest(sql, approvedRequest);
      } catch (err) {
        console.warn("[marketplace] shop upsert from approval failed:", err instanceof Error ? err.message : err);
      }
    }
  }

  let shopNameRow = { shop_name: shop?.shop_name || null };
  try {
    const [row] = await sql`
      select coalesce(
        nullif(trim(s.shop_name), ''),
        nullif(trim(ar.request_shop_name), '')
      ) as shop_name
      from (select ${product.seller_id}::uuid as seller_id) p
      left join shops s on s.user_id = p.seller_id
      left join lateral (
        select trim(coalesce(ar.details->>'shopName', ar.payload->>'shopName', '')) as request_shop_name
        from approval_requests ar
        where ar.user_id = p.seller_id
          and ar.request_type = 'shop_access'
          and ar.status = 'approved'
        order by ar.updated_at desc
        limit 1
      ) ar on true
    `;
    if (row) shopNameRow = row;
  } catch (err) {
    console.warn("[marketplace] shop name lookup failed:", err instanceof Error ? err.message : err);
  }

  if (shop && shopNameRow?.shop_name && !shop.shop_name) {
    shop = { ...shop, shop_name: shopNameRow.shop_name };
  } else if (!shop && shopNameRow?.shop_name) {
    shop = {
      user_id: product.seller_id,
      shop_name: shopNameRow.shop_name,
      description: null,
      location: product.location || null,
    };
  }

  const shopWithStats = await enrichShopWithLiveStats(shop, String(product.seller_id));

  return {
    product: { ...product, shop_name: shopNameRow?.shop_name || shop?.shop_name || null },
    shop: shopWithStats || null,
  };
}

router.get(
  "/products/:id/details",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const [product] = await sql`select * from products where id = ${req.params.id} limit 1`;
    if (!product) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (String(product.listing_status || "approved") !== "approved") {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const data = await loadProductWithShop(product);

    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data });
  })
);

router.get(
  "/products/:id",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const cacheKey = makeCacheKey(MARKETPLACE_CACHE_PREFIX, {
      userId: "anon",
      parts: ["product", req.params.id],
    });
    const { value: row, cacheHit } = await getOrSetCachedValue(cacheKey, 20_000, async () => {
      const [data] = await sql`select * from products where id = ${req.params.id} limit 1`;
      return data || null;
    });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (String(row.listing_status || "approved") !== "approved") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.setHeader("Cache-Control", "public, s-maxage=45, max-age=20");
    res.setHeader("x-fb-cache", cacheHit ? "hit" : "miss");
    res.json({ data: row });
  })
);

router.get(
  "/shops/by-user/:userId",
  requireDatabase,
  asyncHandler(async (req, res) => {
    const [row] = await sql`
      select * from shops where user_id = ${req.params.userId} limit 1
    `;
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const data = await enrichShopWithLiveStats(row, String(req.params.userId));
    res.json({ data });
  })
);

const sellerChain = [requireDatabase, requireUser];

async function guardSellerMarketplace(req, res, next) {
  try {
    const isAdmin = await requestHasAnyRole(req, ["admin"]);
    if (isAdmin) return next();
    await assertSellerCanOperate(req.userId);
    next();
  } catch (error) {
    if (error instanceof ModerationError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
}

const sellerWriteChain = [...sellerChain, guardSellerMarketplace];

router.post(
  "/products/upload-image",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    const fileData = String(req.body?.image || req.body?.file_data || "");
    if (!fileData) {
      res.status(400).json({ error: "image is required" });
      return;
    }
    try {
      const uploaded = await uploadToCloudinary(fileData, "marketplace/products", `product_${req.userId}`);
      res.status(201).json({ data: { url: uploaded.url } });
    } catch (error) {
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("cloudinary is not configured")) {
        res.status(201).json({ data: { url: fileData, storage: "inline_data_url" } });
        return;
      }
      throw error;
    }
  })
);

router.post(
  "/products",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    const body = { ...req.body };
    delete body.seller_id;
    const isAdmin = await requestHasAnyRole(req, ["admin"]);
    if (!isAdmin) stripFlashSaleFromBody(body);
    let validated;
    try {
      validated = validateProductPayload(body);
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message });
      return;
    }
    if (!isAdmin) {
      stripFlashSaleFromValidated(validated);
      delete validated.is_verified_seller;
    }
    if (!isAdmin) {
      try {
        await assertSellerMayListCategory(req.userId, validated.category);
      } catch (error) {
        if (error instanceof SellerLaneError) {
          res.status(error.status).json({ error: error.message });
          return;
        }
        throw error;
      }
    }
    const b = {
      ...validated,
      seller_id: req.userId,
      listing_status: isAdmin ? String(validated.listing_status || "approved") : "pending_review",
      listing_submitted_at: new Date().toISOString(),
    };
    delete b.listing_review_notes;
    delete b.listing_reviewed_by;
    delete b.listing_reviewed_at;
    try {
      const [created] = await sql`
        insert into products ${sql(b)}
        returning *
      `;
      invalidateMarketplaceProductsCache();
      res.status(201).json({ data: created });
    } catch (error) {
      if (error?.code === "42703") {
        res.status(503).json({
          error: 'Database schema is outdated (missing product columns). From the backend folder run: npm run db:ensure',
        });
        return;
      }
      throw error;
    }
  })
);

router.patch(
  "/products/:id",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    const [existing] = await sql`
      select * from products where id = ${req.params.id} limit 1
    `;
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.seller_id !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const isAdmin = await requestHasAnyRole(req, ["admin"]);
    let validated;
    try {
      const body = { ...req.body };
      delete body.seller_id;
      if (!isAdmin) stripFlashSaleFromBody(body);
      validated = validateProductPayload(body, { partial: true, existing });
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message });
      return;
    }
    if (!Object.keys(validated).length) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }
    if (!isAdmin) {
      stripFlashSaleFromValidated(validated);
      delete validated.is_verified_seller;
    }
    if (!isAdmin) {
      if (validated.category) {
        try {
          await assertSellerMayListCategory(req.userId, validated.category);
        } catch (error) {
          if (error instanceof SellerLaneError) {
            res.status(error.status).json({ error: error.message });
            return;
          }
          throw error;
        }
      }
      validated.listing_status = "pending_review";
      validated.listing_submitted_at = new Date().toISOString();
      validated.listing_review_notes = null;
      validated.listing_reviewed_by = null;
      validated.listing_reviewed_at = null;
    }
    const [updated] = await sql`
      update products set ${sql(validated)}, updated_at = now() where id = ${req.params.id} returning *
    `;
    invalidateMarketplaceProductsCache();
    res.json({ data: updated });
  })
);

router.delete(
  "/products/:id",
  requireDatabase,
  requireUser,
  blockNonSuperAdminPreviewWrite,
  asyncHandler(async (req, res) => {
    const superAdmin = await isSuperAdminUser(req.userId);
    const rows = superAdmin
      ? await sql`delete from products where id = ${req.params.id} returning id`
      : await sql`
          delete from products where id = ${req.params.id} and seller_id = ${req.userId} returning id
        `;
    if (!rows.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  })
);

router.patch(
  "/shops/:userId",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    if (req.params.userId !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const allowed = ["description", "location", "shop_name", "logo_url", "banner_url"];
    const patch = {};
    for (const key of allowed) {
      if (key in req.body) patch[key] = req.body[key];
    }
    if (!Object.keys(patch).length) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }
    patch.updated_at = new Date().toISOString();
    const [updated] = await sql`
      update shops set ${sql(patch)} where user_id = ${req.userId} returning *
    `;
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: updated });
  })
);

router.post(
  "/shops/upload-asset",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    const assetType = String(req.body?.type || req.body?.asset_type || "banner").toLowerCase();
    if (assetType !== "banner" && assetType !== "logo") {
      res.status(400).json({ error: "type must be banner or logo" });
      return;
    }
    const fileData = String(req.body?.image || req.body?.file_data || "");
    if (!fileData) {
      res.status(400).json({ error: "image is required" });
      return;
    }
    const folder = assetType === "logo" ? "marketplace/shops/logos" : "marketplace/shops/banners";
    try {
      const uploaded = await uploadToCloudinary(fileData, folder, `shop_${assetType}_${req.userId}`);
      res.status(201).json({ data: { url: uploaded.url, type: assetType } });
    } catch (error) {
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("cloudinary is not configured")) {
        res.status(201).json({ data: { url: fileData, type: assetType, storage: "inline_data_url" } });
        return;
      }
      throw error;
    }
  })
);

router.patch(
  "/shops/:userId/storefront",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    if (req.params.userId !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    try {
      const updated = await applyShopStorefrontUpdates(sql, req.userId, req.body?.items || []);
      res.json({ data: updated });
    } catch (error) {
      if (error instanceof ShopStorefrontError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.patch(
  "/admin/products/verify-seller",
  requireDatabase,
  requireUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { seller_user_id: sellerUserId, is_verified_seller: verified } = req.body || {};
    if (!sellerUserId || verified === undefined) {
      res.status(400).json({ error: "seller_user_id and is_verified_seller required" });
      return;
    }
    await sql`
      update products set is_verified_seller = ${verified} where seller_id = ${sellerUserId}
    `;
    res.status(204).end();
  })
);

router.patch(
  "/admin/shops/:userId/verification",
  requireDatabase,
  requireUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    const { is_verified: isVerified, verified_by: verifiedBy } = req.body || {};
    if (typeof isVerified !== "boolean") {
      res.status(400).json({ error: "is_verified (boolean) required" });
      return;
    }
    const now = new Date().toISOString();
    const [updated] = await sql`
      update shops set
        is_verified = ${isVerified},
        verified_at = ${isVerified ? now : null},
        verified_by = ${isVerified ? verifiedBy || req.userId : null},
        updated_at = ${now}
      where user_id = ${userId}
      returning *
    `;
    if (!updated) {
      res.status(404).json({ error: "Shop not found" });
      return;
    }
    res.json({ data: updated });
  })
);


router.get(
  "/banners",
  requireDatabase,
  asyncHandler(async (req, res) => {
    await ensureMarketplaceBannersTable();
    const cacheKey = makeCacheKey(MARKETPLACE_CACHE_PREFIX, {
      userId: "anon",
      parts: ["banners", "active"],
    });
    const { value: rows } = await getOrSetCachedValue(cacheKey, 15_000, async () => {
      return sql`
        select id, image_url, alt_text, link_url, sort_order, display_seconds
        from marketplace_banners
        where is_active = true
          and (starts_at is null or starts_at <= now())
          and (ends_at is null or ends_at >= now())
        order by sort_order asc, created_at asc
      `;
    });
    res.json({ data: rows });
  })
);

const adminChain = [requireDatabase, requireUser, requireAdmin];

router.get(
  "/admin/platform-support/meta",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const meta = await getPlatformSupportMeta(req.userId);
    if (!meta) {
      res.status(404).json({ error: "Platform support is not configured" });
      return;
    }
    res.json({ data: meta });
  })
);

router.get(
  "/admin/farmbondhu-shop/meta",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const meta = await getOfficialFarmBondhuShopMeta(req.userId);
    if (!meta) {
      res.status(404).json({ error: "Official FarmBondhu shop seller not configured" });
      return;
    }
    res.json({ data: meta });
  })
);

async function requireOfficialShopSellerIdFromRequest(req, res) {
  const sellerId = await resolveOfficialShopSellerId(req.userId);
  if (!sellerId) {
    res.status(404).json({ error: "Official FarmBondhu shop seller not configured" });
    return null;
  }
  return sellerId;
}

router.get(
  "/admin/farmbondhu-shop/inventory",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    const rows = await listSellerInventory(sellerId);
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data: rows });
  })
);

router.get(
  "/admin/farmbondhu-shop/earnings/summary",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    const summary = await computeSellerEarningsSummary(sellerId);
    const historyLimit = Math.min(Math.max(Number(req.query.history_limit) || 30, 1), 100);
    const historyRows = await sql`
      select id, buyer_name, total, status, payment_status, created_at, updated_at
      from orders
      where seller_id = ${sellerId}
        and status = 'delivered'
      order by coalesce(updated_at, created_at) desc
      limit ${historyLimit}
    `;
    const monthlyTrend = await fetchSellerMonthlyTrend(sellerId, 6);
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({
      data: {
        ...summary,
        monthly_trend: monthlyTrend,
        history: historyRows.map((r) => ({
          id: r.id,
          buyer_name: r.buyer_name || "Customer",
          total: sellerPayoutToMoney(r.total || 0),
          status: r.status,
          payment_status: r.payment_status,
          created_at: r.created_at,
          delivered_at: r.updated_at || r.created_at,
        })),
      },
    });
  })
);

router.get(
  "/admin/farmbondhu-shop/earnings/breakdown",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    const data = await fetchSellerEarningsBreakdown(sellerId);
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data });
  })
);

router.get(
  "/admin/farmbondhu-shop/withdrawals",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    const rows = await listSellerWithdrawalsForUser(sellerId);
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data: rows });
  })
);

router.get(
  "/admin/farmbondhu-shop/products",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    const rows = await sql`
      select *
      from products
      where seller_id = ${sellerId}
      order by created_at desc
      limit 500
    `;
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data: rows });
  })
);

router.get(
  "/admin/farmbondhu-shop/orders",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    const lim = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const rows = await sql`
      select *
      from orders
      where seller_id = ${sellerId}
      order by created_at desc
      limit ${lim}
    `;
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data: rows });
  })
);

router.get(
  "/admin/farmbondhu-shop/orders/:orderId",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    const orderId = String(req.params.orderId || "");
    if (!UUID_RE.test(orderId)) {
      res.status(400).json({ error: "Invalid order id" });
      return;
    }
    const [row] = await sql`
      select *
      from orders
      where id = ${orderId}
        and seller_id = ${sellerId}
      limit 1
    `;
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data: row });
  })
);

router.patch(
  "/admin/farmbondhu-shop/shop",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    await ensureOfficialFarmBondhuShop(sellerId);
    const allowed = ["description", "location", "shop_name", "logo_url", "banner_url"];
    const patch = {};
    for (const key of allowed) {
      if (key in req.body) patch[key] = req.body[key];
    }
    if (!Object.keys(patch).length) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }
    patch.updated_at = new Date().toISOString();
    const [updated] = await sql`
      update shops set ${sql(patch)} where user_id = ${sellerId} returning *
    `;
    if (!updated) {
      res.status(404).json({ error: "Shop not found" });
      return;
    }
    res.json({ data: updated });
  })
);

router.patch(
  "/admin/farmbondhu-shop/storefront",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    try {
      const updated = await applyShopStorefrontUpdates(sql, sellerId, req.body?.items || []);
      res.json({ data: updated });
    } catch (error) {
      if (error instanceof ShopStorefrontError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.post(
  "/admin/farmbondhu-shop/upload-asset",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    const assetType = String(req.body?.type || req.body?.asset_type || "banner").toLowerCase();
    if (assetType !== "banner" && assetType !== "logo") {
      res.status(400).json({ error: "type must be banner or logo" });
      return;
    }
    const fileData = String(req.body?.image || req.body?.file_data || "");
    if (!fileData) {
      res.status(400).json({ error: "image is required" });
      return;
    }
    const folder = assetType === "logo" ? "marketplace/shops/logos" : "marketplace/shops/banners";
    try {
      const uploaded = await uploadToCloudinary(fileData, folder, `shop_${assetType}_${sellerId}`);
      res.status(201).json({ data: { url: uploaded.url, type: assetType } });
    } catch (error) {
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("cloudinary is not configured")) {
        res.status(201).json({ data: { url: fileData, type: assetType, storage: "inline_data_url" } });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/admin/farmbondhu-shop/products/:productId",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    const productId = String(req.params.productId || "");
    if (!UUID_RE.test(productId)) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }
    const [product] = await sql`select * from products where id = ${productId} limit 1`;
    if (!product) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (String(product.seller_id) !== String(sellerId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const data = await loadProductWithShop(product);
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data });
  })
);

router.post(
  "/admin/farmbondhu-shop/withdrawals",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    const requestAmount = Number(req.body?.request_amount);
    if (!Number.isFinite(requestAmount) || requestAmount <= 0) {
      res.status(400).json({ error: "request_amount must be a positive number" });
      return;
    }
    try {
      const created = await createSellerWithdrawal(sellerId, requestAmount, req.body?.note);
      res.status(201).json({ data: created });
    } catch (error) {
      const status = /** @type {{ status?: number }} */ (error)?.status || 500;
      res.status(status).json({ error: error instanceof Error ? error.message : "Withdrawal failed" });
    }
  })
);

router.get(
  "/admin/farmbondhu-shop/reviews",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    const filter = req.query.filter ? String(req.query.filter) : "all";
    const productId = req.query.product_id ? String(req.query.product_id) : undefined;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await listSellerReviews(sellerId, { filter, productId, page, limit });
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data });
  })
);

router.put(
  "/admin/farmbondhu-shop/reviews/:id/reply",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid review id" });
      return;
    }
    try {
      const updated = await upsertSellerReviewReply(
        sellerId,
        req.params.id,
        req.body?.reply ?? req.body?.body,
      );
      res.json({ data: updated });
    } catch (error) {
      if (error instanceof ReviewError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/admin/farmbondhu-shop/product-comments",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    const filter = req.query.filter ? String(req.query.filter) : "all";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await listSellerProductComments(sellerId, { filter, page, limit });
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data });
  })
);

router.post(
  "/admin/farmbondhu-shop/product-comments/:id/reply",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const sellerId = await requireOfficialShopSellerIdFromRequest(req, res);
    if (!sellerId) return;
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid comment id" });
      return;
    }
    try {
      const created = await upsertSellerCommentReply(
        sellerId,
        req.params.id,
        req.body?.body ?? req.body?.reply,
      );
      res.status(201).json({ data: created });
    } catch (error) {
      if (error instanceof ReviewError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/admin/buyers",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const result = await listAdminBuyers({
      search: req.query.search,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(result);
  })
);

router.get(
  "/admin/buyers/:id",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const detail = await getAdminBuyerDetail(String(req.params.id || ""));
    if (!detail) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: detail });
  })
);

router.patch(
  "/admin/buyers/:id/moderate",
  ...adminChain,
  asyncHandler(async (req, res) => {
    try {
      const result = await moderateMarketplaceUser({
        adminUserId: req.userId,
        targetUserId: String(req.params.id || ""),
        action: req.body?.action,
        confirmPhrase: req.body?.confirmPhrase,
        role: "buyer",
      });
      res.json({ data: result });
    } catch (error) {
      if (error instanceof ModerationError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/admin/sellers",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const result = await listAdminSellers({
      search: req.query.search,
      verified: req.query.verified,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(result);
  })
);

router.get(
  "/admin/sellers/:userId",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const detail = await getAdminSellerDetail(String(req.params.userId || ""));
    if (!detail) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: detail });
  })
);

router.patch(
  "/admin/sellers/:userId/moderate",
  ...adminChain,
  asyncHandler(async (req, res) => {
    try {
      const result = await moderateMarketplaceUser({
        adminUserId: req.userId,
        targetUserId: String(req.params.userId || ""),
        action: req.body?.action,
        confirmPhrase: req.body?.confirmPhrase,
        role: "seller",
      });
      res.json({ data: result });
    } catch (error) {
      if (error instanceof ModerationError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/admin/orders",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const result = await listAdminOrders({
      status: req.query.status,
      payment_status: req.query.payment_status,
      search: req.query.search,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(result);
  })
);

router.get(
  "/admin/orders/:id",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const order = await getAdminOrderDetail(String(req.params.id || ""));
    if (!order) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: order });
  })
);

router.get(
  "/admin/transactions",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const result = await listAdminTransactions({
      type: req.query.type,
      status: req.query.status,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(result);
  })
);

router.get(
  "/admin/banners",
  ...adminChain,
  asyncHandler(async (_req, res) => {
    await ensureMarketplaceBannersTable();
    const rows = await sql`
      select *
      from marketplace_banners
      order by sort_order asc, created_at asc
    `;
    res.json({ data: rows });
  })
);

router.post(
  "/admin/banners/upload-image",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const fileData = String(req.body?.image || req.body?.file_data || "");
    if (!fileData) {
      res.status(400).json({ error: "image is required" });
      return;
    }
    const uploaded = await uploadToCloudinary(
      fileData,
      CLOUDINARY_FOLDER_MARKETPLACE_BANNERS,
      `banner_${req.userId}`
    );
    res.status(201).json({
      data: { url: uploaded.url, folder: CLOUDINARY_FOLDER_MARKETPLACE_BANNERS },
    });
  })
);

router.post(
  "/admin/banners",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const imageUrl = String(body.image_url || "").trim();
    if (!isValidBannerImageUrl(imageUrl)) {
      res.status(400).json({ error: "Valid Cloudinary image_url (https) is required" });
      return;
    }
    const linkUrl = normalizeBannerLinkUrl(body.link_url);
    if (!isValidBannerLinkUrl(linkUrl)) {
      res.status(400).json({ error: "Invalid link_url" });
      return;
    }
    const sortOrder = Number(body.sort_order);
    const isActive = body.is_active !== false;
    const timerFields = parseBannerTimerFields(body, { requireDisplaySeconds: true });
    if (timerFields.error) {
      res.status(400).json({ error: timerFields.error });
      return;
    }
    await ensureMarketplaceBannersTable();
    const [row] = await sql`
      insert into marketplace_banners (
        image_url, alt_text, link_url, sort_order, is_active, display_seconds, starts_at, ends_at, created_by
      ) values (
        ${imageUrl},
        ${body.alt_text != null ? String(body.alt_text).slice(0, 200) : null},
        ${linkUrl},
        ${Number.isFinite(sortOrder) ? sortOrder : 0},
        ${isActive},
        ${timerFields.value.display_seconds},
        ${timerFields.value.starts_at ?? null},
        ${timerFields.value.ends_at ?? null},
        ${req.userId}
      )
      returning *
    `;
    invalidateMarketplaceBannersCache();
    res.status(201).json({ data: row });
  })
);

router.patch(
  "/admin/banners/:id",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || "");
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: "Invalid banner id" });
      return;
    }
    const body = req.body || {};
    const patch = {};
    if ("image_url" in body) {
      const imageUrl = String(body.image_url || "").trim();
      if (!isValidBannerImageUrl(imageUrl)) {
        res.status(400).json({ error: "Valid Cloudinary image_url (https) is required" });
        return;
      }
      patch.image_url = imageUrl;
    }
    if ("alt_text" in body) patch.alt_text = body.alt_text != null ? String(body.alt_text).slice(0, 200) : null;
    if ("link_url" in body) {
      const linkUrl = normalizeBannerLinkUrl(body.link_url);
      if (!isValidBannerLinkUrl(linkUrl)) {
        res.status(400).json({ error: "Invalid link_url" });
        return;
      }
      patch.link_url = linkUrl;
    }
    if ("sort_order" in body) {
      const sortOrder = Number(body.sort_order);
      if (!Number.isFinite(sortOrder)) {
        res.status(400).json({ error: "Invalid sort_order" });
        return;
      }
      patch.sort_order = sortOrder;
    }
    if ("is_active" in body) patch.is_active = Boolean(body.is_active);
    if ("display_seconds" in body || "starts_at" in body || "ends_at" in body) {
      const timerFields = parseBannerTimerFields(body);
      if (timerFields.error) {
        res.status(400).json({ error: timerFields.error });
        return;
      }
      Object.assign(patch, timerFields.value);
    }
    patch.updated_at = new Date().toISOString();
    if (!Object.keys(patch).length) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    await ensureMarketplaceBannersTable();
    if ("starts_at" in patch || "ends_at" in patch) {
      const [existing] = await sql`
        select starts_at, ends_at from marketplace_banners where id = ${id}
      `;
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const mergedStarts = "starts_at" in patch ? patch.starts_at : existing.starts_at;
      const mergedEnds = "ends_at" in patch ? patch.ends_at : existing.ends_at;
      const scheduleErr = validateBannerSchedule(mergedStarts, mergedEnds);
      if (scheduleErr) {
        res.status(400).json({ error: scheduleErr.error });
        return;
      }
    }
    const [row] = await sql`
      update marketplace_banners set ${sql(patch)} where id = ${id} returning *
    `;
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    invalidateMarketplaceBannersCache();
    res.json({ data: row });
  })
);

router.delete(
  "/admin/banners/:id",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || "");
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: "Invalid banner id" });
      return;
    }
    await ensureMarketplaceBannersTable();
    const [row] = await sql`delete from marketplace_banners where id = ${id} returning id`;
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    invalidateMarketplaceBannersCache();
    res.status(204).end();
  })
);

router.get(
  "/chat/sound-config",
  requireDatabase,
  asyncHandler(async (_req, res) => {
    const data = await getChatSoundConfig();
    res.json({ data });
  })
);

router.get(
  "/chat/sound-preference",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const data = await getUserChatSoundPreference(req.userId);
    res.json({ data });
  })
);

router.patch(
  "/chat/sound-preference",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const soundId = String(req.body?.sound_id || "").trim();
    const result = await updateUserChatSoundPreference(req.userId, soundId);
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ data: result.value });
  })
);

router.get(
  "/admin/chat-sound",
  ...adminChain,
  asyncHandler(async (_req, res) => {
    const data = await getChatSoundConfig();
    res.json({ data });
  })
);

router.patch(
  "/admin/chat-sound",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const result = await updateChatSoundSettings({
      defaultId: body.default_id,
      enabledIds: body.enabled_ids,
      updatedBy: req.userId,
    });
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ data: result.value });
  })
);

router.get(
  "/seller/inventory",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    const rows = await listSellerInventory(req.userId);
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data: rows });
  })
);

router.get(
  "/seller/products/:id",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }
    const [product] = await sql`select * from products where id = ${req.params.id} limit 1`;
    if (!product) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (String(product.seller_id) !== String(req.userId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const data = await loadProductWithShop(product);
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data });
  })
);

router.get(
  "/seller/photo-editor/drafts",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    const rows = await sql`
      select * from marketing_design_drafts
      where user_id = ${req.userId}
      order by updated_at desc
      limit 200
    `;
    res.json({ data: rows });
  })
);

router.post(
  "/seller/photo-editor/drafts",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const width = Number(body.width);
    const height = Number(body.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
      res.status(400).json({ error: "Valid width and height required" });
      return;
    }
    const title = String(body.title || "Untitled").trim().slice(0, 200) || "Untitled";
    const canvasJson = body.canvas_json && typeof body.canvas_json === "object" ? body.canvas_json : {};
    const now = new Date().toISOString();
    const [created] = await sql`
      insert into marketing_design_drafts (
        user_id, title, preset_key, width, height, canvas_json, thumbnail_data, created_at, updated_at
      ) values (
        ${req.userId},
        ${title},
        ${body.preset_key ? String(body.preset_key) : null},
        ${Math.round(width)},
        ${Math.round(height)},
        ${sql.json(canvasJson)},
        ${body.thumbnail_data ? String(body.thumbnail_data).slice(0, 500000) : null},
        ${now},
        ${now}
      )
      returning *
    `;
    res.status(201).json({ data: created });
  })
);

router.get(
  "/seller/photo-editor/drafts/:id",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid draft id" });
      return;
    }
    const [row] = await sql`
      select * from marketing_design_drafts
      where id = ${req.params.id} and user_id = ${req.userId}
      limit 1
    `;
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: row });
  })
);

router.patch(
  "/seller/photo-editor/drafts/:id",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid draft id" });
      return;
    }
    const [existing] = await sql`
      select * from marketing_design_drafts
      where id = ${req.params.id} and user_id = ${req.userId}
      limit 1
    `;
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = req.body || {};
    const now = new Date().toISOString();
    const title =
      body.title != null ? String(body.title).trim().slice(0, 200) || "Untitled" : existing.title;
    const presetKey =
      body.preset_key !== undefined
        ? body.preset_key
          ? String(body.preset_key)
          : null
        : existing.preset_key;
    const width = body.width != null ? Math.round(Number(body.width)) : existing.width;
    const height = body.height != null ? Math.round(Number(body.height)) : existing.height;
    const canvasJson =
      body.canvas_json != null && typeof body.canvas_json === "object"
        ? body.canvas_json
        : existing.canvas_json;
    const thumbnailData =
      body.thumbnail_data !== undefined
        ? body.thumbnail_data
          ? String(body.thumbnail_data).slice(0, 500000)
          : null
        : existing.thumbnail_data;
    const [updated] = await sql`
      update marketing_design_drafts set
        title = ${title},
        preset_key = ${presetKey},
        width = ${width},
        height = ${height},
        canvas_json = ${sql.json(canvasJson)},
        thumbnail_data = ${thumbnailData},
        updated_at = ${now}
      where id = ${req.params.id} and user_id = ${req.userId}
      returning *
    `;
    res.json({ data: updated });
  })
);

router.delete(
  "/seller/photo-editor/drafts/:id",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid draft id" });
      return;
    }
    const result = await sql`
      delete from marketing_design_drafts
      where id = ${req.params.id} and user_id = ${req.userId}
      returning id
    `;
    if (!result.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  })
);

router.get(
  "/seller/reviews",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    const filter = req.query.filter ? String(req.query.filter) : "all";
    const productId = req.query.product_id ? String(req.query.product_id) : undefined;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await listSellerReviews(req.userId, { filter, productId, page, limit });
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data });
  })
);

router.put(
  "/seller/reviews/:id/reply",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid review id" });
      return;
    }
    try {
      const updated = await upsertSellerReviewReply(
        req.userId,
        req.params.id,
        req.body?.reply ?? req.body?.body,
      );
      res.json({ data: updated });
    } catch (error) {
      if (error instanceof ReviewError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/seller/product-comments",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    const filter = req.query.filter ? String(req.query.filter) : "all";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await listSellerProductComments(req.userId, { filter, page, limit });
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data });
  })
);

router.post(
  "/seller/product-comments/:id/reply",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid comment id" });
      return;
    }
    try {
      const created = await upsertSellerCommentReply(
        req.userId,
        req.params.id,
        req.body?.body ?? req.body?.reply,
      );
      res.status(201).json({ data: created });
    } catch (error) {
      if (error instanceof ReviewError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.post(
  "/seller-onboarding",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    try {
      const data = await submitSellerOnboarding(req.userId, req.body || {});
      res.status(201).json({ data });
    } catch (error) {
      if (error instanceof SellerLaneError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/seller-onboarding/me",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const data = await getSellerOnboardingMe(req.userId);
    res.json({ data });
  })
);

router.post(
  "/seller-onboarding/resubmit",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    try {
      const data = await resubmitSellerLanes(req.userId, req.body || {});
      res.json({ data });
    } catch (error) {
      if (error instanceof SellerLaneError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.post(
  "/seller-onboarding/upload-license",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const fileData = String(req.body?.file || req.body?.image || req.body?.file_data || "");
    if (!fileData) {
      res.status(400).json({ error: "file is required" });
      return;
    }
    try {
      const uploaded = await uploadToCloudinary(fileData, "marketplace/seller-licenses", `license_${req.userId}`);
      res.status(201).json({ data: { url: uploaded.url, storage: "cloudinary" } });
    } catch (error) {
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("cloudinary is not configured")) {
        res.status(201).json({ data: { url: fileData, storage: "inline_data_url" } });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/admin/seller-lanes",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "pending";
    const userId = typeof req.query.user_id === "string" ? req.query.user_id : null;
    const data = await listAdminSellerLanes({ status, userId });
    res.json({ data });
  })
);

router.patch(
  "/admin/seller-lanes/:userId/:lane",
  ...adminChain,
  asyncHandler(async (req, res) => {
    try {
      const data = await reviewSellerLane({
        userId: req.params.userId,
        lane: req.params.lane,
        action: req.body?.action,
        reviewNotes: req.body?.review_notes,
        adminUserId: req.userId,
      });
      res.json({ data });
    } catch (error) {
      if (error instanceof SellerLaneError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/admin/products/listings",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const listingStatus =
      typeof req.query.listing_status === "string" ? req.query.listing_status : "pending_review";
    const data = await listAdminProductsByListingStatus(listingStatus);
    res.json({ data });
  })
);

router.get(
  "/admin/flash-sale/requests",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || "pending").toLowerCase();
    const allowed = new Set(["pending", "approved", "rejected"]);
    if (!allowed.has(status)) {
      res.status(400).json({ error: "Invalid status filter" });
      return;
    }
    try {
      const rows = await sql`
        select
          p.*,
          s.shop_name,
          pr.name as owner_name
        from products p
        left join shops s on s.user_id = p.seller_id
        left join profiles pr on pr.id = p.seller_id
        where p.flash_sale_request_status = ${status}
        order by coalesce(p.flash_sale_requested_at, p.created_at) desc
        limit 500
      `;
      res.json({ data: rows });
    } catch (error) {
      if (error?.code === "42703") {
        res.status(503).json({
          error:
            "Database schema is outdated (missing flash sale request columns). From the backend folder run: npm run db:ensure",
        });
        return;
      }
      throw error;
    }
  })
);

router.post(
  "/seller/products/:id/flash-sale-request",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }
    const [existing] = await sql`select * from products where id = ${req.params.id} limit 1`;
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (String(existing.seller_id) !== String(req.userId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (String(existing.listing_status || "approved") !== "approved") {
      res.status(400).json({ error: "Only approved listings can request flash sale" });
      return;
    }
    if (Boolean(existing.is_flash_sale)) {
      res.status(400).json({ error: "Product is already in flash sale" });
      return;
    }
    if (String(existing.flash_sale_request_status || "") === "pending") {
      res.status(400).json({ error: "Flash sale request is already pending" });
      return;
    }

    const salePrice = Number(existing.price);
    let requestedMrp = null;
    if (req.body?.requested_original_price != null && req.body?.requested_original_price !== "") {
      requestedMrp = Number(req.body.requested_original_price);
      if (Number.isNaN(requestedMrp) || requestedMrp <= salePrice) {
        res.status(400).json({ error: "Suggested MRP must be higher than sale price" });
        return;
      }
    }

    const notesRaw = req.body?.notes != null ? String(req.body.notes).trim().slice(0, 500) : null;
    const now = new Date().toISOString();

    const [updated] = await sql`
      update products set
        flash_sale_request_status = 'pending',
        flash_sale_requested_at = ${now},
        flash_sale_requested_original_price = ${requestedMrp},
        flash_sale_request_notes = ${notesRaw || null},
        flash_sale_reviewed_at = null,
        flash_sale_reviewed_by = null,
        flash_sale_review_notes = null,
        updated_at = ${now}
      where id = ${req.params.id}
      returning *
    `;
    invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|`);
    res.json({ data: updated });
  })
);

router.delete(
  "/seller/products/:id/flash-sale-request",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }
    const [existing] = await sql`select * from products where id = ${req.params.id} limit 1`;
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (String(existing.seller_id) !== String(req.userId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (String(existing.flash_sale_request_status || "") !== "pending") {
      res.status(400).json({ error: "No pending flash sale request to cancel" });
      return;
    }

    const now = new Date().toISOString();
    const [updated] = await sql`
      update products set
        flash_sale_request_status = null,
        flash_sale_requested_at = null,
        flash_sale_requested_original_price = null,
        flash_sale_request_notes = null,
        updated_at = ${now}
      where id = ${req.params.id}
      returning *
    `;
    invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|`);
    res.json({ data: updated });
  })
);

router.patch(
  "/admin/products/:id/flash-sale",
  ...adminChain,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }
    const [existing] = await sql`select * from products where id = ${req.params.id} limit 1`;
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (String(existing.listing_status || "approved") !== "approved") {
      res.status(400).json({
        error: "Only approved listings can be added to flash sale. Approve the product first.",
      });
      return;
    }

    const now = new Date().toISOString();
    const action = String(req.body?.action || "").toLowerCase();
    const patch = {};

    if (action === "reject") {
      const reviewNotes =
        req.body?.review_notes != null ? String(req.body.review_notes).trim().slice(0, 2000) : null;
      patch.flash_sale_request_status = "rejected";
      patch.is_flash_sale = false;
      patch.flash_sale_end = null;
      patch.flash_sale_review_notes = reviewNotes || null;
      patch.flash_sale_reviewed_at = now;
      patch.flash_sale_reviewed_by = req.userId;
    } else {
      const enableFlash = Boolean(req.body?.is_flash_sale);

      if (!enableFlash) {
        patch.is_flash_sale = false;
        patch.flash_sale_end = null;
        patch.flash_sale_request_status = null;
        patch.flash_sale_requested_at = null;
        patch.flash_sale_requested_original_price = null;
        patch.flash_sale_request_notes = null;
        patch.flash_sale_reviewed_at = null;
        patch.flash_sale_reviewed_by = null;
        patch.flash_sale_review_notes = null;
      } else {
        const salePrice = Number(existing.price);
        let originalPrice =
          req.body?.original_price != null && req.body?.original_price !== ""
            ? Number(req.body.original_price)
            : existing.flash_sale_requested_original_price != null
              ? Number(existing.flash_sale_requested_original_price)
              : existing.original_price != null
                ? Number(existing.original_price)
                : null;

        if (originalPrice == null || Number.isNaN(originalPrice) || originalPrice <= salePrice) {
          res.status(400).json({
            error: "Flash sale requires original price (MRP) higher than sale price",
          });
          return;
        }

        const endRaw = req.body?.flash_sale_end;
        if (!endRaw) {
          res.status(400).json({ error: "Flash sale end time is required" });
          return;
        }
        const end = new Date(endRaw);
        if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) {
          res.status(400).json({ error: "Flash sale end time must be in the future" });
          return;
        }

        patch.is_flash_sale = true;
        patch.flash_sale_end = end.toISOString();
        patch.original_price = originalPrice;
        patch.flash_sale_request_status = "approved";
        patch.flash_sale_reviewed_at = now;
        patch.flash_sale_reviewed_by = req.userId;
        patch.flash_sale_review_notes = null;
      }
    }

    const [updated] = await sql`
      update products set ${sql(patch)}, updated_at = now()
      where id = ${req.params.id}
      returning *
    `;
    invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|`);
    res.json({ data: updated });
  })
);

router.patch(
  "/admin/products/:id/listing",
  ...adminChain,
  asyncHandler(async (req, res) => {
    try {
      const data = await moderateProductListing({
        productId: req.params.id,
        action: req.body?.action,
        reviewNotes: req.body?.review_notes,
        adminUserId: req.userId,
      });
      invalidateMarketplaceProductsCache();
      res.json({ data });
    } catch (error) {
      if (error instanceof SellerLaneError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/products/:id/reviews",
  requireDatabase,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await listProductReviews(req.params.id, { page, limit });
    res.json({ data });
  })
);

router.get(
  "/products/:id/comments",
  requireDatabase,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await listProductComments(req.params.id, { page, limit });
    res.json({ data });
  })
);

router.post(
  "/products/:id/comments",
  ...userChain,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }
    try {
      const created = await createProductComment({
        userId: req.userId,
        productId: req.params.id,
        body: req.body?.body,
      });
      res.status(201).json({ data: created });
    } catch (error) {
      if (error instanceof ReviewError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/reviews/pending",
  ...userChain,
  asyncHandler(async (req, res) => {
    const productId = req.query.product_id ? String(req.query.product_id).trim() : undefined;
    if (productId && !UUID_RE.test(productId)) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }
    const data = await listPendingReviewables(req.userId, { productId });
    res.json({ data });
  })
);

router.post(
  "/reviews/upload-photo",
  ...userChain,
  asyncHandler(async (req, res) => {
    const fileData = String(req.body?.image || req.body?.file_data || "");
    if (!fileData) {
      res.status(400).json({ error: "image is required" });
      return;
    }
    try {
      const uploaded = await uploadToCloudinary(
        fileData,
        "marketplace/review-photos",
        `review_${req.userId}`,
      );
      res.status(201).json({ data: { url: uploaded.url } });
    } catch (error) {
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("cloudinary is not configured")) {
        res.status(201).json({ data: { url: fileData, storage: "inline_data_url" } });
        return;
      }
      throw error;
    }
  })
);

router.post(
  "/reviews",
  ...userChain,
  asyncHandler(async (req, res) => {
    try {
      const result = await createReview({
        userId: req.userId,
        orderId: String(req.body?.order_id || ""),
        productId: String(req.body?.product_id || ""),
        rating: req.body?.rating,
        comment: req.body?.comment,
        photoUrls: req.body?.photo_urls,
      });
      res.status(201).json({ data: result });
    } catch (error) {
      if (error instanceof ReviewError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/admin/reviews",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const data = await listAdminReviews({ limit: req.query.limit });
    res.json({ data });
  })
);

router.delete(
  "/admin/reviews/:id",
  ...adminChain,
  asyncHandler(async (req, res) => {
    try {
      const data = await adminDeleteReview(req.params.id, req.userId);
      res.json({ data });
    } catch (error) {
      if (error instanceof ReviewError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/admin/product-comments",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const data = await listAdminProductComments({ limit: req.query.limit });
    res.json({ data });
  })
);

router.delete(
  "/admin/product-comments/:id",
  ...adminChain,
  asyncHandler(async (req, res) => {
    try {
      const data = await adminDeleteProductComment(req.params.id, req.userId);
      res.json({ data });
    } catch (error) {
      if (error instanceof ReviewError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/seller/earnings/summary",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    const summary = await computeSellerEarningsSummary(req.userId);
    const historyLimit = Math.min(Math.max(Number(req.query.history_limit) || 30, 1), 100);
    const historyRows = await sql`
      select id, buyer_name, total, status, payment_status, created_at, updated_at
      from orders
      where seller_id = ${req.userId}
        and status = 'delivered'
      order by coalesce(updated_at, created_at) desc
      limit ${historyLimit}
    `;
    const monthlyTrend = await fetchSellerMonthlyTrend(req.userId, 6);
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({
      data: {
        ...summary,
        monthly_trend: monthlyTrend,
        history: historyRows.map((r) => ({
          id: r.id,
          buyer_name: r.buyer_name || "Customer",
          total: sellerPayoutToMoney(r.total || 0),
          status: r.status,
          payment_status: r.payment_status,
          created_at: r.created_at,
          delivered_at: r.updated_at || r.created_at,
        })),
      },
    });
  }),
);

router.get(
  "/seller/earnings/breakdown",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    const data = await fetchSellerEarningsBreakdown(req.userId);
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data });
  }),
);

router.get(
  "/seller/withdrawals",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    const rows = await listSellerWithdrawalsForUser(req.userId);
    res.setHeader("Cache-Control", "private, no-cache");
    res.json({ data: rows });
  }),
);

router.post(
  "/seller/withdrawals",
  ...sellerWriteChain,
  asyncHandler(async (req, res) => {
    const requestAmount = Number(req.body?.request_amount);
    if (!Number.isFinite(requestAmount) || requestAmount <= 0) {
      res.status(400).json({ error: "request_amount must be a positive number" });
      return;
    }
    try {
      const created = await createSellerWithdrawal(
        req.userId,
        requestAmount,
        req.body?.note,
      );
      res.status(201).json({ data: created });
    } catch (error) {
      const status = /** @type {{ status?: number }} */ (error)?.status || 500;
      res.status(status).json({ error: error instanceof Error ? error.message : "Withdrawal failed" });
    }
  }),
);

router.get(
  "/admin/seller-withdrawals",
  ...adminChain,
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const rows = await listAdminSellerWithdrawals(status);
    res.json({ data: rows });
  }),
);

router.get(
  "/admin/seller-withdrawals/:id/details",
  ...adminChain,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid withdrawal id" });
      return;
    }
    const data = await getAdminSellerWithdrawalDetails(req.params.id);
    if (!data) {
      res.status(404).json({ error: "Withdrawal request not found" });
      return;
    }
    res.json({ data });
  }),
);

router.post(
  "/admin/seller-withdrawals/:id/approve",
  ...adminChain,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid withdrawal id" });
      return;
    }
    try {
      const updated = await reviewSellerWithdrawal(
        req.params.id,
        req.userId,
        "approve",
        req.body?.note,
      );
      res.json({ data: updated });
    } catch (error) {
      const status = /** @type {{ status?: number }} */ (error)?.status || 500;
      res.status(status).json({ error: error instanceof Error ? error.message : "Approve failed" });
    }
  }),
);

router.post(
  "/admin/seller-withdrawals/:id/reject",
  ...adminChain,
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(400).json({ error: "Invalid withdrawal id" });
      return;
    }
    try {
      const updated = await reviewSellerWithdrawal(
        req.params.id,
        req.userId,
        "reject",
        req.body?.note,
      );
      res.json({ data: updated });
    } catch (error) {
      const status = /** @type {{ status?: number }} */ (error)?.status || 500;
      res.status(status).json({ error: error instanceof Error ? error.message : "Reject failed" });
    }
  }),
);

export default router;
