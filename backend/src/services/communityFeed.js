import sql from "../db.js";
import { inferSignupModuleFromAccess } from "./inferSignupModule.js";

const WORKSPACE_BY_CATEGORY = {
  animal_health: ["farm", "vetbondhu"],
  feed_nutrition: ["farm", "vetbondhu"],
  medicine_vaccination: ["vetbondhu", "farm"],
  farm_management: ["farm"],
  marketplace_buying: ["marketplace_buyer"],
  marketplace_selling: ["marketplace_seller", "marketplace_buyer"],
  breeding_growth: ["farm", "vetbondhu"],
  egg_production: ["farm"],
  milk_production: ["farm"],
  meat_production: ["farm", "marketplace_seller"],
  equipment_setup: ["farm", "marketplace_seller"],
  vet_advice: ["vetbondhu"],
  disease_symptoms: ["vetbondhu"],
  emergency_help: ["vetbondhu"],
  business_profit: ["farm", "marketplace_seller"],
  general_discussion: ["general"],
  medibondhu_patient_help: ["medibondhu"],
  medibondhu_doctor_advice: ["medibondhu"],
  medibondhu_prescription: ["medibondhu"],
  human_health: ["medibondhu"],
  appointment_help: ["medibondhu"],
  delivery_order_help: ["marketplace_buyer", "marketplace_seller"],
  product_question: ["marketplace_buyer"],
  shop_promotion: ["marketplace_seller"],
  learning_course: ["learning"],
  tutorial_request: ["learning"],
  study_note: ["learning"],
  training_help: ["learning"],
  community_hiring: ["community_hiring"],
  job_wanted: ["community_hiring"],
  farm_worker: ["community_hiring", "farm"],
  shop_staff: ["community_hiring", "marketplace_seller"],
  veterinary_assistant: ["community_hiring", "vetbondhu"],
  clinic_staff: ["community_hiring", "medibondhu"],
  delivery_logistics: ["community_hiring", "marketplace_buyer", "marketplace_seller"],
};

function normalizeList(rows, key) {
  return [...new Set((rows || []).map((r) => String(r?.[key] || "").trim().toLowerCase()).filter(Boolean))];
}

export function inferWorkspaceContexts(post = {}) {
  const contexts = new Set();
  for (const value of post.workspace_context || []) {
    if (value) contexts.add(String(value).trim().toLowerCase());
  }
  for (const value of WORKSPACE_BY_CATEGORY[String(post.category || "").trim().toLowerCase()] || []) {
    contexts.add(value);
  }
  const type = String(post.post_type || "").trim().toLowerCase();
  const intent = String(post.post_intent || "").trim().toLowerCase();
  if (type === "hiring" || intent === "hiring") contexts.add("community_hiring");
  if (intent === "learning") contexts.add("learning");
  if (type === "help_request" && post.priority === "expert_needed") contexts.add("vetbondhu");
  if (!contexts.size) contexts.add("general");
  return [...contexts];
}

export async function getCommunityUserInterests(userId) {
  const [profile] = await sql`
    select id, name, email, primary_role, signup_module
    from profiles
    where id = ${userId}
    limit 1
  `;
  const [roleRows, capabilityRows] = await Promise.all([
    sql`select lower(trim(role)) as role from user_roles where user_id = ${userId}`,
    sql`
      select lower(trim(capability_code)) as capability
      from user_capabilities
      where user_id = ${userId} and is_enabled = true
    `,
  ]);

  const roles = normalizeList(roleRows, "role");
  const caps = normalizeList(capabilityRows, "capability");
  if (profile?.primary_role) roles.push(String(profile.primary_role).trim().toLowerCase());

  const roleSet = new Set(roles);
  const capSet = new Set(caps);
  const interests = new Set();
  const module = inferSignupModuleFromAccess(profile?.signup_module, [...roleSet], [...capSet]);

  if (module === "medibondhu" || roleSet.has("doctor") || capSet.has("can_book_human") || capSet.has("can_practice_human")) {
    interests.add("medibondhu");
  }
  if (module === "vetbondhu" || roleSet.has("vet") || capSet.has("can_book_vet") || capSet.has("can_consult_as_vet")) {
    interests.add("vetbondhu");
  }
  if (roleSet.has("buyer") || capSet.has("can_buy") || capSet.has("can_bulk_buy")) {
    interests.add("marketplace_buyer");
  }
  if (roleSet.has("vendor") || capSet.has("can_sell") || capSet.has("can_manage_store")) {
    interests.add("marketplace_seller");
    interests.add("marketplace_buyer");
  }
  if (module === "farm" || roleSet.has("farmer") || capSet.has("can_manage_farm")) {
    interests.add("farm");
  }
  if (capSet.has("can_access_learning")) {
    interests.add("learning");
  }
  interests.add("community_hiring");
  if (!interests.size || roleSet.has("admin")) {
    interests.add("general");
    interests.add("farm");
    interests.add("vetbondhu");
    interests.add("medibondhu");
    interests.add("marketplace_buyer");
    interests.add("marketplace_seller");
    interests.add("learning");
    interests.add("community_hiring");
  }

  return {
    profile,
    roles: [...roleSet],
    capabilities: [...capSet],
    interests: [...interests],
  };
}

