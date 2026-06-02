import { useState } from "react";
import { useAuth, UserRole, formatUserRoleLabel } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Warehouse, PawPrint, Wheat, HeartPulse, BarChart3, Wallet,
  ShoppingCart, Package, ClipboardList, Store, Stethoscope, CalendarCheck, FileText,
  LogOut, ChevronDown, Menu, PanelLeftClose, Skull, DollarSign, BookOpen, UserCircle, Settings, Headphones,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICON_COLORS } from "@/lib/iconColors";
import WorkspaceButtons from "./WorkspaceButtons";
import AdminModuleSwitcher from "./AdminModuleSwitcher";
import {
  getAdminModuleForPath,
  getAdminModuleNavGroups,
  isAdminHubPath,
  type AdminNavItem,
} from "@/lib/adminModules";
import { isAdminNavItemActive } from "@/lib/adminNavMatch";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  iconColor: string;
}

const NAV_BY_ROLE: Record<UserRole, { label: string; items: NavItem[] }[]> = {
  farmer: [
    {
      label: "Farm Management",
      items: [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, iconColor: ICON_COLORS.dashboard },
        { title: "Farms", url: "/dashboard/farms", icon: Warehouse, iconColor: ICON_COLORS.warehouse },
        { title: "Animals", url: "/dashboard/animals", icon: PawPrint, iconColor: ICON_COLORS.animals },
        { title: "Feed Management", url: "/dashboard/feed", icon: Wheat, iconColor: ICON_COLORS.wheat },
        { title: "Health Records", url: "/dashboard/health", icon: HeartPulse, iconColor: ICON_COLORS.heartPulse },
        { title: "Production", url: "/dashboard/production", icon: BarChart3, iconColor: ICON_COLORS.analytics },
        { title: "Mortality", url: "/dashboard/mortality", icon: Skull, iconColor: ICON_COLORS.mortality },
        { title: "Sales", url: "/dashboard/sales", icon: DollarSign, iconColor: ICON_COLORS.dollar },
        { title: "Finances", url: "/dashboard/finances", icon: Wallet, iconColor: ICON_COLORS.wallet },
      ],
    },
    {
      label: "Marketplace",
      items: [
        { title: "Browse Products", url: "/marketplace", icon: ShoppingCart, iconColor: ICON_COLORS.cart },
        { title: "My Shop", url: "/my-shop", icon: Store, iconColor: ICON_COLORS.store },
        { title: "My Orders", url: "/orders", icon: ClipboardList, iconColor: ICON_COLORS.orders },
      ],
    },
    {
      label: "MediBondhu",
      items: [
        { title: "Find a Vet", url: "/medibondhu", icon: Stethoscope, iconColor: ICON_COLORS.stethoscope },
        { title: "Consultations", url: "/medibondhu/consultations", icon: CalendarCheck, iconColor: ICON_COLORS.calendar },
      ],
    },
    {
      label: "Learning",
      items: [
        { title: "Learning Center", url: "/learning", icon: BookOpen, iconColor: ICON_COLORS.learning },
      ],
    },
  ],
  buyer: [
    { label: "Marketplace", items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, iconColor: ICON_COLORS.dashboard },
      { title: "Browse Products", url: "/marketplace", icon: ShoppingCart, iconColor: ICON_COLORS.cart },
      { title: "My Orders", url: "/orders", icon: ClipboardList, iconColor: ICON_COLORS.orders },
    ]},
    { label: "Learning", items: [
      { title: "Learning Center", url: "/learning", icon: BookOpen, iconColor: ICON_COLORS.learning },
    ]},
  ],
  vendor: [
    { label: "Store Management", items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, iconColor: ICON_COLORS.dashboard },
      { title: "My Products", url: "/seller/dashboard", icon: Package, iconColor: ICON_COLORS.package },
      { title: "Orders", url: "/orders", icon: ClipboardList, iconColor: ICON_COLORS.orders },
      { title: "Marketplace", url: "/marketplace", icon: Store, iconColor: ICON_COLORS.store },
    ]},
    { label: "Learning", items: [
      { title: "Learning Center", url: "/learning", icon: BookOpen, iconColor: ICON_COLORS.learning },
    ]},
  ],
  vet: [
    { label: "Vet Services", items: [
      { title: "Dashboard", url: "/vet/dashboard", icon: LayoutDashboard, iconColor: ICON_COLORS.dashboard },
      { title: "Consultations", url: "/vet/consultations", icon: CalendarCheck, iconColor: ICON_COLORS.calendar },
      { title: "Prescriptions", url: "/vet/prescriptions", icon: FileText, iconColor: ICON_COLORS.prescription },
    ]},
    { label: "Learning", items: [
      { title: "Learning Center", url: "/learning", icon: BookOpen, iconColor: ICON_COLORS.learning },
    ]},
  ],
  doctor: [
    {
      label: "MediBondhu — Human care",
      items: [
        { title: "Doctor dashboard", url: "/medibondhu/doctor/dashboard", icon: LayoutDashboard, iconColor: ICON_COLORS.dashboard },
        { title: "Schedule", url: "/medibondhu/doctor/schedule", icon: CalendarCheck, iconColor: ICON_COLORS.calendar },
        { title: "Prescriptions", url: "/medibondhu/doctor/prescriptions", icon: FileText, iconColor: ICON_COLORS.prescription },
        { title: "Practice profile & verification", url: "/medibondhu/doctor/profile-setup", icon: ClipboardList, iconColor: ICON_COLORS.medibondhu },
      ],
    },
    {
      label: "Learning",
      items: [{ title: "Learning Center", url: "/learning", icon: BookOpen, iconColor: ICON_COLORS.learning }],
    },
  ],
  admin: [],
};

