import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type User, UserRole, isPlatformAdmin, isAdminPreviewPath } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { inferModuleFromPath } from "@/lib/signupModules";

const MEDI_DOCTOR_PROFILE_SETUP = "/medibondhu/profile";

/** Pending human doctors (no `can_practice_human` yet) can only use merged profile inside MediBondhu. */
export function shouldRedirectPendingDoctorToMediProfileSetup(
  pathname: string,
  hasRole: (r: UserRole) => boolean,
  hasCapability: (c: string) => boolean,
): boolean {
  if (!hasRole("doctor") || hasRole("admin")) return false;
  if (hasCapability("can_practice_human")) return false;
  if (!pathname.startsWith("/medibondhu")) return false;
  return pathname !== MEDI_DOCTOR_PROFILE_SETUP;
}

interface Props {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredCapability?: string;
  /** User must have at least one of these capabilities (e.g. MediBondhu: book or conduct as vet). */
  requireAnyCapability?: string[];
  /**
   * MediBondhu allows `primary_role = doctor` users to enter before `can_practice_human` is granted
   * (verification wizard + admin approval).
   */
  capabilityBypassRoles?: UserRole[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  requiredCapability,
  requireAnyCapability,
  capabilityBypassRoles,
}: Props) {
  const { pathname } = useLocation();
  const {
    isAuthenticated,
    isLoading,
    hasResolvedSession,
    authzHydrating,
    user,
    hasRole,
    hasCapability,
    refreshProfile,
  } = useAuth();
  const [capabilityRetried, setCapabilityRetried] = useState(false);
  const [capabilityRetrying, setCapabilityRetrying] = useState(false);

  const adminPreviewBypass =
    Boolean(user && isPlatformAdmin(user) && isAdminPreviewPath(pathname));

  const capabilityBypass =
    Boolean(
      capabilityBypassRoles?.length &&
        user &&
        capabilityBypassRoles.some((r) => hasRole(r))
    );

  let capabilityAllowed = true;
  if (requireAnyCapability?.length) {
    capabilityAllowed =
      capabilityBypass || requireAnyCapability.some((c) => hasCapability(c));
  } else if (requiredCapability) {
    capabilityAllowed = hasCapability(requiredCapability);
  }

  const needsCapabilityCheck = Boolean(requiredCapability || requireAnyCapability?.length);
  const rolesAllowed = !allowedRoles?.length || Boolean(user && allowedRoles.some((r) => hasRole(r)));
  const capabilityDenied =
    isAuthenticated &&
    !adminPreviewBypass &&
    rolesAllowed &&
    needsCapabilityCheck &&
    !capabilityAllowed;

  useEffect(() => {
    if (!capabilityDenied || capabilityRetried || capabilityRetrying) return;
    setCapabilityRetrying(true);
    void refreshProfile({ force: true }).finally(() => {
      setCapabilityRetrying(false);
      setCapabilityRetried(true);
    });
  }, [capabilityDenied, capabilityRetried, capabilityRetrying, refreshProfile]);

  if (isLoading && !hasResolvedSession) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isLoading && isAuthenticated) return <>{children}</>;

  if (!isAuthenticated) {
    const module = inferModuleFromPath(pathname);
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: pathname, ...(module ? { module } : {}) }}
      />
    );
  }

  const requiresAuthz = Boolean(allowedRoles?.length || requiredCapability || requireAnyCapability?.length);
  if (requiresAuthz && authzHydrating) {
    if (isAuthenticated) return <>{children}</>;
    const module = inferModuleFromPath(pathname);
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: pathname, ...(module ? { module } : {}) }}
      />
    );
  }

  if (adminPreviewBypass) {
    return <>{children}</>;
  }

  if (allowedRoles && user && !allowedRoles.some((r) => hasRole(r))) {
    return <Navigate to="/access-denied" replace />;
  }

  if (capabilityDenied) {
    if (capabilityRetrying || !capabilityRetried) {
      return (
        <div className="h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    if (shouldRedirectPendingDoctorToMediProfileSetup(pathname, hasRole, hasCapability)) {
      return <Navigate to={MEDI_DOCTOR_PROFILE_SETUP} replace />;
    }
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}

export function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case "buyer": return "/marketplace";
    case "farmer": return "/dashboard";
    case "vendor": return "/seller/dashboard";
    case "vet": return "/vet/dashboard";
    case "doctor": return "/medibondhu/doctor/dashboard";
    case "admin": return "/admin";
    default: return "/dashboard";
  }
}

/** Post-login landing: care-only users → module home; buyers → marketplace; farmers respect MediBondhu preference. */
export function getPostLoginPath(
  user: Pick<User, "primaryRole" | "farmerOpenMedibondhu" | "capabilities">
): string {
  if (user.primaryRole === "vet" || user.primaryRole === "doctor") {
    return getDefaultRoute(user.primaryRole);
  }

  const caps = user.capabilities || [];
  const hasVet = caps.includes("can_book_vet");
  const hasHuman = caps.includes("can_book_human");
  if (hasVet && !hasHuman) return "/vetbondhu";
  if (hasHuman && !hasVet) return "/medibondhu";

  if (user.primaryRole === "buyer") {
    return "/marketplace";
  }
  if (user.primaryRole === "farmer") {
    return user.farmerOpenMedibondhu !== false ? "/medibondhu" : "/dashboard";
  }
  return getDefaultRoute(user.primaryRole);
}
