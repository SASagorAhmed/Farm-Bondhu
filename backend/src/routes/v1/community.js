import { Router } from "express";
import sql from "../../db.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireDatabase } from "../../middleware/requireDatabase.js";
import { requireUser } from "../../middleware/requireUser.js";

const router = Router();
const chain = [requireDatabase, requireUser];
const UUID_RE = /^[0-9a-f-]{36}$/i;
const nowMs = () => Number(process.hrtime.bigint() / 1000000n);

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

    const [comments, answers, reactionRow, saveRow] = await Promise.all([
      sql`
        select id, post_id, user_id, body, created_at, updated_at
        from community_comments
        where post_id = ${postId}
        order by created_at asc
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
    ]);

    const userIds = new Set([post.user_id]);
    for (const row of comments || []) userIds.add(row.user_id);
    for (const row of answers || []) userIds.add(row.user_id);

    let sharedPost = null;
    if (post.shared_post_id && UUID_RE.test(String(post.shared_post_id))) {
      const [sp] = await sql`
        select id, title, body, post_type, category, animal_type, created_at, user_id
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
        sharedPost: sharedWithAuthor,
      },
    });
  })
);

export default router;