function escapeLike(value) {
  return String(value || "").replace(/[\\%_]/g, (m) => `\\${m}`);
}

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "i",
  "in",
  "is",
  "me",
  "my",
  "near",
  "need",
  "of",
  "on",
  "or",
  "please",
  "the",
  "to",
  "want",
  "with",
]);

const SEARCH_ALIASES = {
  buy: ["buyer", "buying", "marketplace", "marketplace_buying", "product_question"],
  buyer: ["buy", "buying", "marketplace", "marketplace_buying", "product_question"],
  clinic: ["clinic_staff", "medibondhu", "human_health"],
  cv: ["resume", "job", "work", "hiring", "community_hiring"],
  doctor: ["medibondhu", "clinic_staff", "human_health"],
  employee: ["staff", "worker", "hiring", "community_hiring"],
  farm: ["farmer", "farm_worker", "farm_management", "community_hiring"],
  farmer: ["farm", "farm_worker", "farm_management"],
  feed: ["feed_nutrition", "marketplace_buying", "marketplace_selling"],
  help: ["help_request", "emergency_help", "vet_advice"],
  hire: ["hiring", "job", "work", "worker", "staff", "community_hiring"],
  hiring: ["hire", "job", "work", "worker", "staff", "community_hiring"],
  job: ["hiring", "work", "worker", "staff", "job_wanted", "community_hiring"],
  medicine: ["medicine_vaccination", "animal_health", "vetbondhu"],
  resume: ["cv", "job", "work", "hiring", "community_hiring"],
  sell: ["seller", "selling", "marketplace", "marketplace_selling", "shop_promotion"],
  seller: ["sell", "selling", "marketplace", "marketplace_selling", "shop_promotion"],
  shop: ["shop_staff", "shop_promotion", "marketplace_seller"],
  staff: ["employee", "worker", "hiring", "shop_staff", "clinic_staff", "community_hiring"],
  vet: ["vetbondhu", "veterinary_assistant", "vet_advice", "animal_health"],
  veterinary: ["vet", "vetbondhu", "veterinary_assistant"],
  work: ["job", "worker", "hiring", "job_wanted", "community_hiring"],
  worker: ["work", "job", "hiring", "farm_worker", "community_hiring"],
};

function normalizeRepeatedLetters(token) {
  return String(token || "").replace(/([\p{L}\p{N}])\1{2,}/gu, "$1");
}

function tokenizeSearchQuery(value) {
  return String(value || "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token))
    .slice(0, 12) || [];
}

function buildSearchTerms(value) {
  const tokens = tokenizeSearchQuery(value);
  const terms = new Set(tokens);
  for (const token of tokens) {
    const normalized = normalizeRepeatedLetters(token);
    if (normalized && normalized !== token && normalized.length > 1 && !SEARCH_STOP_WORDS.has(normalized)) {
      terms.add(normalized);
    }
    for (const alias of SEARCH_ALIASES[token] || []) terms.add(alias);
    for (const alias of SEARCH_ALIASES[normalized] || []) terms.add(alias);
  }
  const text = String(value || "").toLowerCase();
  if (text.includes("farm worker")) {
    terms.add("farm_worker");
    terms.add("community_hiring");
  }
  if (text.includes("clinic staff")) {
    terms.add("clinic_staff");
    terms.add("community_hiring");
  }
  if (text.includes("shop staff")) {
    terms.add("shop_staff");
    terms.add("community_hiring");
  }
  if (text.includes("vet assistant") || text.includes("veterinary assistant")) {
    terms.add("veterinary_assistant");
    terms.add("community_hiring");
  }
  return [...terms].slice(0, 40);
}

function clampLimit(value) {
  const n = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(n)) return 20;
  return Math.min(50, Math.max(1, n));
}

