import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type User, UserRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

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
  const { isAuthenticated, isLoading, hasResolvedSession, authzHydrating, user, hasRole, hasCapability } = useAuth();

  if (isLoading && !hasResolvedSession) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // After initial session bootstrap, keep current content visible while background profile refresh runs.
  if (isLoading && isAuthenticated) return <>{children}</>;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const requiresAuthz = Boolean(allowedRoles?.length || requiredCapability || requireAnyCapability?.length);
  if (requiresAuthz && authzHydrating) {
    // Keep routes responsive while role/capability bundle refreshes in background.
    if (isAuthenticated) return <>{children}</>;
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.some((r) => hasRole(r))) {
    return <Navigate to="/access-denied" replace />;
  }

  if (requireAnyCapability?.length) {
    const bypass =
      capabilityBypassRoles?.length &&
      user &&
      capabilityBypassRoles.some((r) => hasRole(r));
    const allowed =
      Boolean(bypass) || requireAnyCapability.some((c) => hasCapability(c));
    if (!allowed) {
      if (shouldRedirectPendingDoctorToMediProfileSetup(pathname, hasRole, hasCapability)) {
        return <Navigate to={MEDI_DOCTOR_PROFILE_SETUP} replace />;
      }
      return <Navigate to="/access-denied" replace />;
    }
  } else if (requiredCapability && !hasCapability(requiredCapability)) {
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

/** Post-login landing: respects MediBondhu landing preference; OFF always starts from dashboard. */
export function getPostLoginPath(user: Pick<User, "primaryRole" | "farmerOpenMedibondhu">): string {
  if (user.farmerOpenMedibondhu === false) {
    return "/dashboard";
  }
  const mediLandingRoles = new Set<UserRole>(["farmer", "buyer", "vendor"]);
  if (mediLandingRoles.has(user.primaryRole) && user.farmerOpenMedibondhu !== false) {
    return "/medibondhu";
  }
  return getDefaultRoute(user.primaryRole);
}
