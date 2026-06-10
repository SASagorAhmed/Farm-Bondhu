import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";
import { fetchCommunityFeed } from "../../services/communityFeed.js";
import { parseDataUrl, uploadToCloudinary } from "../../services/cloudinaryUpload.js";

const router = Router();
const chain = [requireDatabase, requireUser, requireCommunityAccess];
const UUID_RE = /^[0-9a-f-]{36}$/i;
const COMMUNITY_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const nowMs = () => Number(process.hrtime.bigint() / 1000000n);

async function requestIsAdmin(userId) {
  const rows = await sql`
    select 1 from user_roles
    where user_id = ${userId} and role = 'admin'
    limit 1
  `;
  return rows.length > 0;
}

async function requestIsCommunityBlocked(userId) {
  const [row] = await sql`
    select 1 as blocked
    from user_capabilities
    where user_id = ${userId}
      and capability_code = 'can_access_community'
      and is_enabled = false
    limit 1
  `;
  return Boolean(row);
}

async function requireCommunityAccess(req, res, next) {
  if (await requestIsAdmin(req.userId)) {
    next();
    return;
  }
  if (await requestIsCommunityBlocked(req.userId)) {
    res.status(403).json({ error: "Your Community access is blocked. Contact support if you think this is a mistake." });
    return;
  }
  next();
}

async function insertCommunityNotification({ userId, title, message, actionUrl, priority = "normal" }) {
  if (!UUID_RE.test(String(userId || ""))) return;
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

router.get(
  "/feed",
  ...chain,
  asyncHandler(async (req, res) => {
    const startedAt = nowMs();
    const data = await fetchCommunityFeed(req.userId, req.query || {});
    res.setHeader("x-fb-community-feed-ms", String(Math.max(0, nowMs() - startedAt)));
    res.setHeader("Cache-Control", "private, max-age=8");
    res.json({ data });
  })
);

router.post(
  "/uploads/images",
  ...chain,
  asyncHandler(async (req, res) => {
    const fileData = String(req.body?.file_data || req.body?.fileData || req.body?.image || "");
    const filename = String(req.body?.filename || "community-image").trim().slice(0, 180) || "community-image";
    const parsed = parseDataUrl(fileData);
    if (!parsed || !COMMUNITY_IMAGE_MIME_TYPES.has(parsed.mime)) {
      res.status(400).json({ error: "Upload a PNG, JPG, JPEG, or WEBP image" });
      return;
    }
    if (parsed.base64.length > 12_000_000) {
      res.status(413).json({ error: "Image is too large. Please choose a smaller photo." });
      return;
    }

    const uploaded = await uploadToCloudinary(fileData, "community/posts", `post_${req.userId}`);
    res.status(201).json({
      data: {
        type: "image",
        url: uploaded.url,
        filename,
        mime_type: parsed.mime,
      },
    });
  })
);

router.post(
  "/posts/:id/interests",
  ...chain,
  asyncHandler(async (req, res) => {
    const postId = String(req.params.id || "");
    if (!UUID_RE.test(postId)) {
      res.status(400).json({ error: "Invalid post id" });
      return;
    }
    const [post] = await sql`
      select id, user_id, post_type, post_intent, category, title
      from community_posts
      where id = ${postId} and status = 'active'
      limit 1
    `;
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const isHiring =
      post.post_type === "hiring" ||
      post.post_intent === "hiring" ||
      String(post.category || "").includes("hiring");
    if (!isHiring) {
      res.status(400).json({ error: "This post is not accepting hiring interests" });
      return;
    }
    if (post.user_id === req.userId) {
      res.status(400).json({ error: "You cannot mark interest in your own hiring post" });
      return;
    }

    const [profile] = await sql`
      select id, name, email, phone, location, primary_role, signup_module, avatar_url,
             cv_url, cv_filename, cv_mime_type, cv_updated_at
      from profiles
      where id = ${req.userId}
      limit 1
    `;
    if (!profile?.cv_url) {
      res.status(400).json({ error: "Upload your CV in Profile before sharing interest" });
      return;
    }

    const sharedProfile = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      primary_role: profile.primary_role,
      signup_module: profile.signup_module,
      avatar_url: profile.avatar_url,
      cv_filename: profile.cv_filename,
      cv_mime_type: profile.cv_mime_type,
      cv_updated_at: profile.cv_updated_at,
      shared_at: new Date().toISOString(),
    };
    const message = String(req.body?.message || "").trim().slice(0, 800) || null;
    const [interest] = await sql`
      insert into community_hiring_interests ${sql({
        post_id: post.id,
        owner_user_id: post.user_id,
        interested_user_id: req.userId,
        status: "interested",
        shared_profile: sharedProfile,
        shared_cv_url: profile.cv_url,
        message,
        updated_at: new Date().toISOString(),
      })}
      on conflict (post_id, interested_user_id)
      do update set
        status = 'interested',
        shared_profile = excluded.shared_profile,
        shared_cv_url = excluded.shared_cv_url,
        message = excluded.message,
        updated_at = now()
      returning *
    `;
    await insertCommunityNotification({
      userId: post.user_id,
      title: "New interest in your hiring post",
      message: `${profile.name || "Someone"} shared their profile and CV for "${post.title || "your hiring post"}".`,
      actionUrl: `/community/post/${post.id}`,
      priority: "medium",
    });
    res.json({ data: interest });
  })
);