function parseCursor(cursor) {
  if (!cursor) return null;
  try {
    const text = Buffer.from(String(cursor), "base64url").toString("utf8");
    const parsed = JSON.parse(text);
    if (!parsed?.created_at || !parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function makeCursor(row) {
  if (!row?.created_at || !row?.id) return null;
  return Buffer.from(JSON.stringify({ created_at: row.created_at, id: row.id })).toString("base64url");
}

export async function fetchCommunityFeed(userId, query = {}) {
  const limit = clampLimit(query.limit);
  const tab = String(query.tab || "latest").trim().toLowerCase();
  const intent = String(query.intent || "all").trim().toLowerCase();
  const postType = String(query.post_type || "all").trim().toLowerCase();
  const category = String(query.category || "all").trim().toLowerCase();
  const animalType = String(query.animal_type || "all").trim().toLowerCase();
  const q = String(query.q || "").trim();
  const cursor = parseCursor(query.cursor);
  const escaped = q ? `%${escapeLike(q.toLowerCase())}%` : null;
  const tsQuery = q || null;
  const rawSearchTokens = tokenizeSearchQuery(q);
  const searchTerms = buildSearchTerms(q);
  const hasSearchTerms = searchTerms.length > 0;
  const allowContextOnlyMatch = rawSearchTokens.length <= 1;
  const { interests } = await getCommunityUserInterests(userId);

  const rows = await sql`
    with base as (
      select
        p.*,
        coalesce(p.workspace_context, '{}'::text[]) as stored_context,
        coalesce(array_remove(array[
          case when p.category in ('animal_health','feed_nutrition','breeding_growth','egg_production','milk_production','meat_production','equipment_setup','business_profit','farm_management') then 'farm' end,
          case when p.category in ('animal_health','feed_nutrition','medicine_vaccination','breeding_growth','vet_advice','disease_symptoms','emergency_help') then 'vetbondhu' end,
          case when p.category in ('medibondhu_patient_help','medibondhu_doctor_advice','medibondhu_prescription','human_health','appointment_help') then 'medibondhu' end,
          case when p.category in ('marketplace_buying','delivery_order_help','product_question') then 'marketplace_buyer' end,
          case when p.category in ('marketplace_selling','shop_promotion','business_profit','delivery_order_help') then 'marketplace_seller' end,
          case when p.category in ('learning_course','tutorial_request','study_note','training_help') or p.post_intent = 'learning' then 'learning' end,
          case when p.category in ('community_hiring','job_wanted','farm_worker','shop_staff','veterinary_assistant','clinic_staff','delivery_logistics') or p.post_type = 'hiring' or p.post_intent = 'hiring' then 'community_hiring' end,
          case when p.category in ('farm_worker') then 'farm' end,
          case when p.category in ('shop_staff','delivery_logistics') then 'marketplace_seller' end,
          case when p.category in ('veterinary_assistant') then 'vetbondhu' end,
          case when p.category in ('clinic_staff') then 'medibondhu' end,
          case when p.category in ('general_discussion') then 'general' end
        ], null), '{}'::text[]) as inferred_context,
        lower(concat_ws(' ',
          p.title,
          p.body,
          p.post_type,
          p.post_intent,
          p.category,
          p.animal_type,
          array_to_string(p.tags, ' '),
          author.name,
          p.hiring_details ->> 'intent',
          p.hiring_details ->> 'position',
          p.hiring_details ->> 'location',
          p.hiring_details ->> 'pay',
          p.hiring_details ->> 'skills',
          p.hiring_details ->> 'contact',
          p.hiring_details ->> 'deadline',
          p.hiring_details ->> 'availability'
        )) as search_text,
        to_tsvector('simple', concat_ws(' ',
          p.title,
          p.body,
          p.post_type,
          p.post_intent,
          p.category,
          p.animal_type,
          array_to_string(p.tags, ' '),
          author.name,
          p.hiring_details ->> 'intent',
          p.hiring_details ->> 'position',
          p.hiring_details ->> 'location',
          p.hiring_details ->> 'pay',
          p.hiring_details ->> 'skills',
          p.hiring_details ->> 'contact',
          p.hiring_details ->> 'deadline',
          p.hiring_details ->> 'availability'
        )) as search_doc
      from community_posts p
      left join profiles author on author.id = p.user_id
      where p.status = 'active'
        ${tab === "questions" ? sql`and p.post_type in ('question', 'help_request')` : sql``}
        ${tab === "urgent" ? sql`and p.priority in ('urgent', 'expert_needed')` : sql``}
        ${tab === "unanswered" ? sql`and p.post_type in ('question', 'help_request') and p.answer_count = 0` : sql``}
        ${
          postType && postType !== "all"
            ? sql`and p.post_type = ${postType}`
            : sql``
        }
        ${
          intent === "learning"
            ? sql`and (p.post_intent = 'learning' or p.category in ('learning_course','tutorial_request','study_note','training_help'))`
            : sql``
        }
        ${
          intent === "marketplace"
            ? sql`and (p.post_intent = 'marketplace' or p.category in ('marketplace_buying','marketplace_selling','product_question','delivery_order_help','shop_promotion'))`
            : sql``
        }
        ${
          intent === "hiring"
            ? sql`and (p.post_intent = 'hiring' or p.post_type = 'hiring' or p.category in ('community_hiring','job_wanted','farm_worker','shop_staff','veterinary_assistant','clinic_staff','delivery_logistics'))`
            : sql``
        }
        ${category && category !== "all" ? sql`and p.category = ${category}` : sql``}
        ${animalType && animalType !== "all" ? sql`and p.animal_type = ${animalType}` : sql``}
        ${
          cursor
            ? sql`and (p.created_at, p.id) < (${cursor.created_at}::timestamptz, ${cursor.id}::uuid)`
            : sql``
        }
    ),
    scored as (
      select
        b.*,
        array(select distinct x from unnest(b.stored_context || b.inferred_context) as x where x is not null and x <> '') as workspace_context_resolved,
        case
          when ${tsQuery}::text is null then 0
          else ts_rank_cd(b.search_doc, websearch_to_tsquery('simple', ${tsQuery}))
        end as search_rank,
        case
          when ${tsQuery}::text is null then 0
          when lower(coalesce(b.title, '')) like ${escaped} escape '\\' then 6
          when lower(coalesce(b.body, '')) like ${escaped} escape '\\' then 4
          when b.search_text like ${escaped} escape '\\' then 3
          else 0
        end as phrase_match_score,
        case
          when ${hasSearchTerms}::boolean = false then 0
          else (
            select count(*)::int
            from unnest(${searchTerms}::text[]) as term(value)
            where position(term.value in b.search_text) > 0
          )
        end as token_match_count,
        case
          when ${hasSearchTerms}::boolean = false then 0
          else (
            select count(*)::int
            from unnest(${searchTerms}::text[]) as term(value)
            where term.value in (
              b.post_type,
              coalesce(b.post_intent, ''),
              b.category,
              b.animal_type
            )
            or (${allowContextOnlyMatch}::boolean = true and term.value = any(b.stored_context || b.inferred_context))
          )
        end as alias_match_count,
        case
          when ${hasSearchTerms}::boolean = false then 0
          else (
            select count(*)::int
            from unnest(${searchTerms}::text[]) as term(value)
            where length(term.value) >= 4
              and exists (
                select 1
                from regexp_split_to_table(b.search_text, '[^[:alnum:]_]+') as word(value)
                where length(word.value) >= 4
                  and similarity(word.value, term.value) > 0.58
              )
          )
        end as fuzzy_token_count,
        case
          when ${tsQuery}::text is null then 0
          else greatest(
            similarity(lower(coalesce(b.title, '')), lower(${tsQuery})),
            similarity(lower(coalesce(b.body, '')), lower(${tsQuery}))
          )
        end as fuzzy_rank,
        case
          when ${tsQuery}::text is null then true
          else (
            b.search_doc @@ websearch_to_tsquery('simple', ${tsQuery})
            or lower(coalesce(b.title, '')) like ${escaped} escape '\\'
            or lower(coalesce(b.body, '')) like ${escaped} escape '\\'
            or b.search_text like ${escaped} escape '\\'
            or (
              ${hasSearchTerms}::boolean = true
              and exists (
                select 1
                from unnest(${searchTerms}::text[]) as term(value)
                where position(term.value in b.search_text) > 0
                  or term.value in (b.post_type, coalesce(b.post_intent, ''), b.category, b.animal_type)
                  or (${allowContextOnlyMatch}::boolean = true and term.value = any(b.stored_context || b.inferred_context))
                  or (
                    length(term.value) >= 4
                    and exists (
                      select 1
                      from regexp_split_to_table(b.search_text, '[^[:alnum:]_]+') as word(value)
                      where length(word.value) >= 4
                        and similarity(word.value, term.value) > 0.58
                    )
                  )
              )
            )
            or (
              cardinality(${searchTerms}::text[]) <= 2
              and (
                similarity(lower(coalesce(b.title, '')), lower(${tsQuery})) > 0.3
                or similarity(lower(coalesce(b.body, '')), lower(${tsQuery})) > 0.2
              )
            )
          )
        end as search_match
      from base b
    ),
    enriched as (
      select
        s.*,
        coalesce(author.name, 'User') as author_name,
        author.primary_role as author_role,
        author.signup_module as author_signup_module,
        exists(select 1 from community_reactions r where r.post_id = s.id and r.user_id = ${userId}) as has_reacted,
        exists(select 1 from community_saves sv where sv.post_id = s.id and sv.user_id = ${userId}) as has_saved,
        exists(select 1 from community_hiring_interests hi where hi.post_id = s.id and hi.interested_user_id = ${userId}) as has_interested,
        (select count(*)::int from community_hiring_interests hic where hic.post_id = s.id) as hiring_interest_count,
        coalesce((
          select jsonb_agg(comment_row order by comment_row.created_at asc)
          from (
            select
              c.id,
              c.post_id,
              c.user_id,
              c.body,
              c.parent_id,
              coalesce(c.reaction_count, 0) as reaction_count,
              c.created_at,
              coalesce(cp.name, 'User') as author_name,
              cp.primary_role as author_role,
              (select count(*)::int from community_comments r where r.parent_id = c.id) as reply_count,
              exists(select 1 from community_comment_reactions cr where cr.comment_id = c.id and cr.user_id = ${userId}) as has_reacted
            from (
              select *
              from community_comments c
              where c.post_id = s.id
                and c.parent_id is null
              order by c.created_at desc
              limit 2
            ) c
            left join profiles cp on cp.id = c.user_id
            order by c.created_at asc
          ) comment_row
        ), '[]'::jsonb) as recent_comments,
        case when shared.id is null then null else jsonb_build_object(
          'id', shared.id,
          'title', shared.title,
          'body', shared.body,
          'post_type', shared.post_type,
          'category', shared.category,
          'animal_type', shared.animal_type,
          'created_at', shared.created_at,
          'reaction_count', shared.reaction_count,
          'comment_count', shared.comment_count,
          'answer_count', shared.answer_count,
          'share_count', shared.share_count,
          'attachments', coalesce(shared.attachments, '[]'::jsonb),
          'author_name', coalesce(shared_author.name, 'User'),
          'author_role', shared_author.primary_role
        ) end as shared_post,
        (
          case when s.workspace_context_resolved && ${interests}::text[] then 100 else 0 end +
          case when s.category in ('vet_advice','animal_health','human_health','marketplace_buying','marketplace_selling','farm_management','learning_course','community_hiring','farm_worker','shop_staff','veterinary_assistant','clinic_staff') then 40 else 0 end +
          case when s.post_type = 'hiring' or s.post_intent = 'hiring' then 30 else 0 end +
          case when s.post_intent = 'learning' then 25 else 0 end +
          case when s.priority in ('urgent','expert_needed') then 25 else 0 end +
          case when s.post_type in ('question','help_request') and s.answer_count = 0 then 20 else 0 end +
          least(coalesce(s.reaction_count, 0), 20) +
          least(coalesce(s.comment_count, 0) * 2, 30) +
          greatest(0, 20 - extract(epoch from (now() - s.created_at)) / 86400.0) +
          case
            when ${tsQuery}::text is null then 0
            else (
              s.search_rank * 260 +
              s.phrase_match_score * 45 +
              least(s.token_match_count, 8) * 22 +
              least(s.alias_match_count, 5) * 30 +
              least(s.fuzzy_token_count, 5) * 14 +
              s.fuzzy_rank * 90
            )
          end
        )::float as feed_score
      from scored s
      left join profiles author on author.id = s.user_id
      left join community_posts shared on shared.id = s.shared_post_id
      left join profiles shared_author on shared_author.id = shared.user_id
      where s.search_match
    )
    select *
    from enriched
    order by
      ${tab === "top" ? sql`feed_score desc,` : sql``}
      feed_score desc,
      created_at desc,
      id desc
    limit ${limit + 1}
  `;

  const pageRows = rows.slice(0, limit);
  return {
    posts: pageRows.map((row) => ({
      ...row,
      workspace_context: row.workspace_context_resolved || inferWorkspaceContexts(row),
    })),
    nextCursor: rows.length > limit ? makeCursor(pageRows[pageRows.length - 1]) : null,
    interests,
  };
}
