import sql from "../db.js";

const APP_ROLES = new Set(["farmer", "buyer", "vendor", "vet", "doctor", "admin"]);
const SIGNUP_CARE_PATHS = new Set(["vetbondhu", "medibondhu"]);
const SIGNUP_MODULES = new Set([
  "vetbondhu",
  "medibondhu",
  "farm",
  "marketplace",
  "vendor",
  "vet",
  "doctor",
]);

const VETBONDHU_DISABLE = [
  "can_book_human",
  "can_manage_farm",
  "can_manage_animals",
  "can_buy",
];

const MEDIBONDHU_DISABLE = [
  "can_book_vet",
  "can_manage_farm",
  "can_manage_animals",
  "can_access_learning",
  "can_buy",
];

function normalizeRole(raw) {
  const r = String(raw || "farmer").toLowerCase();
  return APP_ROLES.has(r) ? r : "farmer";
}

export function normalizeSignupCarePath(raw) {
  const path = String(raw || "").trim().toLowerCase();
  return SIGNUP_CARE_PATHS.has(path) ? path : null;
}

export function normalizeSignupModule(raw) {
  const mod = String(raw || "").trim().toLowerCase();
  return SIGNUP_MODULES.has(mod) ? mod : null;
}

/** @param {Record<string, unknown>} meta */
export function resolveSignupModuleFromMeta(meta = {}) {
  const fromModule = normalizeSignupModule(meta.signup_module);
  if (fromModule) return fromModule;
  const care = normalizeSignupCarePath(meta.signup_care_path);
  if (care === "vetbondhu" || care === "medibondhu") return care;
  const role = String(meta.primary_role || "").trim().toLowerCase();
  if (role === "buyer") return "marketplace";
  if (role === "vendor") return "vendor";
  if (role === "vet") return "vet";
  if (role === "doctor") return "doctor";
  if (role === "farmer") return "farm";
  return null;
}

/**
 * @param {string | null | undefined} rawModule
 * @returns {{
 *   primaryRole: string;
 *   farmerOpenMedibondhu: boolean | null;
 *   enable: string[];
 *   disable: string[];
 * } | null}
 */
export function signupModuleConfig(rawModule) {
  const mod = normalizeSignupModule(rawModule);
  if (!mod) return null;

  if (mod === "vetbondhu") {
    return {
      primaryRole: "farmer",
      farmerOpenMedibondhu: false,
      enable: ["can_book_vet", "can_access_learning"],
      disable: [...VETBONDHU_DISABLE],
    };
  }
  if (mod === "medibondhu") {
    return {
      primaryRole: "farmer",
      farmerOpenMedibondhu: true,
      enable: ["can_book_human"],
      disable: [...MEDIBONDHU_DISABLE],
    };
  }
  if (mod === "farm") {
    return {
      primaryRole: "farmer",
      farmerOpenMedibondhu: false,
      enable: [],
      disable: ["can_book_human"],
    };
  }
  if (mod === "marketplace") {
    return {
      primaryRole: "buyer",
      farmerOpenMedibondhu: false,
      enable: ["can_buy"],
      disable: ["can_book_human", "can_bulk_buy"],
    };
  }
  if (mod === "vendor") {
    return {
      primaryRole: "vendor",
      farmerOpenMedibondhu: false,
      enable: [],
      disable: [],
    };
  }
  if (mod === "vet") {
    return {
      primaryRole: "vet",
      farmerOpenMedibondhu: false,
      enable: [],
      disable: [],
    };
  }
  if (mod === "doctor") {
    return {
      primaryRole: "doctor",
      farmerOpenMedibondhu: true,
      enable: [],
      disable: [],
    };
  }
  return null;
}

/** @returns {{ farmerOpenMedibondhu: boolean, enable: string[], disable: string[] } | null} */
export function signupCarePathConfig(raw) {
  const config = signupModuleConfig(normalizeSignupCarePath(raw));
  if (!config) return null;
  return {
    farmerOpenMedibondhu: config.farmerOpenMedibondhu ?? false,
    enable: config.enable,
    disable: config.disable,
  };
}

async function upsertUserCapability(userId, capabilityCode, isEnabled, grantedBy = null) {
  await sql`
    insert into user_capabilities ${sql({
      user_id: userId,
      capability_code: capabilityCode,
      is_enabled: isEnabled,
      granted_by: grantedBy,
    })}
    on conflict (user_id, capability_code) do update set
      is_enabled = ${isEnabled},
      granted_by = coalesce(user_capabilities.granted_by, excluded.granted_by)
  `;
}

export async function applySignupModule(userId, signupData = {}) {
  if (!sql || !userId) return;
  const moduleKey = resolveSignupModuleFromMeta(signupData);
  const config = signupModuleConfig(moduleKey);
  if (!config) return;

  if (config.farmerOpenMedibondhu !== null) {
    await sql`
      update profiles
      set farmer_open_medibondhu = ${config.farmerOpenMedibondhu}, updated_at = now()
      where id = ${userId}
    `;
  }

  for (const code of config.enable) {
    await upsertUserCapability(userId, code, true);
  }
  for (const code of config.disable) {
    await upsertUserCapability(userId, code, false);
  }
}

/** @deprecated Use applySignupModule */
export async function applySignupCarePath(userId, signupData = {}) {
  return applySignupModule(userId, signupData);
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
 *  degree: string;
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
    degree,
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
        degree,
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
          degree,
          experience_years: experienceYears,
          consultation_fee: consultationFee,
        },
        payload: {
          specialization,
          degree,
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
  const degree = nonEmptyString(meta.degree) || "Veterinary Professional";
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
      degree,
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
    degree,
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
  const signupModule = resolveSignupModuleFromMeta(meta);
  /** Insert default when creating a missing row without metadata (e.g. legacy); never overwrite DB role on bare sign-in. */
  const primaryForInsert = hasExplicit ? primary_role : "farmer";
  const phone = meta.phone != null && meta.phone !== "" ? String(meta.phone) : null;
  const location = meta.location != null && meta.location !== "" ? String(meta.location) : null;

  try {
    await sql`
      insert into public.profiles (id, email, name, primary_role, phone, location, signup_module, created_at, updated_at)
      values (${id}, ${email}, ${name}, ${primaryForInsert}, ${phone}, ${location}, ${signupModule}, now(), now())
      on conflict (id) do update set
        email = excluded.email,
        name = case when trim(coalesce(profiles.name, '')) = '' then excluded.name else profiles.name end,
        primary_role = case when ${hasExplicit} then excluded.primary_role else profiles.primary_role end,
        signup_module = case when ${Boolean(signupModule)} then excluded.signup_module else profiles.signup_module end,
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

  if (hasExplicit) {
    try {
      await applySignupModule(id, meta);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ensureAppUser] signup module failed:", msg);
    }
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
