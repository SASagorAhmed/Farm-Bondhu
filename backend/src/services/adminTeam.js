import sql from "../db.js";
import { requestHasAnyRole } from "./medibondhuAccess.js";

const TEAM_LEVELS = new Set(["super_admin", "co_admin", "moderator"]);

export async function isPlatformAdminUser(userId) {
  if (!userId) return false;
  return requestHasAnyRole({ userId }, ["admin"]);
}

export async function getAdminTeamLevel(userId) {
  if (!userId) return null;
  const [row] = await sql`
    select nullif(trim(coalesce(admin_level, '')), '') as al,
           nullif(trim(coalesce(admin_role, '')), '') as ar
    from admin_team
    where user_id = ${userId}
    order by updated_at desc nulls last, created_at desc
    limit 1
  `;
  const raw = row?.al || row?.ar;
  return raw && TEAM_LEVELS.has(raw) ? raw : null;
}

export async function isSuperAdminUser(userId) {
  if (!(await isPlatformAdminUser(userId))) return false;
  return (await getAdminTeamLevel(userId)) === "super_admin";
}

/**
 * Platform admins who are not Super Admin may browse preview workspaces but not mutate user data.
 * @returns {Promise<string|null>} error message if blocked, null if allowed
 */
export async function assertPreviewWriteAllowed(userId) {
  if (!(await isPlatformAdminUser(userId))) return null;
  if (await isSuperAdminUser(userId)) return null;
  return "Super Admin required for preview edits. Use Control Center for platform management.";
}
