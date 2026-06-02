import { assertPreviewWriteAllowed } from "../services/adminTeam.js";

/** Use after `requireUser`. Blocks Co-Admin/Moderator writes in user workspace APIs. */
export async function blockNonSuperAdminPreviewWrite(req, res, next) {
  try {
    const message = await assertPreviewWriteAllowed(req.userId);
    if (message) {
      res.status(403).json({ error: message });
      return;
    }
    next();
  } catch (e) {
    next(e);
  }
}
