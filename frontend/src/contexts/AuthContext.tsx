export type { User, UserRole, SignupCarePath, SignupData, AuthContextType, AdminTeamLevel, WorkspaceCapability } from "./auth-context";
export {
  useAuth,
  AuthContext,
  formatUserRoleLabel,
  getUserRoleBadgeClass,
  resolveEffectiveSignupModule,
  canAccessWorkspace,
  WORKSPACE_CAPABILITIES,
  ADMIN_PREVIEW_PATH_PREFIXES,
  isAdminPreviewPath,
  isPlatformAdmin,
  isSuperAdmin,
} from "./auth-context";
export type { WorkspaceKey, WorkspaceAccessContext } from "./auth-context";
export { AuthProvider } from "./AuthProvider";
