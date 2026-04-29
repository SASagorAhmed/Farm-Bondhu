import sql from "../db.js";

/**
 * @param {string} userId
 * @param {string[]} roles
 */
export async function userHasAnyRole(userId, roles) {
  if (!roles.length) return false;
  const normalized = roles.map((r) => String(r || "").trim().toLowerCase()).filter(Boolean);
  if (!normalized.length) return false;
  const rows = await sql`
    select 1 as ok from user_roles
    where user_id = ${userId} and role in ${sql(normalized)}
    limit 1
  `;
  if (rows.length > 0) return true;
  const [profile] = await sql`
    select lower(trim(primary_role)) as primary_role
    from profiles
    where id = ${userId}
    limit 1
  `;
  return Boolean(profile?.primary_role && normalized.includes(profile.primary_role));
}

/**
 * Request-scoped role resolver to avoid repeated DB checks.
 * @param {{ userId?: string, __fbRoleSet?: Set<string> }} req
 */
export async function getRequestRoleSet(req) {
  if (req.__fbRoleSet) return req.__fbRoleSet;
  const userId = String(req.userId || "");
  if (!userId) return new Set();
  const [roles, profile] = await Promise.all([
    sql`
      select lower(trim(role)) as role
      from user_roles
      where user_id = ${userId}
    `,
    sql`
      select lower(trim(primary_role)) as primary_role
      from profiles
      where id = ${userId}
      limit 1
    `,
  ]);
  const set = new Set(
    roles
      .map((r) => String(r.role || "").trim().toLowerCase())
      .concat(profile?.primary_role ? [String(profile.primary_role).trim().toLowerCase()] : [])
      .filter(Boolean)
  );
  req.__fbRoleSet = set;
  return set;
}

/**
 * @param {{ userId?: string, __fbRoleSet?: Set<string> }} req
 * @param {string[]} roles
 */
export async function requestHasAnyRole(req, roles) {
  const normalized = roles.map((r) => String(r || "").trim().toLowerCase()).filter(Boolean);
  if (!normalized.length) return false;
  const set = await getRequestRoleSet(req);
  return normalized.some((role) => set.has(role));
}

/**
 * @param {string} userId
 */
export async function assertVetAccess(userId) {
  const [hasRole, vetProfile] = await Promise.all([
    userHasAnyRole(userId, ["vet", "admin"]),
    getVetProfileByUserId(userId),
  ]);
  if (hasRole || vetProfile) return;
  const err = new Error("Vet access required");
  err.status = 403;
  throw err;
}

/**
 * @param {string} userId
 */
export async function getVetProfileByUserId(userId) {
  const [profileByUserId] = await sql`
    select * from vet_profiles
    where user_id = ${userId}
    limit 1
  `;
  if (profileByUserId) return profileByUserId;
  const [profileById] = await sql`
    select * from vet_profiles
    where id = ${userId}
    limit 1
  `;
  if (profileById) return profileById;
  const [vetByUserId] = await sql`
    select * from vets
    where user_id = ${userId}
    limit 1
  `;
  if (vetByUserId) return vetByUserId;
  const [vetById] = await sql`
    select * from vets
    where id = ${userId}
    limit 1
  `;
  return vetById || null;
}

/**
 * Vet must exist and be approved for operational actions.
 * Admin users bypass this check.
 * @param {string} userId
 */
export async function assertApprovedVetAccess(userId) {
  const isAdmin = await userHasAnyRole(userId, ["admin"]);
  if (isAdmin) return;
  await assertVetAccess(userId);
  const vet = await getVetProfileByUserId(userId);
  if (!vet) {
    const err = new Error("Vet profile not found");
    err.status = 403;
    throw err;
  }
  const status = String(vet.verification_status || "pending").toLowerCase();
  if (status !== "approved") {
    const err = new Error("Vet profile is not approved yet");
    err.status = 403;
    throw err;
  }
}

/**
 * Returns canonical booking with computed vet_user_id when possible.
 * @param {string} bookingId
 */
export async function getBookingById(bookingId) {
  const [row] = await sql`
    select
      b.*,
      coalesce(
        b.vet_user_id,
        v.user_id,
        case when b.vet_mock_id = b.patient_mock_id then null else b.vet_mock_id end
      ) as computed_vet_user_id
    from consultation_bookings b
    left join vets v on v.id = b.vet_mock_id
    where b.id = ${bookingId}
    limit 1
  `;
  return row || null;
}

/**
 * @param {string} bookingId
 * @param {string} userId
 */
export async function assertBookingParticipant(bookingId, userId) {
  const row = await getBookingById(bookingId);
  if (!row) {
    const err = new Error("Consultation not found");
    err.status = 404;
    throw err;
  }
  const isParticipant = row.patient_mock_id === userId || row.computed_vet_user_id === userId;
  if (!isParticipant) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  return row;
}

/**
 * @param {string | null | undefined} vetMockId
 */
export async function resolveVetUserId(vetMockId) {
  if (!vetMockId) return null;
  const [vet] = await sql`select user_id from vets where id = ${vetMockId} limit 1`;
  return vet?.user_id || null;
}
