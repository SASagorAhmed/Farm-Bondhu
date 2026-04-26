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

const router = Router();

function bad(res, msg, status = 400) {
  res.status(status).json({ error: msg });
}

/** @param {unknown} v */
function isUuid(v) {
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
}

router.post(
  "/",
  requireDatabase,
  requireUser,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const { action, table } = body;
    const uid = req.userId;

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
        select capability_code, is_enabled from user_capabilities where user_id = ${uid}
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "active_latest") {
      const rows = await sql`
        select * from community_posts where status = 'active' order by created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "active_category") {
      const cat = String(body.category || "");
      const rows = await sql`
        select * from community_posts
        where status = 'active' and category = ${cat}
        order by created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "urgent") {
      const rows = await sql`
        select * from community_posts
        where status = 'active' and priority in ('urgent', 'expert_needed')
        order by created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "unanswered") {
      const rows = await sql`
        select * from community_posts
        where status = 'active'
          and post_type in ('question', 'help_request')
          and answer_count = 0
        order by created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "by_user") {
      const rows = await sql`
        select * from community_posts where user_id = ${uid} order by created_at desc
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "by_id") {
      if (!isUuid(body.id)) return bad(res, "Invalid id");
      const [row] = await sql`
        select * from community_posts where id = ${body.id} limit 1
      `;
      return res.json({ data: row || null, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "by_ids") {
      const ids = (body.ids || []).filter(isUuid);
      if (!ids.length) return res.json({ data: [], error: null });
      const rows = await sql`select * from community_posts where id in ${sql(ids)}`;
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
        select * from community_comments where post_id = ${body.post_id} order by created_at asc
      `;
      return res.json({ data: rows, error: null });
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
      if (owner.user_id !== uid) return bad(res, "Forbidden", 403);
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
      if (owner.user_id !== uid) return bad(res, "Forbidden", 403);
      await sql`delete from community_posts where id = ${body.id}`;
      return res.json({ data: null, error: null });
    }

    if (action === "insert" && table === "community_comments" && isUuid(body.post_id)) {
      const text = String(body.body || "").trim();
      if (!text) return bad(res, "body required");
      const [created] = await sql`
        insert into community_comments ${sql({
          post_id: body.post_id,
          user_id: uid,
          body: text,
        })}
        returning *
      `;
      return res.json({ data: created, error: null });
    }

    if (action === "insert" && table === "community_answers" && isUuid(body.post_id)) {
      const text = String(body.body || "").trim();
      if (!text) return bad(res, "body required");
      const [created] = await sql`
        insert into community_answers ${sql({
          post_id: body.post_id,
          user_id: uid,
          body: text,
        })}
        returning *
      `;
      return res.json({ data: created, error: null });
    }

    if (action === "insert" && table === "community_reactions" && isUuid(body.post_id)) {
      const [ex] = await sql`
        select id from community_reactions where post_id = ${body.post_id} and user_id = ${uid} limit 1
      `;
      if (!ex) {
        await sql`
          insert into community_reactions ${sql({ post_id: body.post_id, user_id: uid })}
        `;
      }
      return res.json({ data: null, error: null });
    }

    if (action === "delete" && table === "community_reactions" && isUuid(body.post_id)) {
      await sql`
        delete from community_reactions where post_id = ${body.post_id} and user_id = ${uid}
      `;
      return res.json({ data: null, error: null });
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
      const [created] = await sql`
        insert into chat_messages ${sql({
          ...row,
          conversation_id: body.conversation_id,
          sender_id: uid,
        })}
        returning *
      `;
      return res.json({ data: created, error: null });
    }

    if (action === "update" && table === "conversations" && isUuid(body.id)) {
      const [c] = await sql`
        select buyer_id, seller_id from conversations where id = ${body.id} limit 1
      `;
      if (!c) return res.json({ data: null, error: { message: "Not found" } });
      if (c.buyer_id !== uid && c.seller_id !== uid) return bad(res, "Forbidden", 403);
      const patch = body.patch || {};
      const [updated] = await sql`
        update conversations set ${sql(patch)} where id = ${body.id} returning *
      `;
      return res.json({ data: updated, error: null });
    }

    if (action === "select" && table === "conversations" && body.mode === "find") {
      const { buyer_id: buyerId, seller_id: sellerId, product_id: productId } = body;
      if (!isUuid(buyerId) || !isUuid(sellerId) || !isUuid(productId)) return bad(res, "Invalid ids");
      if (buyerId !== uid) return bad(res, "Forbidden", 403);
      const [row] = await sql`
        select id from conversations
        where buyer_id = ${buyerId} and seller_id = ${sellerId} and product_id = ${productId}
        limit 1
      `;
      return res.json({ data: row || null, error: null });
    }

    if (action === "insert" && table === "conversations") {
      const { buyer_id: buyerId, seller_id: sellerId, product_id: productId } = body;
      if (!isUuid(buyerId) || !isUuid(sellerId) || !isUuid(productId)) return bad(res, "Invalid ids");
      if (buyerId !== uid) return bad(res, "Forbidden", 403);
      const [created] = await sql`
        insert into conversations ${sql({ buyer_id: buyerId, seller_id: sellerId, product_id: productId })}
        returning *
      `;
      return res.json({ data: created, error: null });
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
        where buyer_id = ${uid} or seller_id = ${uid}
        order by coalesce(last_message_at, created_at) desc nulls last
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "conversations" && body.mode === "seller_inbox") {
      const rows = await sql`
        select * from conversations
        where seller_id = ${uid}
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
      if (r.user_id !== uid) return bad(res, "Forbidden", 403);
      const patch = body.patch || {};
      const [updated] = await sql`
        update community_comments set ${sql(patch)} where id = ${body.id} returning *
      `;
      return res.json({ data: updated, error: null });
    }

    if (action === "delete" && table === "community_comments" && isUuid(body.id)) {
      const [r] = await sql`
        select user_id from community_comments where id = ${body.id} limit 1
      `;
      if (!r) return res.json({ data: null, error: null });
      if (r.user_id !== uid) return bad(res, "Forbidden", 403);
      await sql`delete from community_comments where id = ${body.id}`;
      return res.json({ data: null, error: null });
    }

    if (action === "update" && table === "community_answers" && isUuid(body.id)) {
      const [r] = await sql`
        select user_id from community_answers where id = ${body.id} limit 1
      `;
      if (!r) return res.json({ data: null, error: { message: "Not found" } });
      if (r.user_id !== uid) return bad(res, "Forbidden", 403);
      const patch = body.patch || {};
      const [updated] = await sql`
        update community_answers set ${sql(patch)} where id = ${body.id} returning *
      `;
      return res.json({ data: updated, error: null });
    }

    if (action === "delete" && table === "community_answers" && isUuid(body.id)) {
      const [r] = await sql`
        select user_id from community_answers where id = ${body.id} limit 1
      `;
      if (!r) return res.json({ data: null, error: null });
      if (r.user_id !== uid) return bad(res, "Forbidden", 403);
      await sql`delete from community_answers where id = ${body.id}`;
      return res.json({ data: null, error: null });
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
      const rows = await sql`
        select * from profiles order by created_at desc limit 5000
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
      const limit = Math.min(Number(body.limit) || 5000, 5000);
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
      return res.json({ data: updated || null, error: null });
    }

    if (action === "select" && table === "farms" && body.mode === "all_admin") {
      const rows = await sql`select * from farms order by created_at desc limit 5000`;
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
      const rows = await sql`
        select * from products order by created_at desc limit 5000
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "shops" && body.mode === "admin_all") {
      const rows = await sql`
        select * from shops order by created_at desc limit 5000
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_posts" && body.mode === "admin_all") {
      const rows = await sql`
        select * from community_posts order by created_at desc limit 5000
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "community_reports" && body.mode === "admin_all") {
      const rows = await sql`
        select * from community_reports order by created_at desc limit 2000
      `;
      return res.json({ data: rows, error: null });
    }

    if (action === "select" && table === "conversations" && body.mode === "admin_all") {
      const rows = await sql`
        select * from conversations
        order by coalesce(last_message_at, created_at) desc nulls last
        limit 2000
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
