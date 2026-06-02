import { Navigate, useLocation } from "react-router-dom";
import { getWorkspaceSupportBase } from "@/lib/workspaceAccent";

/** Legacy `/support` bookmarks → workspace-scoped support route. */
export default function SupportContextRedirect() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const base = from ? getWorkspaceSupportBase(from) : "/buyer/support";
  const suffix = location.pathname.replace(/^\/support\/?/, "");
  const target = suffix ? `${base}/${suffix}` : base;
  return <Navigate to={target} replace />;
}
