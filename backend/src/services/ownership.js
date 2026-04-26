import sql from "../db.js";

/**
 * @param {string} farmId
 * @param {string} userId
 */
export async function assertFarmOwnedByUser(farmId, userId) {
  const rows = await sql`
    select id from farms where id = ${farmId} and user_id = ${userId} limit 1
  `;
  if (!rows.length) {
    const err = new Error("Farm not found or access denied");
    err.status = 404;
    throw err;
  }
}
