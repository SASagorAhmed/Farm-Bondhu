/**
 * Infer care-only signup module from roles + effective capabilities when profiles.signup_module is unset.
 * @param {string | undefined} storedModule
 * @param {string[]} roles
 * @param {string[]} capabilities
 * @returns {string | undefined}
 */
export function inferSignupModuleFromAccess(storedModule, roles, capabilities) {
  const valid = new Set([
    "vetbondhu",
    "medibondhu",
    "farm",
    "marketplace",
    "vendor",
    "vet",
    "doctor",
  ]);

  const caps = new Set(Array.isArray(capabilities) ? capabilities.map(String) : []);
  const roleSet = new Set(Array.isArray(roles) ? roles.map(String) : []);
  const isVet = roleSet.has("vet") || caps.has("can_consult_as_vet");
  const isDoctor = roleSet.has("doctor") || caps.has("can_practice_human");

  if (storedModule && valid.has(storedModule)) {
    if (
      (storedModule === "medibondhu" || storedModule === "vetbondhu") &&
      caps.has("can_manage_farm")
    ) {
      return "farm";
    }
    return storedModule;
  }

  if (caps.has("can_book_vet") && !caps.has("can_manage_farm") && !isVet) {
    return "vetbondhu";
  }
  if (caps.has("can_book_human") && !caps.has("can_manage_farm") && !isDoctor && !isVet) {
    return "medibondhu";
  }
  return undefined;
}
