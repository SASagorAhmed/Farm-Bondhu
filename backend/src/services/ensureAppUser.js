import sql from "../db.js";

const APP_ROLES = new Set(["farmer", "buyer", "vendor", "vet", "admin"]);

function normalizeRole(raw) {
  const r = String(raw || "farmer").toLowerCase();
  return APP_ROLES.has(r) ? r : "farmer";
}

function nonEmptyString(value) {
  const v = value == null ? "" : String(value).trim();
  return v ? v : null;
}

/**
 * @param {{
 *  userId: string;
 *  fullName: string;
 *  email: string;
 *  phone: string | null;
 *  district: string;
 *  address: string | null;
 *  specialization: string;
 *  experienceYears: number;
 *  consultationFee: number;
 * }} args
 */
async function ensureVetProfileAndApprovalRequest(args) {
  const {
    userId,
    fullName,
    email,
    phone,
    district,
    address,
    specialization,
    experienceYears,
    consultationFee,
  } = args;
  const [vp] = await sql`
    select id from public.vet_profiles where user_id = ${userId} or id = ${userId} limit 1
  `;
  if (!vp?.id) {
    await sql`
      insert into public.vet_profiles ${sql({
        id: userId,
        user_id: userId,
        full_name: fullName,
        phone,
        email,
        district,
        address,
        specialization,
        experience_years: experienceYears,
        consultation_fee: consultationFee,
        verification_status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })}
    `;
  }

  const [ar] = await sql`
    select id from public.approval_requests
    where user_id = ${userId} and request_type = 'vet_verification'
    order by created_at desc
    limit 1
  `;
  if (!ar?.id) {
    const nowIso = new Date().toISOString();
    await sql`
      insert into public.approval_requests ${sql({
        user_id: userId,
        request_type: "vet_verification",
        status: "pending",
        details: {
          specialization,
          experience_years: experienceYears,
          consultation_fee: consultationFee,
        },
        payload: {
          specialization,
          experience_years: experienceYears,
          consultation_fee: consultationFee,
        },
        created_at: nowIso,
        updated_at: nowIso,
      })}
    `;
  }
}

/**
 * Ensure users with vet role have a discoverable row in public.vets.
 * @param {{ id: string; email?: string; user_metadata?: Record<string, unknown> }} user
 * @param {Record<string, unknown>} signupData
 * @param {string} primaryRole
 */
async function ensureVetDirectoryRow(user, signupData, primaryRole) {
  const userId = user?.id;
  if (!userId) return;

  const [profile] = await sql`
    select id, email, name, location, primary_role
    from public.profiles
    where id = ${userId}
    limit 1
  `;
  const [vetRole] = await sql`
    select 1 as ok
    from public.user_roles
    where user_id = ${userId} and role = 'vet'
    limit 1
  `;
  const isVet = primaryRole === "vet" || profile?.primary_role === "vet" || Boolean(vetRole);
  if (!isVet) return;

  await sql`
    insert into public.user_roles ${sql({ user_id: userId, role: "vet" })}
    on conflict (user_id, role) do nothing
  `;
  await sql`
    update public.profiles
    set ${sql({ primary_role: "vet", updated_at: new Date().toISOString() })}
    where id = ${userId}
      and coalesce(lower(trim(primary_role)), '') <> 'vet'
  `;

  const meta = { ...(user.user_metadata || {}), ...(signupData || {}) };
  const email = nonEmptyString(profile?.email) || nonEmptyString(user.email) || "";
  const fallbackName = email ? email.split("@")[0] : "Vet Doctor";
  const vetName = nonEmptyString(profile?.name) || nonEmptyString(meta.name) || fallbackName;
  const vetLocation = nonEmptyString(profile?.location) || nonEmptyString(meta.location) || "Bangladesh";
  const specialization = nonEmptyString(meta.specialization) || "General Veterinary";
  const degree = nonEmptyString(meta.degree) || "DVM";
  const district = nonEmptyString(meta.district) || nonEmptyString(meta.location) || "Bangladesh";
  const address = nonEmptyString(meta.address) || nonEmptyString(meta.location) || null;
  const phone = nonEmptyString(meta.phone);
  const consultationFee =
    Number.isFinite(Number(meta.consultation_fee)) && Number(meta.consultation_fee) >= 0 ? Number(meta.consultation_fee) : 500;
  const experienceYears =
    Number.isFinite(Number(meta.experience_years)) && Number(meta.experience_years) >= 0 ? Math.floor(Number(meta.experience_years)) : 0;
  const animalTypes = Array.isArray(meta.animal_types) ? meta.animal_types.map(String).filter(Boolean) : [];

  const [existing] = await sql`
    select id
    from public.vets
    where user_id = ${userId} or id = ${userId}
    limit 1
  `;

  if (existing?.id) {
    await sql`
      update public.vets v
      set
        user_id = ${userId},
        name = coalesce(nullif(trim(v.name), ''), ${vetName}),
        full_name = coalesce(nullif(trim(v.full_name), ''), ${vetName}),
        phone = coalesce(nullif(trim(v.phone), ''), ${phone}),
        email = coalesce(nullif(trim(v.email), ''), ${email}),
        district = coalesce(nullif(trim(v.district), ''), ${district}),
        address = coalesce(nullif(trim(v.address), ''), ${address}),
        specialization = coalesce(nullif(trim(v.specialization), ''), ${specialization}),
        animal_types = coalesce(v.animal_types, ${animalTypes}),
        experience = coalesce(v.experience, ${experienceYears}),
        experience_years = coalesce(v.experience_years, v.experience, ${experienceYears}),
        fee = coalesce(v.fee, v.consultation_fee, ${consultationFee}),
        consultation_fee = coalesce(v.consultation_fee, v.fee, ${consultationFee}),
        location = coalesce(nullif(trim(v.location), ''), ${vetLocation}),
        available = coalesce(v.available, true),
        avatar = coalesce(v.avatar, ''),
        profile_image_url = coalesce(v.profile_image_url, v.avatar, ''),
        verification_status = coalesce(nullif(trim(v.verification_status), ''), 'pending'),
        degree = coalesce(nullif(trim(v.degree), ''), ${degree}),
        updated_at = now()
      where v.id = ${existing.id}
    `;
    await ensureVetProfileAndApprovalRequest({
      userId,
      fullName: vetName,
      email,
      phone,
      district,
      address,
      specialization,
      experienceYears,
      consultationFee,
    });
    return;
  }

  await sql`
    insert into public.vets (
      id, user_id, name, full_name, phone, email, district, address, specialization, animal_types,
      experience, experience_years, fee, consultation_fee, location, available, avatar, profile_image_url,
      degree, verification_status, created_at, updated_at
    )
    values (
      ${userId}, ${userId}, ${vetName}, ${vetName}, ${phone}, ${email}, ${district}, ${address}, ${specialization}, ${animalTypes},
      ${experienceYears}, ${experienceYears}, ${consultationFee}, ${consultationFee}, ${vetLocation}, true, '', '',
      ${degree}, 'pending', now(), now()
    )
  `;
  await ensureVetProfileAndApprovalRequest({
    userId,
    fullName: vetName,
    email,
    phone,
    district,
    address,
    specialization,
    experienceYears,
    consultationFee,
  });
}

