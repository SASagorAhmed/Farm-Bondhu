import { requestHasAnyRole } from "../services/medibondhuAccess.js";

/** Use after `requireUser` + `requireDatabase`. */
export async function requireAdmin(req, res, next) {
  try {
    const isAdmin = await requestHasAnyRole(req, ["admin"]);
    if (!isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  } catch (e) {
    next(e);
  }
}
