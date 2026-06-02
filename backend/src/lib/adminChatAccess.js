/**
 * Whether an admin may read a conversation bootstrap (participants always allowed elsewhere).
 * @param {{ isParticipant: boolean, isAdmin: boolean, isPlatformSupport: boolean, hasModerationReport: boolean }} opts
 */
export function adminMayReadConversation(opts) {
  if (opts.isParticipant) return true;
  if (!opts.isAdmin) return false;
  if (opts.isPlatformSupport) return true;
  return Boolean(opts.hasModerationReport);
}
