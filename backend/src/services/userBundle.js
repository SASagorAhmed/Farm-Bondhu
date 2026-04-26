import sql from "../db.js";

/**
 * Builds the same aggregate `User` object the React AuthContext expected from Supabase.
 * @param {string} userId
 */
export async function buildUserBundle(userId) {
  const [profile] = await sql`
    select * from profiles where id = ${userId} limit 1
  `;
  if (!profile) return null;

  const rolesRows = await sql`
    select role from user_roles where user_id = ${userId}
  `;
  const roles = rolesRows.map((r) => r.role);

  /** Highest-priority app role in user_roles (avoids stale profiles.primary_role when e.g. vet + farmer both exist). */
  const ROLE_PRIORITY = ["admin", "vet", "vendor", "buyer", "farmer"];
  let primaryRole =
    roles.length > 0
      ? ROLE_PRIORITY.find((r) => roles.includes(r)) || roles[0]
      : profile.primary_role;

  if (roles.length > 0 && profile.primary_role !== primaryRole) {
    try {
      await sql`
        update profiles set primary_role = ${primaryRole}, updated_at = now()
        where id = ${userId} and primary_role is distinct from ${primaryRole}
      `;
    } catch {
      /* ignore repair failure; still return consistent bundle */
    }
  }

  const rolePerms =
    roles.length > 0
      ? await sql`
          select permission_code from role_permissions where role in ${sql(roles)}
        `
      : [];

  const defaultCaps = new Set(rolePerms.map((rp) => rp.permission_code));

  const userCaps = await sql`
    select capability_code, is_enabled from user_capabilities where user_id = ${userId}
  `;

  for (const uc of userCaps) {
    if (uc.is_enabled) defaultCaps.add(uc.capability_code);
    else defaultCaps.delete(uc.capability_code);
  }

  const TEAM_LEVELS = new Set(["super_admin", "co_admin", "moderator"]);
  const [teamRow] = await sql`
    select
      nullif(trim(coalesce(admin_level, '')), '') as al,
      nullif(trim(coalesce(admin_role, '')), '') as ar
    from admin_team
    where user_id = ${userId}
    order by updated_at desc nulls last, created_at desc
    limit 1
  `;
  const rawLevel = teamRow?.al || teamRow?.ar;
  const adminLevel = rawLevel && TEAM_LEVELS.has(rawLevel) ? rawLevel : null;

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    primaryRole,
    roles,
    adminLevel,
    capabilities: Array.from(defaultCaps),
    avatar: profile.avatar_url || undefined,
    phone: profile.phone || undefined,
    location: profile.location || undefined,
  };
}
