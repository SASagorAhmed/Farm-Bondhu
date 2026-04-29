import sql from "../db.js";

/**
 * Builds the same aggregate `User` object the React AuthContext expected from Supabase.
 * @param {string} userId
 */
export async function buildUserBundle(userId) {
  const [profile] = await sql`select * from profiles where id = ${userId} limit 1`;
  if (!profile) return null;

  const [accessRows, teamRows] = await Promise.all([
    sql`
      with roles as (
        select role
        from user_roles
        where user_id = ${userId}
      ),
      role_perms as (
        select rp.permission_code
        from role_permissions rp
        inner join roles r on r.role = rp.role
      ),
      caps as (
        select capability_code, is_enabled
        from user_capabilities
        where user_id = ${userId}
      )
      select
        coalesce((select array_agg(distinct role) from roles), '{}'::text[]) as roles,
        coalesce((select array_agg(distinct permission_code) from role_perms), '{}'::text[]) as role_caps,
        coalesce(
          (
            select json_agg(
              json_build_object(
                'capability_code', capability_code,
                'is_enabled', is_enabled
              )
            )
            from caps
          ),
          '[]'::json
        ) as user_caps
    `,
    sql`
      select
        nullif(trim(coalesce(admin_level, '')), '') as al,
        nullif(trim(coalesce(admin_role, '')), '') as ar
      from admin_team
      where user_id = ${userId}
      order by updated_at desc nulls last, created_at desc
      limit 1
    `,
  ]);
  const access = accessRows?.[0] || {};
  const roles = Array.isArray(access.roles) ? access.roles : [];

  /** Highest-priority app role in user_roles (avoids stale profiles.primary_role when e.g. vet + farmer both exist). */
  const ROLE_PRIORITY = ["admin", "vet", "vendor", "buyer", "farmer"];
  let primaryRole =
    roles.length > 0
      ? ROLE_PRIORITY.find((r) => roles.includes(r)) || roles[0]
      : profile.primary_role;

  const roleCaps = Array.isArray(access.role_caps) ? access.role_caps : [];
  const defaultCaps = new Set(roleCaps.map(String));
  const userCaps = Array.isArray(access.user_caps) ? access.user_caps : [];
  for (const uc of userCaps) {
    if (uc?.is_enabled) defaultCaps.add(String(uc.capability_code));
    else defaultCaps.delete(String(uc.capability_code));
  }

  const TEAM_LEVELS = new Set(["super_admin", "co_admin", "moderator"]);
  const teamRow = teamRows?.[0];
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
