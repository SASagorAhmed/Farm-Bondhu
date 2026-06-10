/**
 * Temporary migration bridge: executes allowlisted read/write patterns
 * so the frontend can replace supabase.from(...) with one HTTP client.
 * Tighten/remove this module as routes become explicit REST resources.
 */
import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { upsertShopFromApprovalRequest } from "../../services/shopFromApproval.js";
import { invalidateByPrefix } from "../../services/responseCache.js";
import { ensureConversationAnchorProductShare } from "../../services/chatAnchorProduct.js";
import {
  MarketplaceChatOpenError,
  openMarketplaceConversation,
} from "../../services/marketplaceChatOpen.js";
import {
  CHAT_CONTACT_BLOCKED_MESSAGE,
  getChatSendRestriction,
  recordChatContactViolation,
  scanMarketplaceChatText,
  userHasAdminRole,
} from "../../services/chatContactGuard.js";
import { conversationHasPendingReport } from "../../services/adminModerationReports.js";
import { assertPreviewWriteAllowed, isSuperAdminUser } from "../../services/adminTeam.js";

const MARKETPLACE_CACHE_PREFIX = "marketplace";

function invalidateMarketplaceChatCache(buyerId, sellerId) {
  if (buyerId) invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:${buyerId}|`);
  if (sellerId) invalidateByPrefix(`${MARKETPLACE_CACHE_PREFIX}|u:${sellerId}|`);
}

function isSelfShopConversation(conversation) {
  const buyer = String(conversation?.buyer_id || "").trim().toLowerCase();
  const seller = String(conversation?.seller_id || "").trim().toLowerCase();
  return Boolean(buyer && seller && buyer === seller);
}

const router = Router();

function bad(res, msg, status = 400) {
  res.status(status).json({ error: msg });
}

async function blockPreviewWriteIfNeeded(req, res, action, table) {
  if (!["insert", "update", "delete"].includes(String(action || ""))) return false;
  if (!String(table || "").startsWith("community_")) return false;
  const message = await assertPreviewWriteAllowed(req.userId);
  if (message) {
    bad(res, message, 403);
    return true;
  }
  return false;
}

async function canActOnCommunityContent(uid, ownerUserId) {
  if (ownerUserId === uid) return true;
  return isSuperAdminUser(uid);
}

function canEditCommunityPost(uid, ownerUserId) {
  return ownerUserId === uid;
}

function isCommunityCompatTable(table) {
  const t = String(table || "");
  return t === "community_posts" || t.startsWith("community_");
}

async function isCommunityBlockedUser(userId) {
  if (!isUuid(userId)) return false;
  const [row] = await sql`
    select is_enabled
    from user_capabilities
    where user_id = ${userId}
      and capability_code = 'can_access_community'
      and is_enabled = false
    limit 1
  `;
  return Boolean(row);
}

async function isAdminUser(userId) {
  if (!isUuid(userId)) return false;
  const [row] = await sql`
    select 1 as ok
    from user_roles
    where user_id = ${userId} and role = 'admin'
    limit 1
  `;
  return Boolean(row);
}

async function blockCommunityAccessIfNeeded(req, res, table) {
  if (!isCommunityCompatTable(table)) return false;
  if (await isAdminUser(req.userId)) return false;
  if (!(await isCommunityBlockedUser(req.userId))) return false;
  bad(res, "Your Community access is blocked. Contact support if you think this is a mistake.", 403);
  return true;
}

/** @param {unknown} v */
function isUuid(v) {
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
}

async function insertCommunityNotification({ userId, title, message, actionUrl, priority = "normal" }) {
  if (!isUuid(userId)) return;
  try {
    await sql`
      insert into notifications ${sql({
        user_id: userId,
        type: "community",
        context: "community",
        priority,
        title,
        message,
        link: actionUrl,
        action_url: actionUrl,
        read: false,
        created_at: new Date().toISOString(),
      })}
    `;
  } catch (err) {
    console.error("[community] notification insert failed:", err?.message || err);
  }
}

async function syncCommunityPostCounts(postId) {
  if (!isUuid(postId)) return null;
  const [updated] = await sql`
    update community_posts set
      reaction_count = (select count(*)::int from community_reactions where post_id = ${postId}),
      comment_count = (select count(*)::int from community_comments where post_id = ${postId}),
      answer_count = (select count(*)::int from community_answers where post_id = ${postId}),
      updated_at = now()
    where id = ${postId}
    returning reaction_count, comment_count, answer_count, share_count
  `;
  return updated || null;
}

async function syncCommunityCommentReactionCount(commentId) {
  if (!isUuid(commentId)) return null;
  const [updated] = await sql`
    update community_comments set
      reaction_count = (select count(*)::int from community_comment_reactions where comment_id = ${commentId}),
      updated_at = now()
    where id = ${commentId}
    returning reaction_count
  `;
  return updated || null;
}

async function notifyCommunityPostOwner({ post, actorId, title, message, actionUrl }) {
  if (!post?.user_id || post.user_id === actorId) return;
  await insertCommunityNotification({
    userId: post.user_id,
    title,
    message,
    actionUrl,
  });
}

router.post(
  "/",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const { action, table } = body;
    const uid = req.userId;

    if (await blockPreviewWriteIfNeeded(req, res, action, table)) return;
    if (await blockCommunityAccessIfNeeded(req, res, table)) return;

    if (action === "select" && table === "profiles" && body.id) {
      if (!isUuid(body.id)) return bad(res, "Invalid id");
      const [row] = await sql`
        select * from profiles where id = ${body.id} limit 1
      `;
      return res.json({ data: row || null, error: null });
    }

    if (action === "select" && table === "profiles" && Array.isArray(body.ids)) {
      const ids = body.ids.filter(isUuid);
      if (!ids.length) return res.json({ data: [], error: null });
      const rows = await sql`select * from profiles where id in ${sql(ids)}`;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "user_roles" && body.user_id === uid) {
      const rows = await sql`select role from user_roles where user_id = ${uid}`;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "role_permissions" && Array.isArray(body.roles)) {
      const roles = body.roles.filter((r) => typeof r === "string");
      if (!roles.length) return res.json({ data: [], error: null });
      const rows = await sql`
        select permission_code from role_permissions where role in ${sql(roles)}
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "user_capabilities" && body.user_id === uid) {
      const rows = await sql`
        select user_id, capability_code, is_enabled from user_capabilities where user_id = ${uid}
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "upsert" && table === "user_capabilities") {
      const rows = Array.isArray(body.rows)
        ? body.rows
        : body.row
          ? [body.row]
          : [];
      if (!rows.length) return bad(res, "No rows supplied");

      const SAFE_SELF_TOGGLE = new Set([
        "can_manage_farm",
        "can_book_vet",
        "can_book_human",
        "can_sell",
        "can_bulk_buy",
        "can_buy",
        "can_access_learning",
        "can_access_community",
      ]);

      const [profileRow] = await sql`select primary_role from profiles where id = ${uid} limit 1`;
      const primaryRole = String(profileRow?.primary_role || "");
      const userRoleRows = await sql`select role from user_roles where user_id = ${uid}`;
      const userRoleSet = new Set(userRoleRows.map((r) => String(r.role)));

      for (const row of rows) {
        if (!isUuid(row?.user_id) || String(row.user_id) !== uid) {
          return bad(res, "Cannot change another user's capabilities", 403);
        }
        const capabilityCode = String(row?.capability_code || "");
        if (!SAFE_SELF_TOGGLE.has(capabilityCode)) {
          return bad(res, "Capability cannot be changed here", 403);
        }

        const [roleGrant] = await sql`
          select 1 as ok
          from user_roles ur
          join role_permissions rp on rp.role = ur.role
          where ur.user_id = ${uid} and rp.permission_code = ${capabilityCode}
          limit 1
        `;
        const [existingOverride] = await sql`
          select is_enabled, granted_by
          from user_capabilities
          where user_id = ${uid} and capability_code = ${capabilityCode}
          limit 1
        `;
        if (
          capabilityCode === "can_access_community" &&
          Boolean(row?.is_enabled) &&
          existingOverride &&
          existingOverride.is_enabled === false &&
          existingOverride.granted_by &&
          existingOverride.granted_by !== uid
        ) {
          return bad(res, "Community access is blocked by an admin", 403);
        }
        /** Farmer/buyer may self-toggle MediBondhu even if `user_roles` is empty (profile.primary_role still farmer). */
        const implicitHumanBookOk =
          capabilityCode === "can_book_human" &&
          (primaryRole === "farmer" ||
            primaryRole === "buyer" ||
            userRoleSet.has("farmer") ||
            userRoleSet.has("buyer"));
        if (!roleGrant && !existingOverride && !implicitHumanBookOk) {
          return bad(res, "Capability not available for this user", 403);
        }

        await sql`
          delete from user_capabilities
          where user_id = ${uid} and capability_code = ${capabilityCode}
        `;
        await sql`
          insert into user_capabilities ${sql({
            user_id: uid,
            capability_code: capabilityCode,
            is_enabled: Boolean(row?.is_enabled),
          })}
        `;
      }
      return res.json({ data: null, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "active_latest") {
      const rows = await sql`
        select p.*, coalesce(author.name, 'User') as author_name, author.primary_role as author_role
        from community_posts p
        left join profiles author on author.id = p.user_id
        where p.status = 'active'
        order by p.created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "active_category") {
      const cat = String(body.category || "");
      const rows = await sql`
        select p.*, coalesce(author.name, 'User') as author_name, author.primary_role as author_role
        from community_posts p
        left join profiles author on author.id = p.user_id
        where p.status = 'active' and p.category = ${cat}
        order by p.created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "urgent") {
      const rows = await sql`
        select p.*, coalesce(author.name, 'User') as author_name, author.primary_role as author_role
        from community_posts p
        left join profiles author on author.id = p.user_id
        where p.status = 'active' and p.priority in ('urgent', 'expert_needed')
        order by p.created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "unanswered") {
      const rows = await sql`
        select p.*, coalesce(author.name, 'User') as author_name, author.primary_role as author_role
        from community_posts p
        left join profiles author on author.id = p.user_id
        where p.status = 'active'
          and p.post_type in ('question', 'help_request')
          and p.answer_count = 0
        order by p.created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "by_user") {
      const rows = await sql`
        select p.*, coalesce(author.name, 'User') as author_name, author.primary_role as author_role
        from community_posts p
        left join profiles author on author.id = p.user_id
        where p.user_id = ${uid}
        order by p.created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "by_id") {
      if (!isUuid(body.id)) return bad(res, "Invalid id");
      const [row] = await sql`
        select p.*, coalesce(author.name, 'User') as author_name, author.primary_role as author_role
        from community_posts p
        left join profiles author on author.id = p.user_id
        where p.id = ${body.id}
        limit 1
      `;
      return res.json({ data: row || null, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "by_ids") {
      const ids = (body.ids || []).filter(isUuid);
      if (!ids.length) return res.json({ data: [], error: null });
      const rows = await sql`
        select p.*, coalesce(author.name, 'User') as author_name, author.primary_role as author_role
        from community_posts p
        left join profiles author on author.id = p.user_id
        where p.id in ${sql(ids)}
        order by p.created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_saves" && body.user_id === uid) {
      const rows = await sql`
        select post_id from community_saves where user_id = ${uid}
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_comments" && isUuid(body.post_id)) {
      const rows = await sql`
        select
          c.*,
          coalesce(author.name, 'User') as author_name,
          author.primary_role as author_role,
          (select count(*)::int from community_comments r where r.parent_id = c.id) as reply_count,
          exists(select 1 from community_comment_reactions cr where cr.comment_id = c.id and cr.user_id = ${uid}) as has_reacted
        from community_comments c
        left join profiles author on author.id = c.user_id
        where c.post_id = ${body.post_id}
        order by c.created_at asc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_comment_reactions" && isUuid(body.comment_id)) {
      const [row] = await sql`
        select id from community_comment_reactions
        where comment_id = ${body.comment_id} and user_id = ${uid}
        limit 1
      `;
      return res.json({ data: row, error: null });
    }

    if (action === "select" && table === "community_answers" && isUuid(body.post_id)) {
      const rows = await sql`
        select * from community_answers
        where post_id = ${body.post_id}
        order by is_best_answer desc, upvote_count desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_reactions" && isUuid(body.post_id)) {
      const [row] = await sql`
        select id from community_reactions
        where post_id = ${body.post_id} and user_id = ${uid}
        limit 1
      `;
      return res.json({ data: row, error: null });
    }

    if (action === "select" && table === "community_saves" && isUuid(body.post_id)) {
      const [row] = await sql`
        select id from community_saves where post_id = ${body.post_id} and user_id = ${uid} limit 1
      `;
      return res.json({ data: row, error: null });
    }

    if (action === "select" && table === "community_activity_log") {
      const actionType = String(body.action_type || "all");
      const allowed = new Set(["post", "comment", "answer", "reaction", "save"]);
      const limit = Math.min(Math.max(Number.parseInt(String(body.limit || "200"), 10) || 200, 1), 300);
      const rows = await sql`
        with activity as (
          select id, 'post'::text as action_type, id as post_id, id as target_id, created_at
          from community_posts
          where user_id = ${uid}
          union all
          select id, 'comment'::text as action_type, post_id, id as target_id, created_at
          from community_comments
          where user_id = ${uid}
          union all
          select id, 'answer'::text as action_type, post_id, id as target_id, created_at
          from community_answers
          where user_id = ${uid}
          union all
          select id, 'reaction'::text as action_type, post_id, id as target_id, created_at
          from community_reactions
          where user_id = ${uid}
          union all
          select id, 'save'::text as action_type, post_id, id as target_id, created_at
          from community_saves
          where user_id = ${uid}
        )
        select *
        from activity
        where ${allowed.has(actionType) ? sql`action_type = ${actionType}` : sql`true`}
        order by created_at desc
        limit ${limit}
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "vets" && body.mode === "all") {
      const rows = await sql`select * from vets order by created_at desc`;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "vets" && body.mode === "by_id") {
      if (!isUuid(body.id)) return bad(res, "Invalid id");
      const [row] = await sql`select * from vets where id = ${body.id} limit 1`;
      return res.json({ data: row || null, error: null });
    }

    if (action === "select" && table === "consultation_bookings" && body.mode === "patient") {
      const rows = await sql`
        select * from consultation_bookings
        where patient_mock_id = ${uid}
        order by created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "consultation_bookings" && body.mode === "by_id") {
      if (!isUuid(body.id)) return bad(res, "Invalid id");
      const [row] = await sql`select * from consultation_bookings where id = ${body.id} limit 1`;
      return res.json({ data: row || null, error: null });
    }

    if (action === "select" && table === "consultation_messages" && isUuid(body.booking_id)) {
      const rows = await sql`
        select * from consultation_messages where booking_id = ${body.booking_id} order by created_at asc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "e_prescriptions" && body.mode === "patient") {
      const rows = await sql`
        select * from e_prescriptions
        where patient_mock_id = ${uid}
        order by created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "insert" && table === "community_posts") {
      const row = body.row || {};
      const [created] = await sql`
        insert into community_posts ${sql({ ...row, user_id: uid })}
        returning *
      `;
      return res.json({ data: created, error: null });
    }

    if (action === "update" && table === "community_posts" && isUuid(body.id)) {
      const patch = body.patch || {};
      const metaKeys = ["reaction_count", "comment_count", "answer_count", "share_count"];
      const metaOnly = Object.keys(patch).every((k) => metaKeys.includes(k));
      if (metaOnly) {
        const [exists] = await sql`
          select id from community_posts where id = ${body.id} limit 1
        `;
        if (!exists) return res.json({ data: null, error: { message: "Not found" } });
        const safe = {};
        for (const k of metaKeys) {
          if (patch[k] !== undefined) safe[k] = patch[k];
        }
        const [updated] = await sql`
          update community_posts set ${sql(safe)} where id = ${body.id} returning *
        `;
        return res.json({ data: updated, error: null });
      }
      const [owner] = await sql`
        select user_id from community_posts where id = ${body.id} limit 1
      `;
      if (!owner) return res.json({ data: null, error: { message: "Not found" } });
      if (!canEditCommunityPost(uid, owner.user_id)) return bad(res, "Forbidden", 403);
      const [updated] = await sql`
        update community_posts set ${sql(patch)} where id = ${body.id} returning *
      `;
      return res.json({ data: updated, error: null });
    }

    if (action === "delete" && table === "community_posts" && isUuid(body.id)) {
      const [owner] = await sql`
        select user_id from community_posts where id = ${body.id} limit 1
      `;
      if (!owner) return res.json({ data: null, error: { message: "Not found" } });
      if (!(await canActOnCommunityContent(uid, owner.user_id))) return bad(res, "Forbidden", 403);
      await sql`delete from community_posts where id = ${body.id}`;
      return res.json({ data: null, error: null });
    }

    if (action === "insert" && table === "community_comments" && isUuid(body.post_id)) {
      const text = String(body.body || "").trim();
      if (!text) return bad(res, "body required");
      const parentId = isUuid(body.parent_id) ? body.parent_id : null;
      const [post] = await sql`
        select id, user_id, title
        from community_posts
        where id = ${body.post_id}
        limit 1
      `;
      if (!post) return bad(res, "Post not found", 404);
      let parent = null;
      if (parentId) {
        [parent] = await sql`
          select id, user_id, parent_id, body
          from community_comments
          where id = ${parentId} and post_id = ${body.post_id}
          limit 1
        `;
        if (!parent) return bad(res, "Parent comment not found", 404);
      }
      const [created] = await sql`
        insert into community_comments ${sql({
          post_id: body.post_id,
          user_id: uid,
          parent_id: parentId,
          body: text,
        })}
        returning *
      `;
      const counts = await syncCommunityPostCounts(body.post_id);
      const actionUrl = `/community/post/${body.post_id}#comments`;
      await notifyCommunityPostOwner({
        post,
        actorId: uid,
        title: parent ? "New reply on your post" : "New comment on your post",
        message: text.slice(0, 120),
        actionUrl,
      });
      if (parent) {
        const notified = new Set([uid, post.user_id]);
        if (parent.user_id && !notified.has(parent.user_id)) {
          await insertCommunityNotification({
            userId: parent.user_id,
            title: "New reply to your comment",
            message: text.slice(0, 120),
            actionUrl,
          });
          notified.add(parent.user_id);
        }
        if (parent.parent_id) {
          const [root] = await sql`
            select id, user_id
            from community_comments
            where id = ${parent.parent_id}
            limit 1
          `;
          if (root?.user_id && !notified.has(root.user_id)) {
            await insertCommunityNotification({
              userId: root.user_id,
              title: "New reply in your comment thread",
              message: text.slice(0, 120),
              actionUrl,
            });
          }
        }
      }
      return res.json({ data: { ...created, post_counts: counts }, error: null });
    }

    if (action === "insert" && table === "community_answers" && isUuid(body.post_id)) {
      const text = String(body.body || "").trim();
      if (!text) return bad(res, "body required");
      const [post] = await sql`
        select id, user_id, title
        from community_posts
        where id = ${body.post_id}
        limit 1
      `;
      if (!post) return bad(res, "Post not found", 404);
      const [created] = await sql`
        insert into community_answers ${sql({
          post_id: body.post_id,
          user_id: uid,
          body: text,
        })}
        returning *
      `;
      const counts = await syncCommunityPostCounts(body.post_id);
      await notifyCommunityPostOwner({
        post,
        actorId: uid,
        title: "New answer on your question",
        message: text.slice(0, 120),
        actionUrl: `/community/post/${body.post_id}`,
      });
      return res.json({ data: { ...created, post_counts: counts }, error: null });
    }

    if (action === "insert" && table === "community_reactions" && isUuid(body.post_id)) {
      const [post] = await sql`
        select id, user_id, title
        from community_posts
        where id = ${body.post_id}
        limit 1
      `;
      if (!post) return bad(res, "Post not found", 404);
      const [ex] = await sql`
        select id from community_reactions where post_id = ${body.post_id} and user_id = ${uid} limit 1
      `;
      if (!ex) {
        await sql`
          insert into community_reactions ${sql({ post_id: body.post_id, user_id: uid })}
        `;
        await notifyCommunityPostOwner({
          post,
          actorId: uid,
          title: "New reaction on your post",
          message: "Someone reacted to your Community post.",
          actionUrl: `/community/post/${body.post_id}`,
        });
      }
      const counts = await syncCommunityPostCounts(body.post_id);
      return res.json({ data: { post_counts: counts }, error: null });
    }

    if (action === "delete" && table === "community_reactions" && isUuid(body.post_id)) {
      await sql`
        delete from community_reactions where post_id = ${body.post_id} and user_id = ${uid}
      `;
      const counts = await syncCommunityPostCounts(body.post_id);
      return res.json({ data: { post_counts: counts }, error: null });
    }

    if (action === "insert" && table === "community_comment_reactions" && isUuid(body.comment_id)) {
      const [comment] = await sql`
        select c.id, c.post_id, c.user_id, c.body, p.user_id as post_owner_id
        from community_comments c
        join community_posts p on p.id = c.post_id
        where c.id = ${body.comment_id}
        limit 1
      `;
      if (!comment) return bad(res, "Comment not found", 404);
      const [ex] = await sql`
        select id from community_comment_reactions
        where comment_id = ${body.comment_id} and user_id = ${uid}
        limit 1
      `;
      if (!ex) {
        await sql`
          insert into community_comment_reactions ${sql({
            comment_id: body.comment_id,
            post_id: comment.post_id,
            user_id: uid,
          })}
        `;
        const notified = new Set([uid]);
        if (comment.post_owner_id && !notified.has(comment.post_owner_id)) {
          await insertCommunityNotification({
            userId: comment.post_owner_id,
            title: "New reaction in your post comments",
            message: "Someone reacted to a comment on your Community post.",
            actionUrl: `/community/post/${comment.post_id}#comments`,
          });
          notified.add(comment.post_owner_id);
        }
        if (comment.user_id && !notified.has(comment.user_id)) {
          await insertCommunityNotification({
            userId: comment.user_id,
            title: "New reaction on your comment",
            message: "Someone reacted to your Community comment.",
            actionUrl: `/community/post/${comment.post_id}#comments`,
          });
        }
      }
      const counts = await syncCommunityCommentReactionCount(body.comment_id);
      return res.json({ data: { comment_counts: counts }, error: null });
    }

    if (action === "delete" && table === "community_comment_reactions" && isUuid(body.comment_id)) {
      await sql`
        delete from community_comment_reactions
        where comment_id = ${body.comment_id} and user_id = ${uid}
      `;
      const counts = await syncCommunityCommentReactionCount(body.comment_id);
      return res.json({ data: { comment_counts: counts }, error: null });
    }

    if (action === "insert" && table === "community_saves" && isUuid(body.post_id)) {
      const [ex] = await sql`
        select id from community_saves where post_id = ${body.post_id} and user_id = ${uid} limit 1
      `;
      if (!ex) {
        await sql`
          insert into community_saves ${sql({ post_id: body.post_id, user_id: uid })}
        `;
      }
      return res.json({ data: null, error: null });
    }

    if (action === "delete" && table === "community_saves" && isUuid(body.post_id)) {
      await sql`
        delete from community_saves where post_id = ${body.post_id} and user_id = ${uid}
      `;
      return res.json({ data: null, error: null });
    }

    if (action === "insert" && table === "community_reports") {
      const row = body.row || {};
      const [created] = await sql`
        insert into community_reports ${sql({ ...row, reported_by: uid })}
        returning *
      `;
      return res.json({ data: created, error: null });
    }

    if (action === "insert" && table === "approval_requests") {
      const row = body.row || {};
      const [created] = await sql`
        insert into approval_requests ${sql({ ...row, user_id: uid })}
        returning *
      `;
      return res.json({ data: created, error: null });
    }

    if (action === "insert" && table === "consultation_messages" && isUuid(body.booking_id)) {
      const row = body.row || {};
      const [created] = await sql`
        insert into consultation_messages ${sql({
          ...row,
          booking_id: body.booking_id,
          sender_id: uid,
        })}
        returning *
      `;
      return res.json({ data: created, error: null });
    }

    if (action === "insert" && table === "chat_messages" && isUuid(body.conversation_id)) {
      const row = body.row || {};
      const [c] = await sql`
        select buyer_id, seller_id, conversation_kind from conversations where id = ${body.conversation_id} limit 1
      `;
      if (!c) return bad(res, "Conversation not found", 404);
      const isAdmin = await userHasAdminRole(sql, uid);
      const isParticipant = c.buyer_id === uid || c.seller_id === uid;
      if (!isParticipant && !isAdmin) return bad(res, "Forbidden", 403);

      const isSelfChat = isSelfShopConversation(c);
      let senderRole = row.sender_role;
      const messageType = row.message_type || "text";
      if (isAdmin && !isParticipant) {
        const convoKind = String(c.conversation_kind || "marketplace");
        if (convoKind === "marketplace") {
          const hasReport = await conversationHasPendingReport(sql, body.conversation_id);
          if (!hasReport) {
            return bad(res, "Admin cannot reply until a user reports this conversation", 403);
          }
          if (messageType !== "text") {
            return bad(res, "Admin moderation replies must be text only", 400);
          }
          senderRole = "admin";
        } else {
          senderRole = "seller";
        }
      } else if (senderRole !== "buyer" && senderRole !== "seller") {
        if (isSelfChat) return bad(res, "sender_role required for own-shop chat", 400);
        senderRole = uid === c.seller_id ? "seller" : "buyer";
      }

      const textBody = typeof row.text_body === "string" ? row.text_body.trim() : "";

      if (messageType === "text" && textBody && !isAdmin) {
        const restriction = await getChatSendRestriction(sql, uid);
        if (restriction.restrictedUntil && new Date(restriction.restrictedUntil).getTime() > Date.now()) {
          return res.status(429).json({
            error: "Chat sending is temporarily restricted. Please try again later.",
            code: "chat_restricted",
            chat_guard: {
              restricted_until: restriction.restrictedUntil,
              violation_count: restriction.violationCount,
            },
          });
        }

        const scan = scanMarketplaceChatText(textBody);
        if (scan.blocked) {
          const guard = await recordChatContactViolation(sql, {
            userId: uid,
            conversationId: body.conversation_id,
            reason: scan.reason || "contact_guard",
          });
          return res.status(400).json({
            error: CHAT_CONTACT_BLOCKED_MESSAGE,
            code: "contact_guard",
            chat_guard: {
              restricted_until: guard.restrictedUntil,
              violation_count: guard.violationCount,
            },
          });
        }
      }

      const [created] = await sql`
        insert into chat_messages ${sql({
          ...row,
          sender_role: senderRole,
          conversation_id: body.conversation_id,
          sender_id: uid,
        })}
        returning *
      `;
      invalidateMarketplaceChatCache(c.buyer_id, c.seller_id);
      return res.json({ data: created, error: null });
    }

    if (action === "update" && table === "conversations" && isUuid(body.id)) {
      const [c] = await sql`
        select buyer_id, seller_id from conversations where id = ${body.id} limit 1
      `;
      if (!c) return res.json({ data: null, error: { message: "Not found" } });
      const isAdmin = await userHasAdminRole(sql, uid);
      if (c.buyer_id !== uid && c.seller_id !== uid && !isAdmin) return bad(res, "Forbidden", 403);
      const patch = { ...(body.patch || {}) };
      delete patch.conversation_kind;
      delete patch.support_topic;
      delete patch.support_status;
      const [updated] = await sql`
        update conversations set ${sql(patch)} where id = ${body.id} returning *
      `;
      invalidateMarketplaceChatCache(c.buyer_id, c.seller_id);
      return res.json({ data: updated, error: null });
    }

    if (action === "select" && table === "conversations" && body.mode === "find") {
      const { buyer_id: buyerId, seller_id: sellerId, product_id: productId } = body;
      if (!isUuid(buyerId) || !isUuid(sellerId) || !isUuid(productId)) return bad(res, "Invalid ids");
      if (buyerId !== uid) return bad(res, "Forbidden", 403);
      const [row] = await sql`
        select id from conversations
        where buyer_id = ${buyerId}
          and seller_id = ${sellerId}
          and coalesce(conversation_kind, 'marketplace') = 'marketplace'
        order by coalesce(last_message_at, created_at) desc nulls last
        limit 1
      `;
      return res.json({ data: row || null, error: null });
    }

    if (action === "insert" && table === "conversations") {
      const { buyer_id: buyerId, seller_id: sellerId, product_id: productId } = body;
      if (!isUuid(buyerId) || !isUuid(sellerId) || !isUuid(productId)) return bad(res, "Invalid ids");
      if (buyerId !== uid) return bad(res, "Forbidden", 403);
      try {
        const result = await openMarketplaceConversation(sql, { buyerId, sellerId, productId });
        invalidateMarketplaceChatCache(buyerId, sellerId);
        return res.json({ data: result.conversation, error: null });
      } catch (err) {
        if (err instanceof MarketplaceChatOpenError) {
          return bad(res, err.message, err.status);
        }
        throw err;
      }
    }

    if (action === "select" && table === "conversations" && body.mode === "by_id") {
      if (!isUuid(body.id)) return bad(res, "Invalid id");
      const [row] = await sql`select * from conversations where id = ${body.id} limit 1`;
      if (!row) return res.json({ data: null, error: null });
      if (row.buyer_id !== uid && row.seller_id !== uid) return bad(res, "Forbidden", 403);
      return res.json({ data: row, error: null });
    }

    if (action === "select" && table === "conversations" && body.mode === "participant_inbox") {
      const rows = await sql`
        select * from conversations
        where buyer_id = ${uid}
          and coalesce(conversation_kind, 'marketplace') = 'marketplace'
        order by coalesce(last_message_at, created_at) desc nulls last
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "conversations" && body.mode === "seller_inbox") {
      const rows = await sql`
        select * from conversations
        where seller_id = ${uid}
          and coalesce(conversation_kind, 'marketplace') = 'marketplace'
        order by coalesce(last_message_at, created_at) desc nulls last
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "chat_messages" && isUuid(body.conversation_id)) {
      const [c] = await sql`
        select buyer_id, seller_id from conversations where id = ${body.conversation_id} limit 1
      `;
      if (!c) return res.json({ data: [], error: null });
      if (c.buyer_id !== uid && c.seller_id !== uid) return bad(res, "Forbidden", 403);
      const rows = await sql`
        select * from chat_messages where conversation_id = ${body.conversation_id} order by created_at asc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "products" && body.mode === "in_ids") {
      const ids = (body.ids || []).filter(isUuid);
      if (!ids.length) return res.json({ data: [], error: null });
      const rows = await sql`select * from products where id in ${sql(ids)}`;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "products" && body.mode === "seller") {
      const rows = await sql`
        select * from products where seller_id = ${uid} order by created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "shops" && body.mode === "by_seller_user") {
      if (!isUuid(body.user_id)) return bad(res, "Invalid user_id");
      const [row] = await sql`
        select * from shops where user_id = ${body.user_id} limit 1
      `;
      return res.json({ data: row || null, error: null });
    }

    if (action === "select" && table === "shops" && body.mode === "in_seller_ids") {
      const ids = (body.ids || []).filter(isUuid);
      if (!ids.length) return res.json({ data: [], error: null });
      const rows = await sql`
        select user_id, shop_name from shops where user_id in ${sql(ids)}
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "vet_availability" && body.user_id === uid) {
      const rows = await sql`
        select * from vet_availability where user_id = ${uid} order by created_at asc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "delete" && table === "vet_availability" && isUuid(body.id)) {
      await sql`delete from vet_availability where id = ${body.id} and user_id = ${uid}`;
      return res.json({ data: null, error: null });
    }

    if (action === "delete" && table === "vet_availability" && body.mode === "clear_user") {
      await sql`delete from vet_availability where user_id = ${uid}`;
      return res.json({ data: null, error: null });
    }

    if (action === "insert" && table === "vet_availability" && Array.isArray(body.rows)) {
      for (const r of body.rows) {
        await sql`insert into vet_availability ${sql({ ...r, user_id: uid })}`;
      }
      return res.json({ data: null, error: null });
    }

    if (action === "select" && table === "consultation_bookings" && body.mode === "vet_pending") {
      const rows = await sql`
        select * from consultation_bookings where status = 'pending' order by created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "consultation_bookings" && body.mode === "vet_today") {
      const day = String(body.day || new Date().toISOString().slice(0, 10));
      const start = `${day}T00:00:00`;
      const rows = await sql`
        select * from consultation_bookings
        where status in ('in_progress', 'completed') and created_at >= ${start}
        order by created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "update" && table === "consultation_bookings" && isUuid(body.id)) {
      const patch = body.patch || {};
      const [updated] = await sql`
        update consultation_bookings set ${sql(patch)} where id = ${body.id} returning *
      `;
      return res.json({ data: updated || null, error: null });
    }

    if (action === "insert" && table === "consultation_bookings") {
      const row = body.row || {};
      const [created] = await sql`
        insert into consultation_bookings ${sql(row)}
        returning *
      `;
      return res.json({ data: created, error: null });
    }

    if (action === "update" && table === "community_comments" && isUuid(body.id)) {
      const [r] = await sql`
        select user_id from community_comments where id = ${body.id} limit 1
      `;
      if (!r) return res.json({ data: null, error: { message: "Not found" } });
      if (!(await canActOnCommunityContent(uid, r.user_id))) return bad(res, "Forbidden", 403);
      const patch = body.patch || {};
      const [updated] = await sql`
        update community_comments set ${sql(patch)} where id = ${body.id} returning *
      `;
      return res.json({ data: updated, error: null });
    }

    if (action === "delete" && table === "community_comments" && isUuid(body.id)) {
      const [r] = await sql`
        select user_id, post_id from community_comments where id = ${body.id} limit 1
      `;
      if (!r) return res.json({ data: null, error: null });
      if (!(await canActOnCommunityContent(uid, r.user_id))) return bad(res, "Forbidden", 403);
      await sql`
        delete from community_comments
        where id = ${body.id} or parent_id = ${body.id}
      `;
      const counts = await syncCommunityPostCounts(r.post_id);
      return res.json({ data: { post_counts: counts }, error: null });
    }

    if (action === "update" && table === "community_answers" && isUuid(body.id)) {
      const [r] = await sql`
        select user_id from community_answers where id = ${body.id} limit 1
      `;
      if (!r) return res.json({ data: null, error: { message: "Not found" } });
      if (!(await canActOnCommunityContent(uid, r.user_id))) return bad(res, "Forbidden", 403);
      const patch = body.patch || {};
      const [updated] = await sql`
        update community_answers set ${sql(patch)} where id = ${body.id} returning *
      `;
      return res.json({ data: updated, error: null });
    }

    if (action === "delete" && table === "community_answers" && isUuid(body.id)) {
      const [r] = await sql`
        select user_id, post_id from community_answers where id = ${body.id} limit 1
      `;
      if (!r) return res.json({ data: null, error: null });
      if (!(await canActOnCommunityContent(uid, r.user_id))) return bad(res, "Forbidden", 403);
      await sql`delete from community_answers where id = ${body.id}`;
      const counts = await syncCommunityPostCounts(r.post_id);
      return res.json({ data: { post_counts: counts }, error: null });
    }

    if (action === "update" && table === "community_answers" && body.mode === "clear_best" && isUuid(body.post_id)) {
      await sql`
        update community_answers set is_best_answer = false where post_id = ${body.post_id}
      `;
      return res.json({ data: null, error: null });
    }

    if (action === "update" && table === "community_answers" && body.mode === "set_best" && isUuid(body.id)) {
      const [updated] = await sql`
        update community_answers set is_best_answer = true where id = ${body.id} returning *
      `;
      return res.json({ data: updated, error: null });
    }

    if (action === "select" && table === "prescriptions" && body.mode === "by_id") {
      if (!isUuid(body.id)) return bad(res, "Invalid id");
      const [row] = await sql`select * from prescriptions where id = ${body.id} limit 1`;
      return res.json({ data: row || null, error: null });
    }

    if (action === "select" && table === "prescription_items" && isUuid(body.prescription_id)) {
      const rows = await sql`
        select * from prescription_items where prescription_id = ${body.prescription_id} order by created_at asc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "simple_user_select" && body.user_id === uid) {
      const t = table;
      let rows;
      switch (t) {
        case "approval_requests":
          rows = await sql`
            select * from approval_requests where user_id = ${uid} order by created_at desc
          `;
          break;
        case "notifications":
          rows = await sql`
            select * from notifications where user_id = ${uid} order by created_at desc
          `;
          break;
        case "admin_team":
          rows = await sql`
            select * from admin_team order by created_at desc limit 500
          `;
          break;
        default:
          rows = null;
      }
      if (rows !== null) return res.json({ data: rows, error: null });
    }

    return bad(res, `compat: unsupported action/table: ${action} ${table}`, 501);
  })
);

router.post(
  "/admin",
  requireDatabase,
  requireUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const { action, table } = body;

    if (action === "select" && table === "profiles" && body.mode === "all_admin") {
      const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 1000);
      const rows = await sql`
        select id, email, name, primary_role, phone, location, avatar_url, created_at, updated_at
        from profiles
        order by created_at desc
        limit ${limit}
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "count" && table === "profiles" && body.mode === "head") {
      const [{ count }] = await sql`select count(*)::int as count from profiles`;
      return res.json({ count: count ?? 0, error: null });
    }

    if (action === "count" && table === "approval_requests" && body.mode === "pending_head") {
      const [{ count }] = await sql`
        select count(*)::int as count from approval_requests where status = 'pending'
      `;
      return res.json({ count: count ?? 0, error: null });
    }

    if (action === "select" && table === "user_roles" && body.mode === "all_roles") {
      const rows = await sql`select role from user_roles`;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "user_roles" && body.mode === "list") {
      const rows = await sql`select user_id, role, created_at from user_roles order by created_at desc`;
      return res.json({ data: rows, error: null });
    }

    if (action === "insert" && table === "user_roles" && isUuid(body.user_id) && typeof body.role === "string") {
      const role = String(body.role).trim().toLowerCase();
      if (!role) return bad(res, "Invalid role");
      const [created] = await sql`
        insert into user_roles ${sql({ user_id: body.user_id, role })}
        on conflict (user_id, role) do nothing
        returning *
      `;
      return res.json({ data: created || null, error: null });
    }

    if (action === "delete" && table === "user_roles" && isUuid(body.user_id) && typeof body.role === "string") {
      const role = String(body.role).trim().toLowerCase();
      await sql`delete from user_roles where user_id = ${body.user_id} and role = ${role}`;
      return res.json({ data: null, error: null });
    }

    if (action === "select" && table === "user_capabilities" && body.mode === "list") {
      const rows = await sql`
        select user_id, capability_code, is_enabled, granted_by, created_at
        from user_capabilities
        order by created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (
      action === "select" &&
      ((table === "community_blocks" && body.mode === "blocked_users") || table === "community_blocked_users")
    ) {
      const rows = await sql`
        select
          p.id as user_id,
          p.name,
          p.email,
          p.primary_role,
          p.signup_module,
          p.avatar_url,
          c.created_at as blocked_at,
          c.granted_by as blocked_by
        from user_capabilities c
        join profiles p on p.id = c.user_id
        where c.capability_code = 'can_access_community'
          and c.is_enabled = false
        order by c.created_at desc
        limit 500
      `;
      return res.json({ data: rows, error: null });
    }

    if (
      action === "select" &&
      ((table === "community_users" && body.mode === "admin_all") || table === "community_users")
    ) {
      const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 1000);
      const rows = await sql`
        with community_activity as (
          select user_id, count(*)::int as post_count, 0::int as comment_count, 0::int as answer_count, 0::int as report_count, max(created_at) as latest_activity_at
          from community_posts
          group by user_id
          union all
          select user_id, 0::int as post_count, count(*)::int as comment_count, 0::int as answer_count, 0::int as report_count, max(created_at) as latest_activity_at
          from community_comments
          group by user_id
          union all
          select user_id, 0::int as post_count, 0::int as comment_count, count(*)::int as answer_count, 0::int as report_count, max(created_at) as latest_activity_at
          from community_answers
          group by user_id
          union all
          select reported_by as user_id, 0::int as post_count, 0::int as comment_count, 0::int as answer_count, count(*)::int as report_count, max(created_at) as latest_activity_at
          from community_reports
          where reported_by is not null
          group by reported_by
          union all
          select user_id, 0::int as post_count, 0::int as comment_count, 0::int as answer_count, 0::int as report_count, max(created_at) as latest_activity_at
          from user_capabilities
          where capability_code = 'can_access_community'
          group by user_id
        ),
        community_user_rollup as (
          select
            user_id,
            sum(coalesce(post_count, 0))::int as post_count,
            sum(coalesce(comment_count, 0))::int as comment_count,
            sum(coalesce(answer_count, 0))::int as answer_count,
            sum(coalesce(report_count, 0))::int as report_count,
            max(latest_activity_at) as latest_activity_at
          from community_activity
          where user_id is not null
          group by user_id
        )
        select
          p.id as user_id,
          p.name,
          p.email,
          p.primary_role,
          p.signup_module,
          p.avatar_url,
          coalesce(r.post_count, 0)::int as post_count,
          coalesce(r.comment_count, 0)::int as comment_count,
          coalesce(r.answer_count, 0)::int as answer_count,
          coalesce(r.report_count, 0)::int as report_count,
          r.latest_activity_at,
          c.created_at as blocked_at,
          c.granted_by as blocked_by,
          coalesce(c.is_enabled = false, false) as is_community_blocked
        from community_user_rollup r
        join profiles p on p.id = r.user_id
        left join user_capabilities c
          on c.user_id = p.id
         and c.capability_code = 'can_access_community'
        order by coalesce(c.is_enabled = false, false) desc, r.latest_activity_at desc nulls last, p.created_at desc
        limit ${limit}
      `;
      return res.json({ data: rows, error: null });
    }

    if (
      action === "community_block_user" ||
      (action === "update" && table === "community_blocks" && body.mode === "block")
    ) {
      const targetUserId = body.user_id || body.target_user_id;
      if (!isUuid(targetUserId)) return bad(res, "Invalid user id");
      if (targetUserId === req.userId) return bad(res, "You cannot block yourself from Community");
      const [profile] = await sql`select id from profiles where id = ${targetUserId} limit 1`;
      if (!profile) return bad(res, "User not found", 404);
      const [row] = await sql`
        insert into user_capabilities ${sql({
          user_id: targetUserId,
          capability_code: "can_access_community",
          is_enabled: false,
          granted_by: req.userId,
          created_at: new Date().toISOString(),
        })}
        on conflict (user_id, capability_code) do update set
          is_enabled = false,
          granted_by = ${req.userId},
          created_at = excluded.created_at
        returning user_id, capability_code, is_enabled, granted_by, created_at
      `;
      return res.json({ data: row, error: null });
    }

    if (
      action === "community_unblock_user" ||
      (action === "update" && table === "community_blocks" && body.mode === "unblock")
    ) {
      const targetUserId = body.user_id || body.target_user_id;
      if (!isUuid(targetUserId)) return bad(res, "Invalid user id");
      const [profile] = await sql`select id from profiles where id = ${targetUserId} limit 1`;
      if (!profile) return bad(res, "User not found", 404);
      const [row] = await sql`
        insert into user_capabilities ${sql({
          user_id: targetUserId,
          capability_code: "can_access_community",
          is_enabled: true,
          granted_by: req.userId,
          created_at: new Date().toISOString(),
        })}
        on conflict (user_id, capability_code) do update set
          is_enabled = true,
          granted_by = ${req.userId}
        returning user_id, capability_code, is_enabled, granted_by, created_at
      `;
      return res.json({ data: row, error: null });
    }

    if (action === "select" && table === "role_permissions" && body.mode === "permissions_list") {
      const rows = await sql`
        select distinct permission_code as code, null::text as description
        from role_permissions
        order by permission_code asc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "approval_requests" && body.mode === "recent") {
      const rows = await sql`
        select * from approval_requests order by created_at desc limit 10
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "approval_requests" && body.mode === "list") {
      const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 1000);
      const ascending = Boolean(body.ascending);
      const sort = ascending ? sql`asc` : sql`desc`;
      const rows = await sql`
        select * from approval_requests
        where (${isUuid(body.id) ? sql`id = ${body.id}` : sql`true`})
          and (${typeof body.status === "string" && body.status ? sql`status = ${body.status}` : sql`true`})
          and (${typeof body.request_type === "string" && body.request_type ? sql`request_type = ${body.request_type}` : sql`true`})
          and (${isUuid(body.user_id) ? sql`user_id = ${body.user_id}` : sql`true`})
        order by created_at ${sort}
        limit ${limit}
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "update" && table === "approval_requests" && isUuid(body.id)) {
      const patch = body.patch && typeof body.patch === "object" ? { ...body.patch } : {};
      if ("details" in patch && !("payload" in patch)) patch.payload = patch.details;
      if ("review_notes" in patch && !("notes" in patch)) patch.notes = patch.review_notes;
      delete patch.details;
      delete patch.review_notes;
      patch.updated_at = new Date().toISOString();
      const [updated] = await sql`
        update approval_requests
        set ${sql(patch)}
        where id = ${body.id}
        returning *
      `;
      if (updated?.status === "approved" && updated?.request_type === "shop_access") {
        await upsertShopFromApprovalRequest(sql, updated);
      }
      return res.json({ data: updated || null, error: null });
    }

    if (action === "select" && table === "farms" && body.mode === "all_admin") {
      const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 1000);
      const rows = await sql`select * from farms order by created_at desc limit ${limit}`;
      return res.json({ data: rows, error: null });
    }

    if (action === "update" && table === "profiles" && isUuid(body.id) && body.patch && typeof body.patch === "object") {
      const patchIn = body.patch || {};
      const patch = {};
      for (const key of ["name", "phone", "location", "avatar_url", "primary_role", "status"]) {
        if (patchIn[key] !== undefined) patch[key] = patchIn[key];
      }
      patch.updated_at = new Date().toISOString();
      const [updated] = await sql`
        update profiles
        set ${sql(patch)}
        where id = ${body.id}
        returning *
      `;
      return res.json({ data: updated || null, error: null });
    }

    if (action === "select" && table === "animals" && body.mode === "all_admin_limited") {
      const rows = await sql`
        select * from animals order by created_at desc limit 200
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "orders" && body.mode === "admin_recent") {
      const rows = await sql`
        select * from orders order by created_at desc limit 200
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "products" && body.mode === "admin_all") {
      const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 1000);
      const rows = await sql`
        select * from products order by created_at desc limit ${limit}
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "shops" && body.mode === "admin_all") {
      const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 1000);
      const rows = await sql`
        select * from shops order by created_at desc limit ${limit}
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "admin_all") {
      const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 1000);
      const rows = await sql`
        select * from community_posts order by created_at desc limit ${limit}
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_reports" && body.mode === "admin_all") {
      const limit = Math.min(Math.max(Number(body.limit) || 300, 1), 1000);
      const rows = await sql`
        select * from community_reports order by created_at desc limit ${limit}
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "conversations" && body.mode === "admin_all") {
      const limit = Math.min(Math.max(Number(body.limit) || 300, 1), 1000);
      const rows = await sql`
        select * from conversations
        order by coalesce(last_message_at, created_at) desc nulls last
        limit ${limit}
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "update" && table === "community_posts" && body.mode === "admin_moderate") {
      if (!isUuid(body.id)) return bad(res, "Invalid id");
      const patch = body.patch || {};
      const [updated] = await sql`
        update community_posts set ${sql(patch)} where id = ${body.id} returning *
      `;
      return res.json({ data: updated, error: null });
    }

    if (action === "update" && table === "community_reports" && body.mode === "resolve") {
      if (!isUuid(body.id)) return bad(res, "Invalid id");
      const [updated] = await sql`
        update community_reports set status = 'resolved' where id = ${body.id} returning *
      `;
      return res.json({ data: updated, error: null });
    }

    if (action === "upsert" && table === "user_roles" && Array.isArray(body.rows)) {
      for (const row of body.rows) {
        await sql`
          delete from user_roles where user_id = ${row.user_id} and role = ${row.role}
        `;
        await sql`insert into user_roles ${sql(row)}`;
      }
      return res.json({ data: null, error: null });
    }

    if (action === "upsert" && table === "user_capabilities") {
      const rows = Array.isArray(body.rows)
        ? body.rows
        : body.row
          ? [body.row]
          : [];
      for (const row of rows) {
        await sql`
          delete from user_capabilities
          where user_id = ${row.user_id} and capability_code = ${row.capability_code}
        `;
        await sql`insert into user_capabilities ${sql(row)}`;
      }
      return res.json({ data: null, error: null });
    }

    if (action === "select" && table === "admin_team" && body.mode === "list") {
      const rows = await sql`
        select * from admin_team order by created_at asc limit 500
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "insert" && table === "admin_team" && body.row && isUuid(body.row.user_id)) {
      const r = body.row;
      const level = String(r.admin_level || "co_admin");
      if (!["super_admin", "co_admin", "moderator"].includes(level)) return bad(res, "Invalid admin_level");
      const [p] = await sql`select name, email from profiles where id = ${r.user_id} limit 1`;
      if (!p) return bad(res, "User not found", 404);
      const addedBy = r.added_by != null && isUuid(r.added_by) ? r.added_by : null;
      const perms =
        r.permissions && typeof r.permissions === "object" && !Array.isArray(r.permissions) ? r.permissions : {};
      await sql`
        insert into admin_team (user_id, name, email, admin_level, admin_role, added_by, permissions, created_at, updated_at)
        values (${r.user_id}, ${p.name}, ${p.email}, ${level}, ${level}, ${addedBy}, ${sql.json(perms)}, now(), now())
      `;
      return res.json({ data: null, error: null });
    }

    if (action === "update" && table === "admin_team" && isUuid(body.id) && body.patch) {
      const perms = body.patch.permissions;
      if (!perms || typeof perms !== "object" || Array.isArray(perms)) {
        return bad(res, "patch.permissions object required");
      }
      const [updated] = await sql`
        update admin_team
        set permissions = ${sql.json(perms)}, updated_at = now()
        where id = ${body.id}
        returning *
      `;
      return res.json({ data: updated || null, error: null });
    }

    if (action === "delete" && table === "admin_team" && isUuid(body.id)) {
      await sql`delete from admin_team where id = ${body.id}`;
      return res.json({ data: null, error: null });
    }

    return bad(res, `compat admin: unsupported ${action} ${table}`, 501);
  })
);

export default router;