router.get(
  "/posts/:id/interests",
  ...chain,
  asyncHandler(async (req, res) => {
    const postId = String(req.params.id || "");
    if (!UUID_RE.test(postId)) {
      res.status(400).json({ error: "Invalid post id" });
      return;
    }
    const [post] = await sql`
      select id, user_id
      from community_posts
      where id = ${postId}
      limit 1
    `;
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const allowed = post.user_id === req.userId || (await requestIsAdmin(req.userId));
    if (!allowed) {
      res.status(403).json({ error: "Only the hiring post owner can view interested users" });
      return;
    }
    const rows = await sql`
      select *
      from community_hiring_interests
      where post_id = ${postId}
      order by created_at desc
      limit 200
    `;
    res.json({ data: rows });
  })
);

router.get(
  "/posts/:id/detail",
  ...chain,
  asyncHandler(async (req, res) => {
    const startedAt = nowMs();
    const postId = String(req.params.id || "");
    if (!UUID_RE.test(postId)) {
      res.status(400).json({ error: "Invalid post id" });
      return;
    }
    const uid = req.userId;
    const [post] = await sql`
      select *
      from community_posts
      where id = ${postId}
      limit 1
    `;
    if (!post) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const [comments, answers, reactionRow, saveRow, interestRow, interestCountRow] = await Promise.all([
      sql`
        select
          c.id,
          c.post_id,
          c.user_id,
          c.parent_id,
          c.body,
          coalesce(c.reaction_count, 0) as reaction_count,
          (select count(*)::int from community_comments r where r.parent_id = c.id) as reply_count,
          exists(select 1 from community_comment_reactions cr where cr.comment_id = c.id and cr.user_id = ${uid}) as has_reacted,
          c.created_at,
          c.updated_at
        from community_comments c
        where post_id = ${postId}
        order by c.created_at asc
      `,
      sql`
        select id, post_id, user_id, body, is_best_answer, upvote_count, created_at, updated_at
        from community_answers
        where post_id = ${postId}
        order by is_best_answer desc, upvote_count desc, created_at asc
      `,
      sql`
        select id
        from community_reactions
        where post_id = ${postId} and user_id = ${uid}
        limit 1
      `,
      sql`
        select id
        from community_saves
        where post_id = ${postId} and user_id = ${uid}
        limit 1
      `,
      sql`
        select id
        from community_hiring_interests
        where post_id = ${postId} and interested_user_id = ${uid}
        limit 1
      `,
      sql`
        select count(*)::int as count
        from community_hiring_interests
        where post_id = ${postId}
      `,
    ]);

    const userIds = new Set([post.user_id]);
    for (const row of comments || []) userIds.add(row.user_id);
    for (const row of answers || []) userIds.add(row.user_id);

    let sharedPost = null;
    if (post.shared_post_id && UUID_RE.test(String(post.shared_post_id))) {
      const [sp] = await sql`
        select id, title, body, post_type, category, animal_type, created_at, user_id,
               reaction_count, comment_count, answer_count, share_count, attachments
        from community_posts
        where id = ${post.shared_post_id}
        limit 1
      `;
      if (sp) {
        userIds.add(sp.user_id);
        sharedPost = sp;
      }
    }

    const profilesRows = userIds.size
      ? await sql`
          select id, name, primary_role
          from profiles
          where id in ${sql([...userIds])}
        `
      : [];
    const profiles = {};
    for (const p of profilesRows) {
      profiles[p.id] = { name: p.name, primary_role: p.primary_role };
    }

    const sharedWithAuthor = sharedPost
      ? {
          ...sharedPost,
          author_name: profiles[sharedPost.user_id]?.name || "User",
          author_role: profiles[sharedPost.user_id]?.primary_role || null,
        }
      : null;

    res.setHeader("x-fb-community-detail-ms", String(Math.max(0, nowMs() - startedAt)));
    res.setHeader("Cache-Control", "private, max-age=8");
    res.json({
      data: {
        post,
        comments,
        answers,
        profiles,
        hasReacted: Boolean(reactionRow?.[0]?.id),
        hasSaved: Boolean(saveRow?.[0]?.id),
        hasInterested: Boolean(interestRow?.[0]?.id),
        hiringInterestCount: interestCountRow?.[0]?.count || 0,
        sharedPost: sharedWithAuthor,
      },
    });
  })
);

export default router;
