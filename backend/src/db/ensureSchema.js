/**
 * Bootstrap public schema when tables are missing (local dev, new DB, or partial Supabase).
 * Safe to run repeatedly: IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.
 * Disable with AUTO_CREATE_SCHEMA=false (e.g. production where migrations own DDL).
 */

import {
  ensureOfficialFarmBondhuShop,
  getOfficialFarmBondhuSellerId,
} from "../services/officialFarmBondhuShop.js";

/** @param {import("postgres").Sql} sql */
async function runOptional(sql, label, query) {
  try {
    await sql.unsafe(query);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[ensureSchema] ${label}: ${msg}`);
  }
}

/** @param {import("postgres").Sql} sql */
async function runRequired(sql, label, query) {
  try {
    await sql.unsafe(query);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ensureSchema] ${label} FAILED: ${msg}`);
    throw e;
  }
}

/** @param {import("postgres").Sql} sql */
async function addColumns(sql, table, defs) {
  for (const def of defs) {
    await runOptional(
      sql,
      `alter ${table}`,
      `ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS ${def}`
    );
  }
}

const SUPPORT_PRODUCT_NAME = "Customer Support";
const SUPPORT_PRODUCT_SELLER_NAME = "FarmBondhu Support";

/** @param {import("postgres").Sql} sql */
async function repairMisclassifiedSupportConversations(sql) {
  try {
    const repaired = await sql`
      update conversations c
      set
        conversation_kind = 'marketplace',
        support_topic = null,
        support_status = null,
        updated_at = now()
      where coalesce(c.conversation_kind, 'marketplace') = 'platform_support'
        and (
          c.support_topic is null
          or c.support_topic not in ('help', 'complaint')
          or not exists (
            select 1 from products p
            where p.id = c.product_id
              and p.name = ${SUPPORT_PRODUCT_NAME}
              and p.seller_name = ${SUPPORT_PRODUCT_SELLER_NAME}
          )
        )
      returning c.id
    `;
    if (repaired.length > 0) {
      console.log(
        `[ensureSchema] repaired ${repaired.length} misclassified platform_support conversation(s) → marketplace`
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[ensureSchema] repair misclassified support conversations: ${msg}`);
  }
}

const SUPPORT_SHOP_LABEL = "FarmBondhu Support";
const OFFICIAL_SHOP_NAME = "FarmBondhu";

/** @param {import("postgres").Sql} sql */
async function repairSupportShopNameOverwrite(sql) {
  try {
    const repaired = await sql`
      update shops s
      set
        shop_name = resolved.correct_name,
        updated_at = now()
      from (
        select
          s2.user_id,
          coalesce(
            nullif(trim(latest_ar.request_shop_name), ''),
            case
              when exists (
                select 1 from products p
                where p.seller_id = s2.user_id
                  and p.seller_name = ${OFFICIAL_SHOP_NAME}
                  and p.name <> ${SUPPORT_PRODUCT_NAME}
              ) then ${OFFICIAL_SHOP_NAME}
            end,
            (
              select p2.seller_name
              from products p2
              where p2.seller_id = s2.user_id
                and nullif(trim(p2.seller_name), '') is not null
                and trim(p2.seller_name) <> ${SUPPORT_SHOP_LABEL}
              group by p2.seller_name
              order by count(*) desc
              limit 1
            )
          ) as correct_name
        from shops s2
        left join lateral (
          select trim(coalesce(ar.details->>'shopName', ar.payload->>'shopName', '')) as request_shop_name
          from approval_requests ar
          where ar.user_id = s2.user_id
            and ar.request_type = 'shop_access'
            and ar.status = 'approved'
          order by ar.updated_at desc
          limit 1
        ) latest_ar on true
        where s2.shop_name = ${SUPPORT_SHOP_LABEL}
      ) resolved
      where s.user_id = resolved.user_id
        and resolved.correct_name is not null
        and trim(resolved.correct_name) <> ''
      returning s.user_id
    `;
    if (repaired.length > 0) {
      console.log(
        `[ensureSchema] restored ${repaired.length} shop name(s) overwritten by platform support setup`
      );
    }
    const officialSellerId = await getOfficialFarmBondhuSellerId();
    if (officialSellerId) {
      await ensureOfficialFarmBondhuShop(officialSellerId);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[ensureSchema] repair support shop name overwrite: ${msg}`);
  }
}

/** @param {import("postgres").Sql} sql */
async function migrateOrdersDeliveryAddress(sql) {
  const cols = await sql`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'delivery_address'
  `;
  const col = cols[0];
  if (!col || col.data_type === "jsonb") return;

  await runOptional(
    sql,
    "orders delivery_address jsonb",
    `ALTER TABLE public.orders
     ALTER COLUMN delivery_address TYPE jsonb
     USING (
       CASE
         WHEN delivery_address IS NULL OR btrim(delivery_address) = '' THEN NULL
         WHEN delivery_address ~ '^\\s*\\{' THEN delivery_address::jsonb
         ELSE jsonb_build_object('address', delivery_address)
       END
     )`
  );
}

/** @param {import("postgres").Sql} sql */
export async function ensureSchema(sql) {
  await runOptional(
    sql,
    "extension pgcrypto",
    `CREATE EXTENSION IF NOT EXISTS pgcrypto`
  );
  await runOptional(
    sql,
    "extension pg_trgm",
    `CREATE EXTENSION IF NOT EXISTS pg_trgm`
  );

  const stmts = [
    `CREATE TABLE IF NOT EXISTS public.profiles (
      id uuid PRIMARY KEY,
      email text NOT NULL DEFAULT '',
      name text NOT NULL DEFAULT 'User',
      primary_role text NOT NULL DEFAULT 'farmer',
      phone text,
      location text,
      avatar_url text,
      cv_url text,
      cv_filename text,
      cv_mime_type text,
      cv_updated_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.auth_credentials (
      user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
      password_hash text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.user_roles (
      user_id uuid NOT NULL,
      role text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, role)
    )`,

    `CREATE TABLE IF NOT EXISTS public.role_permissions (
      role text NOT NULL,
      permission_code text NOT NULL,
      PRIMARY KEY (role, permission_code)
    )`,

    `CREATE TABLE IF NOT EXISTS public.user_capabilities (
      user_id uuid NOT NULL,
      capability_code text NOT NULL,
      is_enabled boolean NOT NULL DEFAULT true,
      granted_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, capability_code)
    )`,

    `CREATE TABLE IF NOT EXISTS public.farms (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      name text NOT NULL,
      location text NOT NULL,
      type text NOT NULL,
      sheds integer NOT NULL DEFAULT 1,
      total_animals integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.animals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      farm_id uuid NOT NULL,
      type text NOT NULL DEFAULT 'chicken',
      tracking_mode text NOT NULL DEFAULT 'batch',
      breed text NOT NULL,
      age text NOT NULL,
      health_status text NOT NULL DEFAULT 'healthy',
      batch_id text,
      batch_size integer,
      name text,
      last_vaccination date,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.sheds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      farm_id uuid NOT NULL,
      name text NOT NULL,
      capacity integer NOT NULL DEFAULT 100,
      animal_type text NOT NULL DEFAULT 'chicken',
      status text NOT NULL DEFAULT 'active',
      current_count integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.production_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      date date NOT NULL,
      eggs integer,
      milk numeric,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.financial_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      date date NOT NULL,
      type text NOT NULL,
      category text,
      amount numeric NOT NULL,
      description text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.mortality_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      farm_id uuid,
      date date NOT NULL,
      cause text NOT NULL,
      animal_type text NOT NULL,
      batch_id text,
      count integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.cow_weight_estimations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      farm_id uuid,
      animal_id uuid,
      image_url text,
      chest_width_cm numeric NOT NULL,
      body_length_cm numeric NOT NULL,
      estimated_live_weight_kg numeric NOT NULL,
      edible_meat_kg numeric NOT NULL,
      breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
      detection_mode text NOT NULL DEFAULT 'plan_b',
      input_method text NOT NULL DEFAULT 'ai_assisted',
      annotation_json jsonb,
      confidence numeric,
      actual_weight_kg numeric,
      model_version text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.cow_detection_feedback (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      estimation_id uuid,
      image_url text,
      detection_mode text NOT NULL DEFAULT 'plan_b',
      predicted_head_side text,
      predicted_facing text,
      predicted_head_bbox jsonb,
      corrected_head_side text NOT NULL,
      corrected_head_bbox jsonb,
      local_model text,
      vision_model text,
      annotation_json jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.feed_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      farm_id uuid,
      animal_id uuid,
      animal_label text,
      date date NOT NULL,
      feed_type text NOT NULL,
      quantity numeric,
      unit text,
      cost numeric,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.feed_inventory (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      name text NOT NULL,
      category text,
      stock numeric NOT NULL DEFAULT 0,
      reorder_level numeric,
      unit text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.health_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      animal_id uuid,
      animal_label text,
      date date NOT NULL,
      type text NOT NULL,
      description text,
      vet_name text,
      cost numeric,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.sale_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      date date NOT NULL,
      product text NOT NULL,
      category text,
      buyer text,
      quantity numeric,
      unit text,
      unit_price numeric,
      total numeric NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.sales_memos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      memo_no text NOT NULL,
      memo_date date NOT NULL,
      buyer_name text,
      grand_total numeric NOT NULL DEFAULT 0,
      draft jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      title text,
      message text,
      type text,
      link text,
      broadcast_id uuid,
      "read" boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.email_audit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      email_type text NOT NULL,
      category text NOT NULL,
      recipient_email text NOT NULL,
      subject text NOT NULL,
      status text NOT NULL,
      error_message text,
      body_preview text,
      sensitive_fields jsonb DEFAULT '{}'::jsonb,
      metadata jsonb DEFAULT '{}'::jsonb,
      provider text
    )`,

    `CREATE TABLE IF NOT EXISTS public.orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_id uuid NOT NULL,
      seller_id uuid NOT NULL,
      buyer_name text,
      seller_name text,
      items jsonb NOT NULL DEFAULT '[]'::jsonb,
      total numeric NOT NULL DEFAULT 0,
      shipping_fee numeric DEFAULT 0,
      delivery_address jsonb,
      payment_method text,
      payment_status text,
      timeline jsonb DEFAULT '[]'::jsonb,
      estimated_delivery timestamptz,
      status text NOT NULL DEFAULT 'pending',
      date date,
      return_reason text,
      return_note text,
      tracking_id text,
      stock_restored boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_id uuid NOT NULL,
      seller_name text,
      name text,
      description text,
      price numeric,
      image text,
      stock integer DEFAULT 0,
      category text,
      rating numeric,
      is_verified_seller boolean DEFAULT false,
      location text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.shops (
      user_id uuid PRIMARY KEY,
      shop_name text,
      description text,
      logo_url text,
      banner_url text,
      rating numeric,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.seller_lane_grants (
      user_id uuid NOT NULL,
      lane text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      license_number text,
      license_file_url text,
      review_notes text,
      reviewed_by uuid,
      reviewed_at timestamptz,
      request_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, lane)
    )`,

    `CREATE TABLE IF NOT EXISTS public.marketplace_banners (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      image_url text NOT NULL,
      alt_text text,
      link_url text,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      display_seconds integer NOT NULL DEFAULT 5,
      starts_at timestamptz,
      ends_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.marketing_design_drafts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      title text NOT NULL DEFAULT 'Untitled',
      preset_key text,
      width integer NOT NULL,
      height integer NOT NULL,
      canvas_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      thumbnail_data text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.learning_guides (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      summary text,
      content text,
      category text,
      animal_type text,
      is_published boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.learning_courses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      slug text UNIQUE,
      summary text,
      description text,
      category text,
      animal_type text,
      thumbnail_url text,
      access_type text NOT NULL DEFAULT 'free',
      price numeric NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'BDT',
      is_published boolean NOT NULL DEFAULT false,
      sort_order integer NOT NULL DEFAULT 0,
      author_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.learning_course_videos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid NOT NULL,
      title text NOT NULL,
      description text,
      video_url text,
      cloudinary_public_id text,
      duration_seconds integer NOT NULL DEFAULT 0,
      sort_order integer NOT NULL DEFAULT 0,
      is_preview boolean NOT NULL DEFAULT false,
      is_published boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.learning_course_enrollments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid NOT NULL,
      user_id uuid NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      access_source text NOT NULL DEFAULT 'manual_payment',
      valid_until timestamptz,
      granted_by uuid,
      payment_status text NOT NULL DEFAULT 'unpaid',
      payment_method text,
      payment_reference text,
      payment_sender text,
      payment_amount numeric NOT NULL DEFAULT 0,
      payment_currency text NOT NULL DEFAULT 'BDT',
      payment_note text,
      payment_submitted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (course_id, user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS public.community_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      post_intent text NOT NULL DEFAULT 'general',
      post_type text NOT NULL DEFAULT 'question',
      title text,
      body text,
      category text,
      animal_type text,
      priority text NOT NULL DEFAULT 'normal',
      status text NOT NULL DEFAULT 'active',
      reaction_count integer NOT NULL DEFAULT 0,
      comment_count integer NOT NULL DEFAULT 0,
      answer_count integer NOT NULL DEFAULT 0,
      share_count integer NOT NULL DEFAULT 0,
      shared_post_id uuid,
      workspace_context text[] NOT NULL DEFAULT '{}'::text[],
      hiring_details jsonb NOT NULL DEFAULT '{}'::jsonb,
      link_preview jsonb,
      attachments jsonb,
      tags text[],
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.community_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid NOT NULL,
      user_id uuid NOT NULL,
      parent_id uuid,
      body text NOT NULL,
      reaction_count integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.community_comment_reactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      comment_id uuid NOT NULL,
      post_id uuid NOT NULL,
      user_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (comment_id, user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS public.community_answers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid NOT NULL,
      user_id uuid NOT NULL,
      body text NOT NULL,
      is_best_answer boolean NOT NULL DEFAULT false,
      upvote_count integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.community_reactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid NOT NULL,
      user_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (post_id, user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS public.community_saves (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid NOT NULL,
      user_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (post_id, user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS public.community_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid,
      reported_by uuid NOT NULL,
      reason text,
      details jsonb DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.community_hiring_interests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid NOT NULL,
      owner_user_id uuid NOT NULL,
      interested_user_id uuid NOT NULL,
      status text NOT NULL DEFAULT 'interested',
      shared_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
      shared_cv_url text,
      message text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (post_id, interested_user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS public.conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_id uuid NOT NULL,
      seller_id uuid NOT NULL,
      product_id uuid NOT NULL,
      last_message text,
      last_message_at timestamptz,
      last_sender_id uuid,
      last_sender_role text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.chat_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL,
      sender_id uuid NOT NULL,
      sender_role text NOT NULL DEFAULT 'buyer',
      message_type text NOT NULL DEFAULT 'text',
      text_body text,
      shared_product_id uuid,
      body text,
      attachment_url text,
      "read" boolean NOT NULL DEFAULT false,
      buyer_delivered_at timestamptz,
      buyer_read_at timestamptz,
      seller_delivered_at timestamptz,
      seller_read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.chat_message_translations (
      message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
      target_lang text NOT NULL,
      translated_text text NOT NULL,
      source_lang text,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (message_id, target_lang)
    )`,

    `CREATE TABLE IF NOT EXISTS public.chat_contact_violations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      conversation_id uuid,
      reason text NOT NULL DEFAULT 'contact_guard',
      created_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.marketplace_conversation_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL,
      reported_by uuid NOT NULL,
      reporter_role text NOT NULL,
      reason text NOT NULL,
      details text,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.marketplace_product_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL,
      product_id uuid NOT NULL,
      buyer_id uuid NOT NULL,
      seller_id uuid NOT NULL,
      rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment text,
      photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      deleted_by uuid,
      UNIQUE (order_id, product_id)
    )`,

    `CREATE TABLE IF NOT EXISTS public.marketplace_product_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL,
      user_id uuid NOT NULL,
      body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      deleted_by uuid
    )`,

    `CREATE TABLE IF NOT EXISTS public.user_addresses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      full_name text NOT NULL,
      phone text NOT NULL,
      alt_phone text,
      country text NOT NULL DEFAULT 'Bangladesh',
      division text NOT NULL,
      district text NOT NULL,
      upazila text NOT NULL,
      area text,
      full_address text NOT NULL,
      landmark text,
      post_code text,
      address_type text NOT NULL DEFAULT 'home',
      is_default boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.approval_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      request_type text,
      status text NOT NULL DEFAULT 'pending',
      payload jsonb DEFAULT '{}'::jsonb,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.vets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid,
      name text,
      specialization text,
      clinic_name text,
      location text,
      rating numeric,
      bio text,
      verified boolean NOT NULL DEFAULT false,
      consultation_fee numeric,
      last_seen_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.vet_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid UNIQUE,
      full_name text,
      phone text,
      email text,
      district text,
      address text,
      specialization text,
      degree text,
      experience_years integer,
      consultation_fee numeric,
      profile_image_url text,
      verification_document_url text,
      verification_status text NOT NULL DEFAULT 'pending',
      rejection_reason text,
      verified_by uuid,
      verified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.vetbondhu_user_restrictions (
      user_id uuid NOT NULL,
      subject_type text NOT NULL CHECK (subject_type IN ('vet', 'patient')),
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'suspended', 'deleted')),
      reason text,
      acted_by uuid,
      acted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, subject_type)
    )`,

    `CREATE TABLE IF NOT EXISTS public.medibondhu_user_restrictions (
      user_id uuid NOT NULL,
      subject_type text NOT NULL CHECK (subject_type IN ('doctor', 'patient')),
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'suspended', 'deleted')),
      reason text,
      acted_by uuid,
      acted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, subject_type)
    )`,

    `CREATE TABLE IF NOT EXISTS public.consultation_bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_mock_id uuid NOT NULL,
      vet_id uuid,
      status text NOT NULL DEFAULT 'pending',
      request_notes text,
      scheduled_at timestamptz,
      completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.vetbondhu_consultation_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid NOT NULL,
      patient_user_id uuid NOT NULL,
      vet_user_id uuid NOT NULL,
      vet_mock_id uuid,
      rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment text,
      deleted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (booking_id)
    )`,

    `CREATE TABLE IF NOT EXISTS public.consultation_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid NOT NULL,
      sender_id uuid NOT NULL,
      body text,
      attachment_url text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.prescriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      vet_id uuid,
      patient_id uuid,
      status text NOT NULL DEFAULT 'draft',
      prescription_code text,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.prescription_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      prescription_id uuid NOT NULL,
      label text,
      dosage text,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.e_prescriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_mock_id uuid NOT NULL,
      vet_id uuid,
      title text,
      body text,
      status text NOT NULL DEFAULT 'active',
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.vet_withdrawals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      vet_user_id uuid NOT NULL,
      request_amount numeric NOT NULL,
      gross_earnings numeric NOT NULL DEFAULT 0,
      platform_fee numeric NOT NULL DEFAULT 0,
      net_earnings numeric NOT NULL DEFAULT 0,
      available_balance numeric NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'pending',
      note text,
      reviewed_by uuid,
      reviewed_at timestamptz,
      paid_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.medibondhu_doctor_withdrawals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      doctor_user_id uuid NOT NULL,
      request_amount numeric NOT NULL,
      gross_earnings numeric NOT NULL DEFAULT 0,
      platform_fee numeric NOT NULL DEFAULT 0,
      net_earnings numeric NOT NULL DEFAULT 0,
      available_balance numeric NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'pending',
      note text,
      review_note text,
      reviewed_by uuid,
      reviewed_at timestamptz,
      paid_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.seller_withdrawals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_user_id uuid NOT NULL,
      request_amount numeric NOT NULL,
      gross_earnings numeric NOT NULL DEFAULT 0,
      platform_fee numeric NOT NULL DEFAULT 0,
      net_earnings numeric NOT NULL DEFAULT 0,
      available_balance numeric NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'pending',
      note text,
      review_note text,
      reviewed_by uuid,
      reviewed_at timestamptz,
      paid_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.admin_team (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid,
      name text,
      email text,
      admin_role text,
      permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.vet_availability (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      day text,
      start_time text,
      end_time text,
      slot_label text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.registration_pending (
      email text PRIMARY KEY,
      password_cipher text NOT NULL,
      password_iv text NOT NULL,
      password_tag text NOT NULL,
      profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      otp_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      verify_attempts integer NOT NULL DEFAULT 0,
      last_sent_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.password_reset_pending (
      email text PRIMARY KEY,
      user_id uuid NOT NULL,
      otp_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      verify_attempts integer NOT NULL DEFAULT 0,
      last_sent_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.medibondhu_specialties (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text UNIQUE,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.medibondhu_hospitals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      address text,
      phone text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.medibondhu_doctors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid,
      specialty_id uuid REFERENCES public.medibondhu_specialties(id),
      hospital_id uuid REFERENCES public.medibondhu_hospitals(id),
      full_name text NOT NULL DEFAULT 'Doctor',
      qualification text,
      experience_years integer NOT NULL DEFAULT 0,
      chamber_address text,
      consultation_fee numeric NOT NULL DEFAULT 0,
      profile_photo_url text,
      about text,
      online_consultation boolean NOT NULL DEFAULT true,
      chamber_consultation boolean NOT NULL DEFAULT true,
      rating_avg numeric NOT NULL DEFAULT 0,
      rating_count integer NOT NULL DEFAULT 0,
      approval_status text NOT NULL DEFAULT 'pending',
      rejection_reason text,
      verified_by uuid,
      verified_at timestamptz,
      is_available boolean NOT NULL DEFAULT true,
      medical_reg_number text,
      registration_body text,
      verification_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.medibondhu_doctor_time_slots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      doctor_id uuid NOT NULL REFERENCES public.medibondhu_doctors(id) ON DELETE CASCADE,
      slot_date date NOT NULL,
      slot_start timestamptz NOT NULL,
      slot_end timestamptz NOT NULL,
      booked boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (doctor_id, slot_start)
    )`,

    `CREATE TABLE IF NOT EXISTS public.medibondhu_appointments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_user_id uuid NOT NULL,
      doctor_id uuid NOT NULL REFERENCES public.medibondhu_doctors(id),
      slot_id uuid REFERENCES public.medibondhu_doctor_time_slots(id),
      specialty_id uuid REFERENCES public.medibondhu_specialties(id),
      consultation_type text NOT NULL DEFAULT 'online',
      status text NOT NULL DEFAULT 'pending',
      payment_status text NOT NULL DEFAULT 'unpaid',
      chief_complaint text,
      cancelled_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.medibondhu_prescriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id uuid REFERENCES public.medibondhu_appointments(id) ON DELETE SET NULL,
      doctor_id uuid NOT NULL REFERENCES public.medibondhu_doctors(id),
      patient_user_id uuid NOT NULL,
      diagnosis text,
      advice text,
      follow_up_date date,
      status text NOT NULL DEFAULT 'issued',
      prescription_code text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.medibondhu_prescription_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      prescription_id uuid NOT NULL REFERENCES public.medibondhu_prescriptions(id) ON DELETE CASCADE,
      medication_name text NOT NULL,
      dosage text,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.medibondhu_appointment_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id uuid NOT NULL REFERENCES public.medibondhu_appointments(id) ON DELETE CASCADE,
      sender_id uuid NOT NULL,
      message text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  ];

  for (let i = 0; i < stmts.length; i++) {
    await runRequired(sql, `create ${i + 1}/${stmts.length}`, stmts[i]);
  }

  await addColumns(sql, "cow_weight_estimations", ["cow_name text"]);

  await addColumns(sql, "profiles", [
    "email text NOT NULL DEFAULT ''",
    "name text NOT NULL DEFAULT 'User'",
    "primary_role text NOT NULL DEFAULT 'farmer'",
    "phone text",
    "location text",
    "avatar_url text",
    "cv_url text",
    "cv_filename text",
    "cv_mime_type text",
    "cv_updated_at timestamptz",
    "status text NOT NULL DEFAULT 'active'",
    "farmer_open_medibondhu boolean NOT NULL DEFAULT true",
    "signup_module text",
    "chat_notification_sound_id text",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "notifications", [
    "title text",
    "message text",
    "type text",
    "link text",
    "context text",
    "priority text NOT NULL DEFAULT 'normal'",
    "action_url text",
    "broadcast_id uuid",
    `"read" boolean NOT NULL DEFAULT false`,
    "created_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "medibondhu_doctors", [
    "medical_reg_number text",
    "registration_body text",
    `verification_documents jsonb NOT NULL DEFAULT '[]'::jsonb`,
  ]);

  await addColumns(sql, "medibondhu_appointments", [
    "talk_started_at timestamptz",
    "talk_ended_at timestamptz",
    "leave_deadline_at timestamptz",
    "left_user_id uuid",
  ]);

  await addColumns(sql, "medibondhu_prescriptions", [
    "prescription_code text",
  ]);

  await addColumns(sql, "community_posts", [
    "post_intent text NOT NULL DEFAULT 'general'",
    "post_type text NOT NULL DEFAULT 'question'",
    "title text",
    "body text",
    "category text",
    "animal_type text",
    "priority text NOT NULL DEFAULT 'normal'",
    "status text NOT NULL DEFAULT 'active'",
    "reaction_count integer NOT NULL DEFAULT 0",
    "comment_count integer NOT NULL DEFAULT 0",
    "answer_count integer NOT NULL DEFAULT 0",
    "share_count integer NOT NULL DEFAULT 0",
    "shared_post_id uuid",
    "workspace_context text[] NOT NULL DEFAULT '{}'::text[]",
    "hiring_details jsonb NOT NULL DEFAULT '{}'::jsonb",
    "link_preview jsonb",
    "attachments jsonb",
    "tags text[]",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "community_answers", [
    "is_best_answer boolean NOT NULL DEFAULT false",
    "upvote_count integer NOT NULL DEFAULT 0",
  ]);

  await addColumns(sql, "community_comments", [
    "parent_id uuid",
    "reaction_count integer NOT NULL DEFAULT 0",
  ]);

  await addColumns(sql, "community_reports", [
    "status text NOT NULL DEFAULT 'open'",
    "details jsonb DEFAULT '{}'::jsonb",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "orders", [
    "buyer_name text",
    "seller_name text",
    "items jsonb NOT NULL DEFAULT '[]'::jsonb",
    "timeline jsonb DEFAULT '[]'::jsonb",
    "estimated_delivery timestamptz",
    "estimated_delivery_note text",
    "date date",
    "return_reason text",
    "return_note text",
    "tracking_id text",
    "stock_restored boolean NOT NULL DEFAULT false",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await migrateOrdersDeliveryAddress(sql);

  await addColumns(sql, "marketplace_banners", [
    "display_seconds integer NOT NULL DEFAULT 5",
    "starts_at timestamptz",
    "ends_at timestamptz",
  ]);

  await addColumns(sql, "products", [
    "seller_name text",
    "image text",
    "rating numeric",
    "is_verified_seller boolean DEFAULT false",
    "location text",
    "original_price numeric",
    "unit text",
    "review_count integer",
    "free_delivery boolean DEFAULT false",
    "delivery_charge_dhaka integer",
    "delivery_charge_outside integer",
    "is_flash_sale boolean DEFAULT false",
    "flash_sale_end timestamptz",
    "flash_sale_request_status text",
    "flash_sale_requested_at timestamptz",
    "flash_sale_requested_original_price numeric",
    "flash_sale_request_notes text",
    "flash_sale_reviewed_at timestamptz",
    "flash_sale_reviewed_by uuid",
    "flash_sale_review_notes text",
    "wholesale_price numeric",
    "wholesale_min_qty integer",
    "wholesale_rule text DEFAULT 'quantity'",
    "wholesale_min_order_bdt numeric",
    "listing_status text NOT NULL DEFAULT 'pending_review'",
    "listing_review_notes text",
    "listing_reviewed_by uuid",
    "listing_reviewed_at timestamptz",
    "listing_submitted_at timestamptz",
    "shop_pin_order integer",
    "shop_sort_order integer NOT NULL DEFAULT 0",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "consultation_bookings", [
    "patient_mock_id uuid",
    "vet_id uuid",
    "vet_user_id uuid",
    "vet_mock_id uuid",
    "vet_name text",
    "patient_name text",
    "booking_type text",
    "consultation_method text",
    "scheduled_date text",
    "scheduled_time text",
    "animal_type text",
    "animal_age text",
    "animal_gender text",
    "symptoms text",
    "additional_notes text",
    "payment_status text",
    "payment_amount numeric",
    "fee numeric",
    "request_notes text",
    "scheduled_at timestamptz",
    "completed_at timestamptz",
    "leave_deadline_at timestamptz",
    "left_user_id uuid",
    "status text NOT NULL DEFAULT 'pending'",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "vetbondhu_consultation_reviews", [
    "booking_id uuid NOT NULL",
    "patient_user_id uuid NOT NULL",
    "vet_user_id uuid NOT NULL",
    "vet_mock_id uuid",
    "rating integer NOT NULL DEFAULT 5",
    "comment text",
    "deleted_at timestamptz",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await runOptional(
    sql,
    "backfill consultation_bookings.vet_user_id from vets",
    `UPDATE public.consultation_bookings b
     SET vet_user_id = v.user_id
     FROM public.vets v
     WHERE b.vet_user_id IS NULL
       AND b.vet_mock_id IS NOT NULL
       AND v.id = b.vet_mock_id
       AND v.user_id IS NOT NULL`
  );

  await addColumns(sql, "consultation_messages", [
    "booking_id uuid NOT NULL",
    "sender_id uuid NOT NULL",
    "sender_name text",
    "message text",
    "body text",
    "attachment_url text",
    "created_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "approval_requests", [
    "request_type text",
    "status text NOT NULL DEFAULT 'pending'",
    "details jsonb DEFAULT '{}'::jsonb",
    "payload jsonb DEFAULT '{}'::jsonb",
    "review_notes text",
    "notes text",
    "reviewed_by uuid",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "shops", [
    "location text",
    "status text DEFAULT 'approved'",
    "total_products integer DEFAULT 0",
    "total_sales numeric DEFAULT 0",
    "is_verified boolean DEFAULT false",
    "verified_at timestamptz",
    "verified_by uuid",
    "created_date timestamptz DEFAULT now()",
  ]);

  await addColumns(sql, "conversations", [
    "last_message text",
    "last_message_at timestamptz",
    "last_sender_id uuid",
    "last_sender_role text",
    "updated_at timestamptz NOT NULL DEFAULT now()",
    "conversation_kind text NOT NULL DEFAULT 'marketplace'",
    "support_topic text",
    "support_status text DEFAULT 'open'",
  ]);

  await repairMisclassifiedSupportConversations(sql);
  await repairSupportShopNameOverwrite(sql);

  await runOptional(
    sql,
    "marketplace_conversation_reports conversation_id index",
    `CREATE INDEX IF NOT EXISTS idx_marketplace_conversation_reports_conversation_id
     ON public.marketplace_conversation_reports (conversation_id)`
  );
  await runOptional(
    sql,
    "marketplace_conversation_reports status index",
    `CREATE INDEX IF NOT EXISTS idx_marketplace_conversation_reports_status_created
     ON public.marketplace_conversation_reports (status, created_at DESC)`
  );
  await runOptional(
    sql,
    "marketplace_product_reviews product index",
    `CREATE INDEX IF NOT EXISTS idx_marketplace_product_reviews_product_created
     ON public.marketplace_product_reviews (product_id, created_at DESC)
     WHERE deleted_at IS NULL`
  );
  await runOptional(
    sql,
    "marketplace_product_reviews buyer index",
    `CREATE INDEX IF NOT EXISTS idx_marketplace_product_reviews_buyer
     ON public.marketplace_product_reviews (buyer_id, created_at DESC)`
  );
  await runOptional(
    sql,
    "marketplace_product_comments product index",
    `CREATE INDEX IF NOT EXISTS idx_marketplace_product_comments_product_created
     ON public.marketplace_product_comments (product_id, created_at DESC)
     WHERE deleted_at IS NULL`
  );

  await addColumns(sql, "marketplace_product_reviews", [
    "seller_reply text",
    "seller_reply_at timestamptz",
    "seller_reply_updated_at timestamptz",
  ]);
  await addColumns(sql, "marketplace_product_comments", [
    "parent_id uuid",
  ]);
  await runOptional(
    sql,
    "marketplace_product_comments parent fk",
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_product_comments_parent_id_fkey'
      ) THEN
        ALTER TABLE public.marketplace_product_comments
          ADD CONSTRAINT marketplace_product_comments_parent_id_fkey
          FOREIGN KEY (parent_id) REFERENCES public.marketplace_product_comments(id) ON DELETE CASCADE;
      END IF;
    END $$;`
  );
  await runOptional(
    sql,
    "marketplace_product_comments parent index",
    `CREATE INDEX IF NOT EXISTS idx_marketplace_product_comments_product_parent_created
     ON public.marketplace_product_comments (product_id, parent_id, created_at DESC)
     WHERE deleted_at IS NULL`
  );
  await runOptional(
    sql,
    "marketplace_product_reviews seller index",
    `CREATE INDEX IF NOT EXISTS idx_marketplace_product_reviews_seller_created
     ON public.marketplace_product_reviews (seller_id, created_at DESC)
     WHERE deleted_at IS NULL`
  );

  await addColumns(sql, "chat_messages", [
    "sender_role text NOT NULL DEFAULT 'buyer'",
    "message_type text NOT NULL DEFAULT 'text'",
    "text_body text",
    "shared_product_id uuid",
    "body text",
    "attachment_url text",
    "\"read\" boolean NOT NULL DEFAULT false",
    "buyer_delivered_at timestamptz",
    "buyer_read_at timestamptz",
    "seller_delivered_at timestamptz",
    "seller_read_at timestamptz",
    "created_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "vets", [
    "user_id uuid",
    "full_name text",
    "phone text",
    "email text",
    "district text",
    "address text",
    "specialization text",
    "experience_years integer",
    "animal_types text[]",
    "experience integer",
    "fee numeric",
    "available boolean NOT NULL DEFAULT true",
    "avatar text",
    "degree text",
    "consultation_fee numeric",
    "profile_image_url text",
    "verification_document_url text",
    "verification_status text NOT NULL DEFAULT 'pending'",
    "rejection_reason text",
    "verified_by uuid",
    "verified_at timestamptz",
    "vetbondhu_status text NOT NULL DEFAULT 'active'",
    "vetbondhu_deleted_at timestamptz",
    "last_seen_at timestamptz",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "vet_profiles", [
    "user_id uuid",
    "full_name text",
    "phone text",
    "email text",
    "district text",
    "address text",
    "specialization text",
    "degree text",
    "experience_years integer",
    "consultation_fee numeric",
    "profile_image_url text",
    "verification_document_url text",
    "verification_status text NOT NULL DEFAULT 'pending'",
    "rejection_reason text",
    "verified_by uuid",
    "verified_at timestamptz",
    "vetbondhu_status text NOT NULL DEFAULT 'active'",
    "vetbondhu_deleted_at timestamptz",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await runOptional(
    sql,
    "ensure vet_profiles user_id unique index",
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_vet_profiles_user_id ON public.vet_profiles (user_id)`
  );

  await runOptional(
    sql,
    "backfill vets.fee",
    `UPDATE public.vets SET fee = consultation_fee WHERE fee IS NULL AND consultation_fee IS NOT NULL`
  );

  await runOptional(
    sql,
    "backfill vets.experience_years",
    `UPDATE public.vets
     SET experience_years = COALESCE(experience_years, experience, 0)
     WHERE experience_years IS NULL`
  );

  await runOptional(
    sql,
    "backfill vet_profiles from vets",
    `INSERT INTO public.vet_profiles (
       id, user_id, full_name, phone, email, district, address, specialization, degree,
       experience_years, consultation_fee, profile_image_url, verification_document_url,
       verification_status, rejection_reason, verified_by, verified_at, created_at, updated_at
     )
     SELECT
       COALESCE(v.user_id, v.id),
       COALESCE(v.user_id, v.id),
       COALESCE(NULLIF(TRIM(v.full_name), ''), NULLIF(TRIM(v.name), ''), 'Vet Doctor'),
       NULLIF(TRIM(v.phone), ''),
       NULLIF(TRIM(v.email), ''),
       COALESCE(NULLIF(TRIM(v.district), ''), NULLIF(TRIM(v.location), '')),
       COALESCE(NULLIF(TRIM(v.address), ''), NULLIF(TRIM(v.location), '')),
       COALESCE(NULLIF(TRIM(v.specialization), ''), 'General Veterinary'),
       COALESCE(NULLIF(TRIM(v.degree), ''), 'Veterinary Professional'),
       COALESCE(v.experience_years, v.experience, 0),
       COALESCE(v.consultation_fee, v.fee, 500),
       COALESCE(NULLIF(TRIM(v.profile_image_url), ''), NULLIF(TRIM(v.avatar), '')),
       NULLIF(TRIM(v.verification_document_url), ''),
       COALESCE(NULLIF(TRIM(v.verification_status), ''), 'pending'),
       NULLIF(TRIM(v.rejection_reason), ''),
       v.verified_by,
       v.verified_at,
       COALESCE(v.created_at, now()),
       COALESCE(v.updated_at, now())
     FROM public.vets v
     WHERE COALESCE(v.user_id, v.id) IS NOT NULL
     ON CONFLICT (user_id) DO UPDATE SET
       full_name = COALESCE(EXCLUDED.full_name, vet_profiles.full_name),
       phone = COALESCE(EXCLUDED.phone, vet_profiles.phone),
       email = COALESCE(EXCLUDED.email, vet_profiles.email),
       district = COALESCE(EXCLUDED.district, vet_profiles.district),
       address = COALESCE(EXCLUDED.address, vet_profiles.address),
       specialization = COALESCE(EXCLUDED.specialization, vet_profiles.specialization),
       degree = COALESCE(EXCLUDED.degree, vet_profiles.degree),
       experience_years = COALESCE(EXCLUDED.experience_years, vet_profiles.experience_years),
       consultation_fee = COALESCE(EXCLUDED.consultation_fee, vet_profiles.consultation_fee),
       profile_image_url = COALESCE(EXCLUDED.profile_image_url, vet_profiles.profile_image_url),
       verification_document_url = COALESCE(EXCLUDED.verification_document_url, vet_profiles.verification_document_url),
       verification_status = COALESCE(EXCLUDED.verification_status, vet_profiles.verification_status),
       rejection_reason = EXCLUDED.rejection_reason,
       verified_by = EXCLUDED.verified_by,
       verified_at = EXCLUDED.verified_at,
       updated_at = now()`
  );

  await runOptional(
    sql,
    "normalize vet_profiles defaults",
    `UPDATE public.vet_profiles vp
     SET
       full_name = COALESCE(NULLIF(TRIM(vp.full_name), ''), NULLIF(TRIM(p.name), ''), SPLIT_PART(COALESCE(p.email, ''), '@', 1), 'Vet Doctor'),
       phone = COALESCE(NULLIF(TRIM(vp.phone), ''), NULLIF(TRIM(p.phone), '')),
       email = COALESCE(NULLIF(TRIM(vp.email), ''), NULLIF(TRIM(p.email), '')),
       district = COALESCE(NULLIF(TRIM(vp.district), ''), NULLIF(TRIM(p.location), ''), 'Bangladesh'),
       address = COALESCE(NULLIF(TRIM(vp.address), ''), NULLIF(TRIM(p.location), ''), 'Bangladesh'),
       specialization = COALESCE(NULLIF(TRIM(vp.specialization), ''), 'General Veterinary'),
       degree = COALESCE(NULLIF(TRIM(vp.degree), ''), 'Veterinary Professional'),
       experience_years = COALESCE(vp.experience_years, 0),
       consultation_fee = COALESCE(vp.consultation_fee, 500),
       verification_status = COALESCE(NULLIF(TRIM(vp.verification_status), ''), 'pending'),
       updated_at = now()
     FROM public.profiles p
     WHERE p.id = vp.user_id`
  );

  await runOptional(
    sql,
    "normalize existing vets defaults",
    `UPDATE public.vets v
     SET
       name = COALESCE(NULLIF(TRIM(v.name), ''), NULLIF(TRIM(p.name), ''), SPLIT_PART(COALESCE(p.email, ''), '@', 1), 'Vet Doctor'),
       specialization = COALESCE(NULLIF(TRIM(v.specialization), ''), 'General Veterinary'),
       full_name = COALESCE(NULLIF(TRIM(v.full_name), ''), NULLIF(TRIM(v.name), ''), NULLIF(TRIM(p.name), ''), SPLIT_PART(COALESCE(p.email, ''), '@', 1), 'Vet Doctor'),
       phone = COALESCE(NULLIF(TRIM(v.phone), ''), NULLIF(TRIM(p.phone), '')),
       email = COALESCE(NULLIF(TRIM(v.email), ''), NULLIF(TRIM(p.email), '')),
       district = COALESCE(NULLIF(TRIM(v.district), ''), NULLIF(TRIM(p.location), '')),
       address = COALESCE(NULLIF(TRIM(v.address), ''), NULLIF(TRIM(p.location), '')),
       animal_types = COALESCE(v.animal_types, ARRAY[]::text[]),
       experience = COALESCE(v.experience, 0),
       experience_years = COALESCE(v.experience_years, v.experience, 0),
       fee = COALESCE(v.fee, v.consultation_fee, 500),
       consultation_fee = COALESCE(v.consultation_fee, v.fee, 500),
       location = COALESCE(NULLIF(TRIM(v.location), ''), NULLIF(TRIM(p.location), ''), 'Bangladesh'),
       available = COALESCE(v.available, true),
       avatar = COALESCE(v.avatar, ''),
       profile_image_url = COALESCE(v.profile_image_url, v.avatar, ''),
       degree = COALESCE(NULLIF(TRIM(v.degree), ''), 'Veterinary Professional'),
       verification_status = COALESCE(NULLIF(TRIM(v.verification_status), ''), 'pending'),
       updated_at = now()
     FROM public.profiles p
     WHERE p.id = COALESCE(v.user_id, v.id)`
  );

  await runOptional(
    sql,
    "backfill vets rows for vet-role users",
    `INSERT INTO public.vets (
       id, user_id, name, specialization, animal_types, experience, fee, location, available, avatar, degree, created_at, updated_at
     )
     SELECT
       p.id,
       p.id,
       COALESCE(NULLIF(TRIM(p.name), ''), SPLIT_PART(COALESCE(p.email, ''), '@', 1), 'Vet Doctor'),
       'General Veterinary',
       ARRAY[]::text[],
       0,
       500,
       COALESCE(NULLIF(TRIM(p.location), ''), 'Bangladesh'),
       true,
       '',
       'Veterinary Professional',
       now(),
       now()
     FROM public.profiles p
     WHERE (
       p.primary_role = 'vet'
       OR EXISTS (
         SELECT 1
         FROM public.user_roles ur
         WHERE ur.user_id = p.id
           AND ur.role = 'vet'
       )
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.vets v
       WHERE v.user_id = p.id OR v.id = p.id
     )`
  );

  await addColumns(sql, "prescriptions", [
    "consultation_id uuid",
    "vet_user_id uuid",
    "farmer_user_id uuid",
    "farmer_name text",
    "vet_name text",
    "vet_degree text",
    "vet_address text",
    "animal_type text",
    "breed text",
    "animal_gender text",
    "animal_age text",
    "animal_weight text",
    "farm_name text",
    "shed_or_pen text",
    "batch_id text",
    "animal_id text",
    "affected_count integer",
    "symptoms text",
    "clinical_findings text",
    "diagnosis text",
    "severity text",
    "feeding_advice text",
    "isolation_advice text",
    "hydration_note text",
    "care_instructions text",
    "follow_up_required boolean NOT NULL DEFAULT false",
    "follow_up_date date",
    "warning_signs text",
    "follow_up_notes text",
    "status text NOT NULL DEFAULT 'draft'",
    "prescription_code text",
    "language text NOT NULL DEFAULT 'en'",
    "notes text",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "prescription_items", [
    "prescription_id uuid NOT NULL",
    "medicine_name text",
    "medicine_type text",
    "dosage text",
    "dosage_unit text",
    "frequency text",
    "dose_pattern text",
    "timing text",
    "route text",
    "duration_days integer",
    "purpose text",
    "label text",
    "notes text",
    "created_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "e_prescriptions", [
    "patient_mock_id uuid NOT NULL",
    "vet_id uuid",
    "vet_name text",
    "advice text",
    "title text",
    "body text",
    "status text NOT NULL DEFAULT 'active'",
    "metadata jsonb DEFAULT '{}'::jsonb",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "learning_course_enrollments", [
    "payment_status text NOT NULL DEFAULT 'unpaid'",
    "payment_method text",
    "payment_reference text",
    "payment_sender text",
    "payment_amount numeric NOT NULL DEFAULT 0",
    "payment_currency text NOT NULL DEFAULT 'BDT'",
    "payment_note text",
    "payment_submitted_at timestamptz",
  ]);

  await addColumns(sql, "vet_withdrawals", [
    "vet_user_id uuid NOT NULL",
    "request_amount numeric NOT NULL",
    "gross_earnings numeric NOT NULL DEFAULT 0",
    "platform_fee numeric NOT NULL DEFAULT 0",
    "net_earnings numeric NOT NULL DEFAULT 0",
    "available_balance numeric NOT NULL DEFAULT 0",
    "status text NOT NULL DEFAULT 'pending'",
    "note text",
    "review_note text",
    "reviewed_by uuid",
    "reviewed_at timestamptz",
    "paid_at timestamptz",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "medibondhu_doctor_withdrawals", [
    "doctor_user_id uuid NOT NULL",
    "request_amount numeric NOT NULL",
    "gross_earnings numeric NOT NULL DEFAULT 0",
    "platform_fee numeric NOT NULL DEFAULT 0",
    "net_earnings numeric NOT NULL DEFAULT 0",
    "available_balance numeric NOT NULL DEFAULT 0",
    "status text NOT NULL DEFAULT 'pending'",
    "note text",
    "review_note text",
    "reviewed_by uuid",
    "reviewed_at timestamptz",
    "paid_at timestamptz",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await runOptional(
    sql,
    "prescriptions language check",
    `ALTER TABLE public.prescriptions
     ADD CONSTRAINT prescriptions_language_check
     CHECK (language IN ('en', 'bn'))`
  );

  await runOptional(
    sql,
    "vet_withdrawals status check",
    `ALTER TABLE public.vet_withdrawals
     ADD CONSTRAINT vet_withdrawals_status_check
     CHECK (status IN ('pending', 'approved', 'rejected', 'paid'))`
  );

  await runOptional(
    sql,
    "vet_withdrawals request_amount check",
    `ALTER TABLE public.vet_withdrawals
     ADD CONSTRAINT vet_withdrawals_request_amount_check
     CHECK (request_amount > 0)`
  );

  await runOptional(
    sql,
    "medibondhu_doctor_withdrawals status check",
    `ALTER TABLE public.medibondhu_doctor_withdrawals
     ADD CONSTRAINT medibondhu_doctor_withdrawals_status_check
     CHECK (status IN ('pending', 'approved', 'rejected', 'paid'))`
  );

  await runOptional(
    sql,
    "medibondhu_doctor_withdrawals request_amount check",
    `ALTER TABLE public.medibondhu_doctor_withdrawals
     ADD CONSTRAINT medibondhu_doctor_withdrawals_request_amount_check
     CHECK (request_amount > 0)`
  );

  await addColumns(sql, "seller_withdrawals", [
    "seller_user_id uuid NOT NULL",
    "request_amount numeric NOT NULL",
    "gross_earnings numeric NOT NULL DEFAULT 0",
    "platform_fee numeric NOT NULL DEFAULT 0",
    "net_earnings numeric NOT NULL DEFAULT 0",
    "available_balance numeric NOT NULL DEFAULT 0",
    "status text NOT NULL DEFAULT 'pending'",
    "note text",
    "review_note text",
    "reviewed_by uuid",
    "reviewed_at timestamptz",
    "paid_at timestamptz",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await runOptional(
    sql,
    "seller_withdrawals status check",
    `ALTER TABLE public.seller_withdrawals
     ADD CONSTRAINT seller_withdrawals_status_check
     CHECK (status IN ('pending', 'approved', 'rejected', 'paid'))`
  );

  await runOptional(
    sql,
    "seller_withdrawals request_amount check",
    `ALTER TABLE public.seller_withdrawals
     ADD CONSTRAINT seller_withdrawals_request_amount_check
     CHECK (request_amount > 0)`
  );

  await addColumns(sql, "vet_availability", [
    "user_id uuid NOT NULL",
    "day_of_week integer",
    "day text",
    "start_time text",
    "end_time text",
    "is_active boolean NOT NULL DEFAULT true",
    "slot_label text",
    "created_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await runOptional(
    sql,
    "backfill vet_availability.day_of_week",
    `UPDATE public.vet_availability
     SET day_of_week = CASE lower(trim(day))
       WHEN 'sunday' THEN 0
       WHEN 'monday' THEN 1
       WHEN 'tuesday' THEN 2
       WHEN 'wednesday' THEN 3
       WHEN 'thursday' THEN 4
       WHEN 'friday' THEN 5
       WHEN 'saturday' THEN 6
       ELSE NULL
     END
     WHERE day_of_week IS NULL AND day IS NOT NULL`
  );

  await addColumns(sql, "admin_team", [
    "admin_level text",
    "added_by uuid",
  ]);

  await runOptional(
    sql,
    "backfill admin_team.admin_level",
    `UPDATE public.admin_team
     SET admin_level = admin_role
     WHERE (admin_level IS NULL OR trim(admin_level) = '')
       AND admin_role IN ('super_admin', 'co_admin', 'moderator')`
  );

  const seedPerms = `
    INSERT INTO public.role_permissions (role, permission_code) VALUES
      ('farmer', 'can_manage_farm'),
      ('farmer', 'can_manage_animals'),
      ('farmer', 'can_access_learning'),
      ('farmer', 'can_book_vet'),
      ('farmer', 'can_book_human'),
      ('farmer', 'can_buy'),
      ('farmer', 'can_access_community'),
      ('buyer', 'can_buy'),
      ('buyer', 'can_access_community'),
      ('vendor', 'can_sell'),
      ('vendor', 'can_manage_orders'),
      ('vendor', 'can_manage_store'),
      ('vendor', 'can_buy'),
      ('vendor', 'can_access_community'),
      ('doctor', 'can_practice_human'),
      ('doctor', 'can_access_community'),
      ('vet', 'can_consult_as_vet'),
      ('vet', 'can_book_vet'),
      ('vet', 'can_access_community'),
      ('admin', 'can_manage_platform'),
      ('admin', 'can_approve'),
      ('admin', 'can_reject'),
      ('admin', 'can_manage_users'),
      ('admin', 'can_broadcast'),
      ('admin', 'can_view_reports')
    ON CONFLICT DO NOTHING
  `;
  await runOptional(sql, "seed role_permissions", seedPerms);

  await runOptional(
    sql,
    "vendor sell caps granted via seller lane approval only",
    `DELETE FROM public.role_permissions
     WHERE role = 'vendor' AND permission_code IN ('can_sell', 'can_manage_store')`,
  );

  await runOptional(
    sql,
    "backfill existing products listing_status approved",
    `UPDATE public.products SET listing_status = 'approved'
     WHERE listing_submitted_at IS NULL`,
  );

  await runOptional(
    sql,
    "backfill seller_lane_grants for existing sellers",
    `INSERT INTO public.seller_lane_grants (user_id, lane, status, created_at, updated_at)
     SELECT DISTINCT s.user_id, l.lane, 'approved', now(), now()
     FROM (
       SELECT user_id FROM public.user_capabilities
       WHERE capability_code = 'can_sell' AND is_enabled = true
       UNION
       SELECT user_id FROM public.user_roles WHERE role = 'vendor'
       UNION
       SELECT seller_id AS user_id FROM public.products
     ) s
     CROSS JOIN (
       VALUES
         ('medibondhu'), ('vetbondhu'), ('farm'), ('pet'), ('livestock_dairy'), ('farm_machinery')
     ) AS l(lane)
     ON CONFLICT (user_id, lane) DO NOTHING`,
  );

  await runOptional(
    sql,
    "ensure can_sell capability for lane-approved sellers",
    `INSERT INTO public.user_capabilities (user_id, capability_code, is_enabled, created_at)
     SELECT DISTINCT user_id, 'can_sell', true, now()
     FROM public.seller_lane_grants WHERE status = 'approved'
     ON CONFLICT (user_id, capability_code) DO UPDATE SET is_enabled = true`,
  );

  await runOptional(
    sql,
    "ensure can_manage_store for lane-approved sellers",
    `INSERT INTO public.user_capabilities (user_id, capability_code, is_enabled, created_at)
     SELECT DISTINCT user_id, 'can_manage_store', true, now()
     FROM public.seller_lane_grants WHERE status = 'approved'
     ON CONFLICT (user_id, capability_code) DO UPDATE SET is_enabled = true`,
  );

  await runOptional(
    sql,
    "buyer role_permissions marketplace only",
    `DELETE FROM public.role_permissions
     WHERE role = 'buyer'
       AND permission_code IN ('can_book_human', 'can_bulk_buy')`
  );

  await runOptional(
    sql,
    "seed medibondhu_specialties",
    `INSERT INTO public.medibondhu_specialties (name, slug, sort_order) VALUES
      ('General Physician', 'general-physician', 1),
      ('Cardiologist', 'cardiologist', 2),
      ('Pediatrician', 'pediatrician', 3),
      ('Gynecologist', 'gynecologist', 4),
      ('Orthopedic', 'orthopedic', 5),
      ('Dermatologist', 'dermatologist', 6),
      ('ENT', 'ent', 7),
      ('Psychiatrist', 'psychiatrist', 8),
      ('Neurologist', 'neurologist', 9)
    ON CONFLICT (slug) DO NOTHING`
  );

  const idx = [
    `CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_email_audit_log_created_at ON public.email_audit_log (created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_email_audit_log_type ON public.email_audit_log (email_type, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_farms_user_id ON public.farms (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_animals_user_id ON public.animals (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_production_records_user_date ON public.production_records (user_id, date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_financial_records_user_date ON public.financial_records (user_id, date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_health_records_user_date ON public.health_records (user_id, date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_sale_records_user_date ON public.sale_records (user_id, date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_memos_user_date ON public.sales_memos (user_id, memo_date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_mortality_records_user_date ON public.mortality_records (user_id, date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_animals_farm_id ON public.animals (farm_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cow_weight_estimations_user ON public.cow_weight_estimations (user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_cow_detection_feedback_user ON public.cow_detection_feedback (user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_community_posts_status ON public.community_posts (status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_community_posts_category_created ON public.community_posts (category, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_community_posts_animal_created ON public.community_posts (animal_type, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_community_posts_workspace_context ON public.community_posts USING gin (workspace_context)`,
    `CREATE INDEX IF NOT EXISTS idx_community_posts_search_doc ON public.community_posts USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, '') || ' ' || coalesce(category, '') || ' ' || coalesce(animal_type, '') || ' ' || coalesce(array_to_string(tags, ' '), '')))`,
    `CREATE INDEX IF NOT EXISTS idx_community_posts_title_trgm ON public.community_posts USING gin (lower(coalesce(title, '')) gin_trgm_ops)`,
    `CREATE INDEX IF NOT EXISTS idx_community_posts_body_trgm ON public.community_posts USING gin (lower(coalesce(body, '')) gin_trgm_ops)`,
    `CREATE INDEX IF NOT EXISTS idx_community_posts_intent_created ON public.community_posts (post_intent, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_community_comments_post_parent_created ON public.community_comments (post_id, parent_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_community_comments_user_created ON public.community_comments (user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_community_comment_reactions_comment ON public.community_comment_reactions (comment_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_community_comment_reactions_user ON public.community_comment_reactions (user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_community_hiring_interests_post ON public.community_hiring_interests (post_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_community_hiring_interests_owner ON public.community_hiring_interests (owner_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_community_hiring_interests_user ON public.community_hiring_interests (interested_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders (buyer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_seller ON public.orders (seller_id)`,
    `CREATE INDEX IF NOT EXISTS idx_products_seller ON public.products (seller_id)`,
    `CREATE INDEX IF NOT EXISTS idx_marketing_design_drafts_user ON public.marketing_design_drafts (user_id, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_products_listing_status ON public.products (listing_status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_seller_lane_grants_status ON public.seller_lane_grants (status, lane)`,
    `CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON public.user_addresses (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vets_user_id ON public.vets (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vets_available ON public.vets (available, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_vetbondhu_restrictions_status ON public.vetbondhu_user_restrictions (subject_type, status, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_vetbondhu_restrictions_user ON public.vetbondhu_user_restrictions (user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_restrictions_status ON public.medibondhu_user_restrictions (subject_type, status, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_restrictions_user ON public.medibondhu_user_restrictions (user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_bookings_patient ON public.consultation_bookings (patient_mock_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_bookings_vet_user ON public.consultation_bookings (vet_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_bookings_status ON public.consultation_bookings (status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_bookings_vet_status_created ON public.consultation_bookings (vet_user_id, status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_bookings_patient_status_created ON public.consultation_bookings (patient_mock_id, status, created_at DESC)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_vetbondhu_reviews_booking_unique ON public.vetbondhu_consultation_reviews (booking_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS idx_vetbondhu_reviews_patient ON public.vetbondhu_consultation_reviews (patient_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_vetbondhu_reviews_vet_user ON public.vetbondhu_consultation_reviews (vet_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_vetbondhu_reviews_vet_mock ON public.vetbondhu_consultation_reviews (vet_mock_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_messages_booking ON public.consultation_messages (booking_id, created_at ASC)`,
    `CREATE INDEX IF NOT EXISTS idx_vet_availability_user_day ON public.vet_availability (user_id, day_of_week, start_time)`,
    `CREATE INDEX IF NOT EXISTS idx_prescriptions_vet ON public.prescriptions (vet_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_prescriptions_farmer ON public.prescriptions (farmer_user_id, created_at DESC)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_prescriptions_code_unique ON public.prescriptions (prescription_code) WHERE prescription_code IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON public.prescription_items (prescription_id, created_at ASC)`,
    `CREATE INDEX IF NOT EXISTS idx_e_prescriptions_patient ON public.e_prescriptions (patient_mock_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_vet_withdrawals_vet ON public.vet_withdrawals (vet_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_vet_withdrawals_status ON public.vet_withdrawals (status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_doctor_withdrawals_doctor ON public.medibondhu_doctor_withdrawals (doctor_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_doctor_withdrawals_status ON public.medibondhu_doctor_withdrawals (status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_seller_withdrawals_seller ON public.seller_withdrawals (seller_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_seller_withdrawals_status ON public.seller_withdrawals (status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_specialties_active ON public.medibondhu_specialties (is_active, sort_order)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_doctors_specialty ON public.medibondhu_doctors (specialty_id, approval_status)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_doctors_user ON public.medibondhu_doctors (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_slots_doctor_date ON public.medibondhu_doctor_time_slots (doctor_id, slot_date, booked)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_appointments_patient ON public.medibondhu_appointments (patient_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_appointments_doctor ON public.medibondhu_appointments (doctor_id, status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_prescriptions_patient ON public.medibondhu_prescriptions (patient_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_prescriptions_doctor ON public.medibondhu_prescriptions (doctor_id, created_at DESC)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_medibondhu_prescriptions_code_unique ON public.medibondhu_prescriptions (prescription_code) WHERE prescription_code IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_appointment_messages_appt ON public.medibondhu_appointment_messages (appointment_id, created_at ASC)`,
  ];
  for (let i = 0; i < idx.length; i++) {
    await runOptional(sql, `index ${i + 1}`, idx[i]);
  }

  await runOptional(
    sql,
    "backfill prescriptions.prescription_code",
    `WITH candidates AS (
       SELECT id, upper(right(replace(id::text, '-', ''), 6)) AS code
       FROM public.prescriptions
       WHERE prescription_code IS NULL OR trim(prescription_code) = ''
     ),
     unique_candidates AS (
       SELECT c.id, c.code
       FROM candidates c
       WHERE (SELECT count(*) FROM candidates d WHERE d.code = c.code) = 1
     )
     UPDATE public.prescriptions p
     SET prescription_code = u.code
     FROM unique_candidates u
     WHERE p.id = u.id
       AND NOT EXISTS (
         SELECT 1 FROM public.prescriptions existing
         WHERE existing.prescription_code = u.code
           AND existing.id <> p.id
       )`
  );

  await runOptional(
    sql,
    "backfill medibondhu_prescriptions.prescription_code",
    `WITH candidates AS (
       SELECT id, upper(right(replace(id::text, '-', ''), 6)) AS code
       FROM public.medibondhu_prescriptions
       WHERE prescription_code IS NULL OR trim(prescription_code) = ''
     ),
     unique_candidates AS (
       SELECT c.id, c.code
       FROM candidates c
       WHERE (SELECT count(*) FROM candidates d WHERE d.code = c.code) = 1
     )
     UPDATE public.medibondhu_prescriptions p
     SET prescription_code = u.code
     FROM unique_candidates u
     WHERE p.id = u.id
       AND NOT EXISTS (
         SELECT 1 FROM public.medibondhu_prescriptions existing
         WHERE existing.prescription_code = u.code
           AND existing.id <> p.id
       )`
  );

  /** MediBondhu slots: align `slot_date` with Bangladesh calendar derived from `slot_start` so patient booking matches `/doctors/:id/slots`. */
  await runOptional(
    sql,
    "medi backfill doctor_time_slots.slot_date",
    `UPDATE medibondhu_doctor_time_slots SET slot_date = ((slot_start AT TIME ZONE 'Asia/Dhaka')::date)
     WHERE slot_date IS DISTINCT FROM ((slot_start AT TIME ZONE 'Asia/Dhaka')::date)`,
  );

  /** Multi-patient windows: legacy rows marked booked=true no longer block patient booking. */
  await runOptional(
    sql,
    "medi reset doctor_time_slots.booked",
    `UPDATE medibondhu_doctor_time_slots SET booked = false WHERE booked = true`,
  );

  /** Backfill shops from approved shop_access requests (shop name was only in approval_requests). */
  await runOptional(
    sql,
    "shops backfill from approved shop_access",
    `INSERT INTO shops (user_id, shop_name, description, updated_at)
     SELECT DISTINCT ON (ar.user_id)
       ar.user_id,
       trim(coalesce(ar.details->>'shopName', ar.payload->>'shopName', '')),
       nullif(trim(coalesce(ar.details->>'description', ar.payload->>'description', '')), ''),
       now()
     FROM approval_requests ar
     WHERE ar.request_type = 'shop_access'
       AND ar.status = 'approved'
       AND trim(coalesce(ar.details->>'shopName', ar.payload->>'shopName', '')) <> ''
       AND NOT EXISTS (SELECT 1 FROM shops s WHERE s.user_id = ar.user_id)
     ORDER BY ar.user_id, ar.updated_at DESC
     ON CONFLICT (user_id) DO NOTHING`,
  );

  await runOptional(
    sql,
    "backfill profiles.signup_module for care-only vetbondhu users",
    `UPDATE public.profiles p
     SET signup_module = 'vetbondhu', updated_at = now()
     WHERE p.signup_module IS NULL
       AND EXISTS (
         SELECT 1 FROM public.user_capabilities uc
         WHERE uc.user_id = p.id AND uc.capability_code = 'can_book_vet' AND uc.is_enabled = true
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.user_capabilities uc
         WHERE uc.user_id = p.id AND uc.capability_code = 'can_manage_farm' AND uc.is_enabled = true
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.user_roles ur
         JOIN public.role_permissions rp ON rp.role = ur.role
         WHERE ur.user_id = p.id AND rp.permission_code = 'can_manage_farm'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = p.id AND ur.role = 'vet'
       )`,
  );

  await runOptional(
    sql,
    "backfill profiles.signup_module for care-only medibondhu users",
    `UPDATE public.profiles p
     SET signup_module = 'medibondhu', updated_at = now()
     WHERE p.signup_module IS NULL
       AND EXISTS (
         SELECT 1 FROM public.user_capabilities uc
         WHERE uc.user_id = p.id AND uc.capability_code = 'can_book_human' AND uc.is_enabled = true
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.user_capabilities uc
         WHERE uc.user_id = p.id AND uc.capability_code = 'can_manage_farm' AND uc.is_enabled = true
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.user_roles ur
         JOIN public.role_permissions rp ON rp.role = ur.role
         WHERE ur.user_id = p.id AND rp.permission_code = 'can_manage_farm'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = p.id AND ur.role IN ('doctor', 'vet')
       )`,
  );

  await runOptional(
    sql,
    "repair profiles.signup_module for farmers mislabeled as care-only patients",
    `UPDATE public.profiles p
     SET signup_module = 'farm', updated_at = now()
     WHERE p.signup_module IN ('medibondhu', 'vetbondhu')
       AND EXISTS (
         SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = p.id AND ur.role = 'farmer'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.user_capabilities uc
         WHERE uc.user_id = p.id
           AND uc.capability_code = 'can_manage_farm'
           AND uc.is_enabled = false
       )`,
  );

  await runOptional(
    sql,
    "re-enable learning for vetbondhu signup users",
    `INSERT INTO public.user_capabilities (user_id, capability_code, is_enabled, created_at)
     SELECT p.id, 'can_access_learning', true, now()
     FROM public.profiles p
     WHERE p.signup_module = 'vetbondhu'
     ON CONFLICT (user_id, capability_code) DO UPDATE SET is_enabled = true`,
  );

  await runOptional(
    sql,
    "re-enable learning for care-only can_book_vet users",
    `INSERT INTO public.user_capabilities (user_id, capability_code, is_enabled, created_at)
     SELECT p.id, 'can_access_learning', true, now()
     FROM public.profiles p
     WHERE EXISTS (
         SELECT 1 FROM public.user_capabilities uc
         WHERE uc.user_id = p.id AND uc.capability_code = 'can_book_vet' AND uc.is_enabled = true
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.user_capabilities uc
         WHERE uc.user_id = p.id AND uc.capability_code = 'can_manage_farm' AND uc.is_enabled = true
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = p.id AND ur.role = 'vet'
       )
     ON CONFLICT (user_id, capability_code) DO UPDATE SET is_enabled = true`,
  );

  await runOptional(
    sql,
    "repair vetbondhu module caps on existing accounts",
    `INSERT INTO public.user_capabilities (user_id, capability_code, is_enabled, created_at)
     SELECT p.id, v.capability_code, v.is_enabled, now()
     FROM public.profiles p
     CROSS JOIN (
       VALUES
         ('can_book_vet', true),
         ('can_access_learning', true),
         ('can_book_human', false),
         ('can_manage_farm', false),
         ('can_manage_animals', false),
         ('can_buy', false)
     ) AS v(capability_code, is_enabled)
     WHERE p.signup_module = 'vetbondhu'
     ON CONFLICT (user_id, capability_code) DO UPDATE SET is_enabled = excluded.is_enabled`,
  );

  console.log("[ensureSchema] public tables and indexes checked");
}
