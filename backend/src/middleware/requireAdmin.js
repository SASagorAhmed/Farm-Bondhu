import sql from "../db.js";

/** Use after `requireUser` + `requireDatabase`. */
export async function requireAdmin(req, res, next) {
  try {
    const rows = await sql`
      select 1 as ok from user_roles
      where user_id = ${req.userId} and role = 'admin'
      limit 1
    `;
    if (!rows.length) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  } catch (e) {
    next(e);
  }
}
