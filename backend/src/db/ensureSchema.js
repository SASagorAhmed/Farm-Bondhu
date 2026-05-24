/**
 * Bootstrap public schema when tables are missing (local dev, new DB, or partial Supabase).
 * Safe to run repeatedly: IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.
 * Disable with AUTO_CREATE_SCHEMA=false (e.g. production where migrations own DDL).
 */

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

/** @param {import("postgres").Sql} sql */
export async function ensureSchema(sql) {
  await runOptional(
    sql,
    "extension pgcrypto",
    `CREATE EXTENSION IF NOT EXISTS pgcrypto`
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

    `CREATE TABLE IF NOT EXISTS public.orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_id uuid NOT NULL,
      seller_id uuid NOT NULL,
      buyer_name text,
      seller_name text,
      items jsonb NOT NULL DEFAULT '[]'::jsonb,
      total numeric NOT NULL DEFAULT 0,
      shipping_fee numeric DEFAULT 0,
      delivery_address text,
      payment_method text,
      payment_status text,
      timeline jsonb DEFAULT '[]'::jsonb,
      estimated_delivery timestamptz,
      status text NOT NULL DEFAULT 'pending',
      date date,
      return_reason text,
      return_note text,
      tracking_id text,
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

    `CREATE TABLE IF NOT EXISTS public.community_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
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
      body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
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

    `CREATE TABLE IF NOT EXISTS public.conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_id uuid NOT NULL,
      seller_id uuid NOT NULL,
      product_id uuid NOT NULL,
      last_message_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS public.chat_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL,
      sender_id uuid NOT NULL,
      body text,
      attachment_url text,
      "read" boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
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
    "farmer_open_medibondhu boolean NOT NULL DEFAULT true",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "notifications", [
    "title text",
    "message text",
    "type text",
    "link text",
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
  ]);

  await addColumns(sql, "community_posts", [
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
    "date date",
    "return_reason text",
    "return_note text",
    "tracking_id text",
    "created_at timestamptz NOT NULL DEFAULT now()",
    "updated_at timestamptz NOT NULL DEFAULT now()",
  ]);

  await addColumns(sql, "products", [
    "seller_name text",
    "image text",
    "rating numeric",
    "is_verified_seller boolean DEFAULT false",
    "location text",
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
    "experience_years integer",
    "consultation_fee numeric",
    "profile_image_url text",
    "verification_document_url text",
    "verification_status text NOT NULL DEFAULT 'pending'",
    "rejection_reason text",
    "verified_by uuid",
    "verified_at timestamptz",
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
       id, user_id, full_name, phone, email, district, address, specialization,
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
       degree = COALESCE(NULLIF(TRIM(v.degree), ''), 'DVM'),
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
       'DVM',
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
      ('buyer', 'can_buy'),
      ('buyer', 'can_book_human'),
      ('buyer', 'can_bulk_buy'),
      ('vendor', 'can_sell'),
      ('vendor', 'can_manage_orders'),
      ('vendor', 'can_manage_store'),
      ('vendor', 'can_buy'),
      ('doctor', 'can_practice_human'),
      ('vet', 'can_consult_as_vet'),
      ('vet', 'can_book_vet'),
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
    `CREATE INDEX IF NOT EXISTS idx_farms_user_id ON public.farms (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_animals_user_id ON public.animals (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_production_records_user_date ON public.production_records (user_id, date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_financial_records_user_date ON public.financial_records (user_id, date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_health_records_user_date ON public.health_records (user_id, date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_sale_records_user_date ON public.sale_records (user_id, date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_mortality_records_user_date ON public.mortality_records (user_id, date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_animals_farm_id ON public.animals (farm_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cow_weight_estimations_user ON public.cow_weight_estimations (user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_cow_detection_feedback_user ON public.cow_detection_feedback (user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_community_posts_status ON public.community_posts (status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders (buyer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_seller ON public.orders (seller_id)`,
    `CREATE INDEX IF NOT EXISTS idx_products_seller ON public.products (seller_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vets_user_id ON public.vets (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vets_available ON public.vets (available, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_bookings_patient ON public.consultation_bookings (patient_mock_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_bookings_vet_user ON public.consultation_bookings (vet_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_bookings_status ON public.consultation_bookings (status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_bookings_vet_status_created ON public.consultation_bookings (vet_user_id, status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_bookings_patient_status_created ON public.consultation_bookings (patient_mock_id, status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_messages_booking ON public.consultation_messages (booking_id, created_at ASC)`,
    `CREATE INDEX IF NOT EXISTS idx_vet_availability_user_day ON public.vet_availability (user_id, day_of_week, start_time)`,
    `CREATE INDEX IF NOT EXISTS idx_prescriptions_vet ON public.prescriptions (vet_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_prescriptions_farmer ON public.prescriptions (farmer_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON public.prescription_items (prescription_id, created_at ASC)`,
    `CREATE INDEX IF NOT EXISTS idx_e_prescriptions_patient ON public.e_prescriptions (patient_mock_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_vet_withdrawals_vet ON public.vet_withdrawals (vet_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_vet_withdrawals_status ON public.vet_withdrawals (status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_doctor_withdrawals_doctor ON public.medibondhu_doctor_withdrawals (doctor_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_doctor_withdrawals_status ON public.medibondhu_doctor_withdrawals (status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_specialties_active ON public.medibondhu_specialties (is_active, sort_order)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_doctors_specialty ON public.medibondhu_doctors (specialty_id, approval_status)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_doctors_user ON public.medibondhu_doctors (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_slots_doctor_date ON public.medibondhu_doctor_time_slots (doctor_id, slot_date, booked)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_appointments_patient ON public.medibondhu_appointments (patient_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_appointments_doctor ON public.medibondhu_appointments (doctor_id, status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_prescriptions_patient ON public.medibondhu_prescriptions (patient_user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_prescriptions_doctor ON public.medibondhu_prescriptions (doctor_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_medibondhu_appointment_messages_appt ON public.medibondhu_appointment_messages (appointment_id, created_at ASC)`,
  ];
  for (let i = 0; i < idx.length; i++) {
    await runOptional(sql, `index ${i + 1}`, idx[i]);
  }

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

  console.log("[ensureSchema] public tables and indexes checked");
}