/** True when the client/session explicitly sent a primary_role (sign-up / profile merge), not a bare sign-in. */
function hasExplicitPrimaryRole(signupData, userMetadata) {
  if (signupData && Object.prototype.hasOwnProperty.call(signupData, "primary_role")) return true;
  if (
    userMetadata &&
    typeof userMetadata === "object" &&
    Object.prototype.hasOwnProperty.call(userMetadata, "primary_role")
  ) {
    return true;
  }
  return false;
}

/**
 * Ensures `public.profiles` and `public.user_roles` exist for a Supabase Auth user.
 * Safe to call after sign-up or sign-in (idempotent where constraints allow).
 * @param {{ id: string; email?: string; user_metadata?: Record<string, unknown> }} user - GoTrue `user` object
 * @param {Record<string, unknown>} signupData - optional `data` from sign-up body (name, primary_role, phone, location)
 */
export async function ensureProfileAndRoleAfterAuth(user, signupData = {}) {
  if (!sql || !user?.id) return;

  const id = user.id;
  const email = typeof user.email === "string" ? user.email : "";
  const meta = { ...(user.user_metadata || {}), ...signupData };
  const name = String(meta.name || (email ? email.split("@")[0] : "User")).trim().slice(0, 200) || "User";
  const hasExplicit = hasExplicitPrimaryRole(signupData, user.user_metadata);
  const primary_role = normalizeRole(meta.primary_role);
  /** Insert default when creating a missing row without metadata (e.g. legacy); never overwrite DB role on bare sign-in. */
  const primaryForInsert = hasExplicit ? primary_role : "farmer";
  const phone = meta.phone != null && meta.phone !== "" ? String(meta.phone) : null;
  const location = meta.location != null && meta.location !== "" ? String(meta.location) : null;

  try {
    await sql`
      insert into public.profiles (id, email, name, primary_role, phone, location, created_at, updated_at)
      values (${id}, ${email}, ${name}, ${primaryForInsert}, ${phone}, ${location}, now(), now())
      on conflict (id) do update set
        email = excluded.email,
        name = case when trim(coalesce(profiles.name, '')) = '' then excluded.name else profiles.name end,
        primary_role = case when ${hasExplicit} then excluded.primary_role else profiles.primary_role end,
        phone = coalesce(excluded.phone, profiles.phone),
        location = coalesce(excluded.location, profiles.location),
        updated_at = now()
    `;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ensureAppUser] profiles upsert failed:", msg);
  }

  if (hasExplicit) {
    try {
      await sql`
        insert into public.user_roles (user_id, role)
        select ${id}, ${primary_role}
        where not exists (
          select 1 from public.user_roles ur where ur.user_id = ${id} and ur.role = ${primary_role}
        )
      `;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ensureAppUser] user_roles insert failed:", msg);
    }
  }

  try {
    await ensureVetDirectoryRow(user, signupData, primary_role);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ensureAppUser] vets upsert failed:", msg);
  }
}

/** @param {Record<string, unknown>} session - raw GoTrue session JSON */
export function extractUserFromSession(session) {
  if (!session || typeof session !== "object") return null;
  const s = /** @type {Record<string, unknown>} */ (session);
  const u = s.user;
  if (u && typeof u === "object") return /** @type {any} */ (u);
  const nested = s.session;
  if (nested && typeof nested === "object" && "user" in nested) {
    const nu = /** @type {Record<string, unknown>} */ (nested).user;
    if (nu && typeof nu === "object") return /** @type {any} */ (nu);
  }
  return null;
}
