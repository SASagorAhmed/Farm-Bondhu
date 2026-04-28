import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultRoute } from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";

/**
 * Redirects authenticated users to their role-appropriate dashboard.
 * Used as the post-login landing when no specific route is targeted.
 */
export default function AuthRedirect() {
  const { user, isAuthenticated, isLoading, hasResolvedSession, authzHydrating } = useAuth();

  if (isLoading && !hasResolvedSession) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (authzHydrating) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <Navigate to={getDefaultRoute(user.primaryRole)} replace />;
}