export default function DashboardSidebar() {
  const { user, logout, hasCapability } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const isAdmin = user.primaryRole === "admin";
  const onAdminHub = isAdmin && isAdminHubPath(location.pathname);
  const activeAdminModule = isAdmin ? getAdminModuleForPath(location.pathname) : null;

  const allModulesItem: AdminNavItem = {
    title: "All modules",
    url: "/admin",
    icon: LayoutDashboard,
    iconColor: ICON_COLORS.admin,
  };

  const adminNavGroups = activeAdminModule
    ? getAdminModuleNavGroups(activeAdminModule.id)
    : null;

  const adminGroups =
    adminNavGroups && activeAdminModule
      ? [
          {
            label: "Navigation",
            items: [allModulesItem],
          },
          ...adminNavGroups.map((group) => ({
            label: group.label,
            items: group.items,
          })),
        ]
      : activeAdminModule
        ? [
            {
              label: activeAdminModule.label,
              items: [allModulesItem, ...activeAdminModule.navItems],
            },
          ]
        : !onAdminHub && isAdmin
          ? [{ label: "Admin", items: [allModulesItem] }]
          : [];

  // Smart My Shop link: non-sellers go to access center
  const rawGroups = isAdmin ? adminGroups : NAV_BY_ROLE[user.primaryRole] || [];
  const groups = rawGroups.map((group) => ({
    ...group,
    items: group.items.map((item) =>
      item.url === "/my-shop" && !hasCapability("can_sell")
        ? { ...item, url: "/admin/access-center?request=seller_access" }
        : item
    ),
  }));
  const roleLabel = isAdmin
    ? onAdminHub
      ? "Admin Control Center"
      : activeAdminModule
        ? activeAdminModule.label
        : "Admin Control Center"
    : `${formatUserRoleLabel(user)} Panel`;
  const roleColor = user.primaryRole === "admin"
    ? activeAdminModule?.color ?? ICON_COLORS.admin
    : user.primaryRole === "vet" ? ICON_COLORS.stethoscope
    : user.primaryRole === "doctor" ? ICON_COLORS.medibondhu
    : user.primaryRole === "vendor" ? ICON_COLORS.cart
    : ICON_COLORS.farm;
  const currentWorkspace =
    user.primaryRole === "vet"
      ? "vet"
      : user.primaryRole === "doctor"
        ? "medibondhuDoctor"
        : user.primaryRole === "vendor" || user.primaryRole === "buyer"
          ? "marketplace"
          : "farm";

  const BOTTOM_ITEMS = [
    { title: "Profile", url: "/admin/profile", icon: UserCircle, iconColor: ICON_COLORS.profile },
    { title: "Help & Support", url: "/admin/support", icon: Headphones, iconColor: ICON_COLORS.admin },
    { title: "Settings", url: "/admin/settings", icon: Settings, iconColor: ICON_COLORS.dashboard },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center justify-between">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {isAdmin && activeAdminModule && !onAdminHub ? (
                  <AdminModuleSwitcher activeModule={activeAdminModule} collapsed={false} />
                ) : (
                  <>
                    <Warehouse className="h-4 w-4 shrink-0" style={{ color: roleColor }} />
                    <span className="text-sm font-semibold tracking-tight truncate" style={{ color: roleColor }}>
                      {roleLabel}
                    </span>
                  </>
                )}
              </div>
              <button onClick={toggleSidebar} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              {isAdmin && activeAdminModule && !onAdminHub ? (
                <AdminModuleSwitcher activeModule={activeAdminModule} collapsed={true} />
              ) : null}
              <button onClick={toggleSidebar} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mx-auto">
                <Menu className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => {
          const siblingUrls = group.items.map((item) => item.url);
          const groupHasActive = group.items.some((item) =>
            isAdminNavItemActive(
              location.pathname,
              location.search,
              item.url,
              siblingUrls,
            ),
          );

          return (
            <CollapsibleGroup
              key={group.label}
              label={group.label}
              defaultOpen={groupHasActive}
              collapsed={collapsed}
            >
              {group.items.map((item) => {
                const active = isAdminNavItemActive(
                  location.pathname,
                  location.search,
                  item.url,
                  siblingUrls,
                );
                return (
                  <SidebarMenuItem key={`${group.label}-${item.title}`}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink
                        to={item.url}
                        end
                        className="sidebar-nav-item transition-all duration-200 rounded-lg"
                        activeClassName="text-white font-medium shadow-sm"
                        style={active ? { backgroundColor: ICON_COLORS.activeNav, color: "white" } : undefined}
                      >
                        <item.icon
                          className="h-4 w-4"
                          style={{ color: active ? "white" : item.iconColor }}
                        />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </CollapsibleGroup>
          );
        })}

        {isAdmin && (
          <WorkspaceButtons
            targets={["farm", "marketplace", "vet", "vetbondhu", "medibondhu", "medibondhuDoctor", "learning", "community"]}
            collapsed={collapsed}
            sectionLabel="Preview workspaces"
          />
        )}
        {!isAdmin && (
          <WorkspaceButtons currentWorkspace={currentWorkspace} collapsed={collapsed} />
        )}

        {/* Bottom section: Access Center, Profile, Settings */}
        <div className="px-2 py-1">
          <Separator className="my-2" />
          <SidebarMenu>
            {BOTTOM_ITEMS.map((item) => {
              const active = location.pathname === item.url;
              return (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={active}>
                    <NavLink to={item.url} end className="sidebar-nav-item transition-all duration-200 rounded-lg" activeClassName="text-white font-medium shadow-sm" style={active ? { backgroundColor: ICON_COLORS.activeNav, color: "white" } : undefined}>
                      <item.icon className="h-4 w-4" style={{ color: active ? "white" : item.iconColor }} />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <button onClick={() => navigate("/admin/profile")} className="flex items-center gap-2 mb-2 px-1 w-full hover:opacity-80 transition-opacity cursor-pointer">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: ICON_COLORS.profile }}>
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{formatUserRoleLabel(user)}</p>
            </div>
          </button>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={logout}
          className="w-full bg-red-500 text-black hover:bg-red-600 hover:text-black transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

const GROUP_COLORS: Record<string, string> = {
  "Farm Management": ICON_COLORS.farm,
  "Marketplace": ICON_COLORS.cart,
  "MediBondhu": ICON_COLORS.stethoscope,
  "Learning": ICON_COLORS.learning,
  "Admin Panel": ICON_COLORS.admin,
  "Platform": ICON_COLORS.admin,
  "Farm Management": ICON_COLORS.farm,
  "VetBondhu": ICON_COLORS.vetbondhu,
  "MediBondhu": ICON_COLORS.medibondhu,
  "Marketplace": ICON_COLORS.cart,
  "Marketplace admin": ICON_COLORS.cart,
  "FarmBondhu official shop": ICON_COLORS.farm,
  "Navigation": ICON_COLORS.admin,
  "Community": ICON_COLORS.community,
  "Vet Services": ICON_COLORS.stethoscope,
  "Store Management": ICON_COLORS.cart,
};

function CollapsibleGroup({
  label,
  defaultOpen,
  collapsed,
  children,
}: {
  label: string;
  defaultOpen: boolean;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  const groupColor = GROUP_COLORS[label] || "currentColor";
  const [open, setOpen] = useState(defaultOpen);

  if (collapsed) {
    return (
      <div className="px-2 py-1">
        <SidebarMenu>{children}</SidebarMenu>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="px-2 py-1">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors rounded-md hover:bg-accent/50 cursor-pointer" style={{ color: groupColor }}>
        <span>{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <SidebarMenu>{children}</SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );
}
