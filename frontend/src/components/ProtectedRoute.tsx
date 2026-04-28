import { Navigate } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredCapability?: string;
  /** User must have at least one of these capabilities (e.g. MediBondhu: book or conduct as vet). */
  requireAnyCapability?: string[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  requiredCapability,
  requireAnyCapability,
}: Props) {
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
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (allowedRoles && user && !allowedRoles.some((r) => hasRole(r))) {
    return <Navigate to="/access-denied" replace />;
  }

  if (requireAnyCapability?.length) {
    const allowed = requireAnyCapability.some((c) => hasCapability(c));
    if (!allowed) return <Navigate to="/access-denied" replace />;
  } else if (requiredCapability && !hasCapability(requiredCapability)) {
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
    case "admin": return "/admin";
    default: return "/dashboard";
  }
}
