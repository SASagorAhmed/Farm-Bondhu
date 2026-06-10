import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { MarketplaceChatFocusProvider } from "@/contexts/MarketplaceChatFocusContext";
import MarketplaceChatAlertsHost from "@/components/marketplace/MarketplaceChatAlertsHost";
import GlobalNotificationAlertsHost from "@/components/layout/GlobalNotificationAlertsHost";
import { CartProvider } from "@/contexts/CartContext";
import { OrderProvider } from "@/contexts/OrderContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthRedirect from "@/components/AuthRedirect";

// Layouts
import FarmLayout from "@/components/layout/FarmLayout";
import BuyerLayout from "@/components/layout/BuyerLayout";
import VendorLayout from "@/components/layout/VendorLayout";
import VetLayout from "@/components/layout/VetLayout";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LearningLayout from "@/components/layout/LearningLayout";
import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import MediBondhuLayout from "@/components/layout/MediBondhuLayout";
import VetBondhuLayout from "@/components/layout/VetBondhuLayout";
import PhotoEditorLayout from "@/components/layout/PhotoEditorLayout";
import PhotoEditorHome from "@/features/photoEditor/pages/PhotoEditorHome";
import PhotoEditorWorkspace from "@/features/photoEditor/pages/PhotoEditorWorkspace";
import PhotoEditorDrafts from "@/features/photoEditor/pages/PhotoEditorDrafts";
import ProfileLayoutWrapper from "@/components/layout/ProfileLayoutWrapper";

// Public pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import AccessDenied from "./pages/AccessDenied";

// Dashboard pages (Farmer)
import Overview from "./pages/dashboard/Overview";
import Farms from "./pages/dashboard/Farms";
import Animals from "./pages/dashboard/Animals";
import Feed from "./pages/dashboard/Feed";
import Health from "./pages/dashboard/Health";
import Production from "./pages/dashboard/Production";
import Finances from "./pages/dashboard/Finances";
import Mortality from "./pages/dashboard/Mortality";
import Sales from "./pages/dashboard/Sales";
import CowWeightEstimator from "./pages/dashboard/cowWeight/CowWeightEstimator";
import Notifications from "./pages/dashboard/Notifications";

// Marketplace pages
import Marketplace from "./pages/marketplace/Marketplace";
import Cart from "./pages/marketplace/Cart";
import Orders from "./pages/marketplace/Orders";
import OrderTracking from "./pages/marketplace/OrderTracking";
import Checkout from "./pages/marketplace/Checkout";
import ReturnRequest from "./pages/marketplace/ReturnRequest";
import SellerDashboard from "./pages/marketplace/SellerDashboard";
import SellerOnboarding from "./pages/marketplace/SellerOnboarding";
import SellerOrders from "./pages/marketplace/SellerOrders";
import SellerOrderDetail from "./pages/marketplace/SellerOrderDetail";
import Products from "./pages/vendor/Products";
import SellerProductDetail from "./pages/vendor/SellerProductDetail";
import Inventory from "./pages/vendor/Inventory";
import Payouts from "./pages/vendor/Payouts";
import VendorReviews from "./pages/vendor/Reviews";
import VendorSettings from "./pages/vendor/VendorSettings";
import MyShop from "./pages/marketplace/MyShop";
import SellerShopPage from "./pages/marketplace/SellerShopPage";
import BuyerHome from "./pages/marketplace/BuyerHome";
import Categories from "./pages/marketplace/Categories";
import Wishlist from "./pages/marketplace/Wishlist";

// MediBondhu — human physician module only (VetBondhu uses `/vetbondhu`).
import Specialities from "./pages/medibondhu/Specialities";
import DoctorDirectory from "./pages/medibondhu/DoctorDirectory";
import DoctorProfile from "./pages/medibondhu/DoctorProfile";
import BookConsultation from "./pages/medibondhu/BookConsultation";
import Prescriptions from "./pages/medibondhu/Prescriptions";
import AppointmentDetail from "./pages/medibondhu/AppointmentDetail";
import MediWaitingRoom from "./pages/medibondhu/MediWaitingRoom";
import MediHumanConsultationRoom from "./pages/medibondhu/MediHumanConsultationRoom";
import PrescriptionDetailHuman from "./pages/medibondhu/PrescriptionDetailHuman";
import MediDoctorDashboard from "./pages/doctor/MediDoctorDashboard";
import MediDoctorSchedule from "./pages/doctor/MediDoctorSchedule";
import MediDoctorPrescriptions from "./pages/doctor/MediDoctorPrescriptions";
import MediDoctorPrescriptionNew from "./pages/doctor/MediDoctorPrescriptionNew";
import MediDoctorProfileSetup from "./pages/doctor/MediDoctorProfileSetup";
import MediDoctorConsultations from "./pages/doctor/MediDoctorConsultations";
import MediDoctorPatients from "./pages/doctor/MediDoctorPatients";
import MediDoctorEarnings from "./pages/doctor/MediDoctorEarnings";

import VetBondhuSpecialities from "./pages/vetbondhu/Specialities";
import VetBondhuDirectory from "./pages/vetbondhu/VetDirectory";
import VetBondhuVetProfile from "./pages/vetbondhu/VetProfile";
import VetBondhuBookConsultation from "./pages/vetbondhu/BookConsultation";
import VetBondhuWaitingRoom from "./pages/vetbondhu/WaitingRoom";
import VetBondhuConsultationRoom from "./pages/vetbondhu/ConsultationRoom";
import VetBondhuPrescriptions from "./pages/vetbondhu/Prescriptions";
import VetBondhuAccessDenied from "./pages/vetbondhu/VetBondhuAccessDenied";

// Learning
import LearningCenter from "./pages/learning/LearningCenter";
import LearningDashboard from "./pages/learning/LearningDashboard";
import MyCourses from "./pages/learning/MyCourses";
import CoursePlayer from "./pages/learning/CoursePlayer";
import CourseDetail from "./pages/learning/CourseDetail";

// Vet pages
import VetDashboard from "./pages/vet/VetDashboard";
import VetEarnings from "./pages/vet/VetEarnings";
import VetProfilePage from "./pages/vet/VetProfilePage";
import VetConsultations from "./pages/vet/VetConsultations";
import VetPrescriptions from "./pages/vet/VetPrescriptions";
import CreatePrescription from "./pages/vet/CreatePrescription";
import PrescriptionDetail from "./pages/vet/PrescriptionDetail";

// Profile
import ProfilePage from "./pages/profile/ProfilePage";
import AccessCenter from "./pages/profile/AccessCenter";
import Settings from "./pages/profile/Settings";
import MarketplaceSettings from "./pages/marketplace/MarketplaceSettings";
import CustomerSupportPage from "./pages/profile/CustomerSupportPage";
import SupportChatThread from "./pages/profile/SupportChatThread";
import SupportContextRedirect from "./components/SupportContextRedirect";

// Admin pages
import AdminMarketplace from "./pages/admin/AdminMarketplace";
import AdminSellerLaneApprovals from "./pages/admin/AdminSellerLaneApprovals";
import OfficialShopAdminLayout from "./pages/admin/farmbondhuShop/OfficialShopAdminLayout";
import FarmBondhuShopOverview from "./pages/admin/farmbondhuShop/FarmBondhuShopOverview";
import OfficialShopProducts from "./pages/admin/farmbondhuShop/OfficialShopProducts";
import OfficialShopProductDetail from "./pages/admin/farmbondhuShop/OfficialShopProductDetail";
import OfficialShopMyShop from "./pages/admin/farmbondhuShop/OfficialShopMyShop";
import OfficialShopPhotoEditor from "./pages/admin/farmbondhuShop/OfficialShopPhotoEditor";
import { ADMIN_PHOTO_EDITOR_BASE } from "@/features/photoEditor/lib/photoEditorPaths";
import OfficialShopOrders from "./pages/admin/farmbondhuShop/OfficialShopOrders";
import OfficialShopOrderDetail from "./pages/admin/farmbondhuShop/OfficialShopOrderDetail";
import OfficialShopInventory from "./pages/admin/farmbondhuShop/OfficialShopInventory";
import OfficialShopPayouts from "./pages/admin/farmbondhuShop/OfficialShopPayouts";
import OfficialShopReviews from "./pages/admin/farmbondhuShop/OfficialShopReviews";
import OfficialShopSettings from "./pages/admin/farmbondhuShop/OfficialShopSettings";
import OfficialShopMessages from "./pages/admin/farmbondhuShop/OfficialShopMessages";
import Reports from "./pages/admin/Reports";
import ApprovalQueue from "./pages/admin/ApprovalQueue";
import AdminBroadcast from "./pages/admin/AdminBroadcast";
import AdminTeam from "./pages/admin/AdminTeam";
import AdminLearning from "./pages/admin/AdminLearning";
import AdminVetBondhuOverview from "./pages/admin/AdminMediBondhu";
import AdminVetBondhuAccess from "./pages/admin/AdminVetBondhuAccess";
import AdminMediBondhuAccess from "./pages/admin/AdminMediBondhuAccess";
import AdminFarms from "./pages/admin/AdminFarms";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminOrderDetail from "./pages/admin/AdminOrderDetail";
import AdminMarketplaceBuyers from "./pages/admin/AdminMarketplaceBuyers";
import AdminMarketplaceSellers from "./pages/admin/AdminMarketplaceSellers";
import AdminMarketplaceTransactions from "./pages/admin/AdminMarketplaceTransactions";
import AdminMarketplaceSellerPayouts from "./pages/admin/AdminMarketplaceSellerPayouts";
import AdminPlatformMessages from "./pages/admin/AdminPlatformMessages";
import AdminCustomerSupport from "./pages/admin/AdminCustomerSupport";
import AdminModerationReports from "./pages/admin/AdminModerationReports";
import AdminMarketplaceReports from "./pages/admin/AdminMarketplaceReports";
import AdminMarketplaceReviews from "./pages/admin/AdminMarketplaceReviews";
import AdminCommunity from "./pages/admin/AdminCommunity";
import VetApprovals from "./pages/admin/VetApprovals";
import AdminMediBondhuHuman from "./pages/admin/AdminMediBondhuHuman";
import AdminMediBondhuPayouts from "./pages/admin/AdminMediBondhuPayouts";
import AdminCowDetectionExport from "./pages/admin/AdminCowDetectionExport";
import AdminModuleHub from "./pages/admin/AdminModuleHub";
import AdminEmailAudit from "./pages/admin/AdminEmailAudit";

// Community pages
import CommunityLayout from "@/components/layout/CommunityLayout";
import CommunityFeed from "./pages/community/CommunityFeed";
import CreatePost from "./pages/community/CreatePost";
import PostDetail from "./pages/community/PostDetail";
import MyPosts from "./pages/community/MyPosts";
import SavedPosts from "./pages/community/SavedPosts";

import { queryClient } from "@/lib/queryClient";

import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { markRouteTransition, measureRouteTransition } from "@/lib/perfMetrics";
import { API_BASE, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

const importProductDetail = () => import("./pages/marketplace/ProductDetail");
const importBuyerInbox = () => import("./pages/marketplace/BuyerInbox");
const importChatDetail = () => import("./pages/marketplace/ChatDetail");
const importConsultations = () => import("./pages/medibondhu/Consultations");
const importVetbondhuConsultations = () => import("./pages/vetbondhu/Consultations");
const importAdminDashboard = () => import("./pages/admin/AdminDashboard");
const importUserManagement = () => import("./pages/admin/UserManagement");
const importVetPatients = () => import("./pages/vet/VetPatients");
const importVetAvailability = () => import("./pages/vet/VetAvailability");
const importCategoryFeed = () => import("./pages/community/CategoryFeed");
const importCommunityHistory = () => import("./pages/community/CommunityHistory");

const ProductDetail = lazy(importProductDetail);
const BuyerInbox = lazy(importBuyerInbox);
const ChatDetail = lazy(importChatDetail);
const Consultations = lazy(importConsultations);
const VetbondhuConsultations = lazy(importVetbondhuConsultations);
const AdminDashboard = lazy(importAdminDashboard);
const UserManagement = lazy(importUserManagement);
const VetPatients = lazy(importVetPatients);
const VetAvailability = lazy(importVetAvailability);
const CategoryFeed = lazy(importCategoryFeed);
const CommunityHistory = lazy(importCommunityHistory);

function RoutePerfTracker() {
  const location = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    const path = location.pathname;
    markRouteTransition(path);
    const handle = window.requestAnimationFrame(() => {
      measureRouteTransition(path);
    });
    return () => window.cancelAnimationFrame(handle);
  }, [location.pathname, navType]);

  return null;
}

function RouteIntentPrefetch() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const prefetchByRoute = (path: string) => {
      const route = String(path || "");
      if (!route) return;

      if (route.startsWith("/marketplace/inbox")) {
        void importBuyerInbox();
      } else if (route.startsWith("/marketplace/chat")) {
        void importChatDetail();
      } else if (route.startsWith("/marketplace/")) {
        void importProductDetail();
      } else if (route.startsWith("/community/category")) {
        void importCategoryFeed();
      } else if (route.startsWith("/community/history")) {
        void importCommunityHistory();
      } else if (route.startsWith("/vet/patients")) {
        void importVetPatients();
      } else if (route.startsWith("/vet/availability")) {
        void importVetAvailability();
      } else if (route.startsWith("/admin/users")) {
        void importUserManagement();
      } else if (route.startsWith("/admin")) {
        void importAdminDashboard();
      } else if (route.startsWith("/medibondhu/consultations")) {
        void importConsultations();
      } else if (route.startsWith("/vetbondhu/consultations")) {
        void importVetbondhuConsultations();
      }
    };

    const prefetchData = async (path: string) => {
      const token = readSession()?.access_token;
      if (!token || !user?.id) return;
      const headers = { Authorization: `Bearer ${token}` };
      if (path.startsWith("/marketplace/inbox")) {
        await queryClient.prefetchQuery({
          queryKey: ["buyer-inbox", user.id],
          queryFn: async () => {
            const res = await fetch(`${API_BASE}/v1/marketplace/chat/inbox`, { headers });
            const body = (await res.json().catch(() => ({}))) as { data?: unknown[] };
            return body.data || [];
          },
          staleTime: 3 * 60 * 1000,
        });
      }
      if (path.startsWith("/community")) {
        await queryClient.prefetchQuery({
          queryKey: ["community-feed", "active"],
          queryFn: async () => {
            const [postsRes, profilesRes] = await Promise.all([
              fetch(`${API_BASE}/v1/compat/from`, {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ action: "select", table: "community_posts", mode: "active_latest", user_id: user.id }),
              }),
              fetch(`${API_BASE}/v1/profiles/${user.id}`, { headers }),
            ]);
            const postsBody = (await postsRes.json().catch(() => ({}))) as { data?: unknown[] };
            const profileBody = (await profilesRes.json().catch(() => ({}))) as { data?: { id?: string; name?: string; primary_role?: string } };
            const profile = profileBody.data;
            const profiles = profile?.id ? { [profile.id]: { name: profile.name || "User", primary_role: profile.primary_role || "farmer" } } : {};
            return { posts: postsBody.data || [], profiles };
          },
          staleTime: 3 * 60 * 1000,
        });
      }
    };

    const onIntentPrefetch = (evt: Event) => {
      const path = String((evt as CustomEvent<string>).detail || "");
      prefetchByRoute(path);
      void prefetchData(path);
    };

    window.addEventListener("farmbondhu:prefetch-route", onIntentPrefetch as EventListener);
    prefetchByRoute(location.pathname);
    return () => {
      window.removeEventListener("farmbondhu:prefetch-route", onIntentPrefetch as EventListener);
    };
  }, [location.pathname, user?.id]);

  return null;
}

function LazyPage({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading page...</div>}>
      {children}
    </Suspense>
  );
}

const App = () => (
  <ThemeProvider>
  <LanguageProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RoutePerfTracker />
        <AuthProvider>
          <MarketplaceChatFocusProvider>
          <MarketplaceChatAlertsHost />
          <GlobalNotificationAlertsHost />
          <RouteIntentPrefetch />
          <CartProvider>
            <OrderProvider>
              <Routes>
                {/* Public */}
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/access-denied" element={<AccessDenied />} />

                {/* Auth redirect */}
                <Route path="/home" element={<ProtectedRoute><AuthRedirect /></ProtectedRoute>} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfileLayoutWrapper /></ProtectedRoute>}>
                  <Route index element={<ProfilePage />} />
                </Route>
                <Route path="/support/*" element={<ProtectedRoute><SupportContextRedirect /></ProtectedRoute>} />
                <Route path="/access-center" element={<ProtectedRoute><BuyerLayout /></ProtectedRoute>}>
                  <Route index element={<AccessCenter />} />
                </Route>

                {/* ============ FARMER routes (requires can_manage_farm) ============ */}
                <Route path="/dashboard" element={<ProtectedRoute requiredCapability="can_manage_farm"><FarmLayout /></ProtectedRoute>}>
                  <Route index element={<Overview />} />
                  <Route path="farms" element={<Farms />} />
                  <Route path="animals" element={<Animals />} />
                  <Route path="cow-weight/*" element={<CowWeightEstimator />} />
                  <Route path="feed" element={<Feed />} />
                  <Route path="health" element={<Health />} />
                  <Route path="production" element={<Production />} />
                  <Route path="finances" element={<Finances />} />
                  <Route path="mortality" element={<Mortality />} />
                  <Route path="sales" element={<Sales />} />
                  <Route path="notifications" element={<Notifications contextFilter={["farm", "general"]} />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="access-center" element={<AccessCenter />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="support" element={<CustomerSupportPage />} />
                  <Route path="support/chat/:conversationId" element={<SupportChatThread />} />
                </Route>

                {/* ============ BUYER routes (buyer-only layout, no extra capabilities needed) ============ */}
                <Route path="/buyer" element={<ProtectedRoute allowedRoles={["buyer"]}><BuyerLayout /></ProtectedRoute>}>
                  <Route index element={<BuyerHome />} />
                  <Route path="home" element={<BuyerHome />} />
                  <Route path="categories" element={<Categories />} />
                  <Route path="wishlist" element={<Wishlist />} />
                  <Route path="notifications" element={<Notifications contextFilter={["marketplace", "general"]} />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="access-center" element={<AccessCenter />} />
                  <Route path="support" element={<CustomerSupportPage />} />
                  <Route path="support/chat/:conversationId" element={<SupportChatThread />} />
                </Route>

                {/* ============ LEARNING (requires can_access_learning) ============ */}
                <Route path="/learning" element={<ProtectedRoute requireAnyCapability={["can_access_learning", "can_book_vet"]}><LearningLayout /></ProtectedRoute>}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="articles" element={<LearningCenter />} />
                  <Route path="dashboard" element={<LearningDashboard />} />
                  <Route path="my-course" element={<MyCourses />} />
                  <Route path="my-course/:courseId" element={<CoursePlayer />} />
                  <Route path="courses/:courseId" element={<CourseDetail />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="notifications" element={<Notifications contextFilter={["learning", "general"]} />} />
                  <Route path="access-center" element={<AccessCenter />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="support" element={<CustomerSupportPage />} />
                  <Route path="support/chat/:conversationId" element={<SupportChatThread />} />
                </Route>

                {/* ============ MARKETPLACE (requires can_buy) ============ */}
                <Route path="/marketplace" element={<ProtectedRoute requireAnyCapability={["can_buy", "can_bulk_buy", "can_sell"]}><MarketplaceLayout /></ProtectedRoute>}>
                  <Route index element={<Marketplace />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="notifications" element={<Notifications contextFilter={["marketplace", "general"]} />} />
                  <Route path="access-center" element={<AccessCenter />} />
                  <Route path="settings" element={<MarketplaceSettings />} />
                  <Route path="support" element={<CustomerSupportPage />} />
                  <Route path="support/chat/:conversationId" element={<SupportChatThread />} />
                  <Route path="inbox" element={<LazyPage><BuyerInbox /></LazyPage>} />
                  <Route path="chat/:conversationId" element={<LazyPage><ChatDetail /></LazyPage>} />
                  <Route path="cow-weight/*" element={<CowWeightEstimator />} />
                  <Route path="shop/:sellerId" element={<SellerShopPage />} />
                  <Route path=":id" element={<LazyPage><ProductDetail /></LazyPage>} />
                </Route>
                <Route path="/cart" element={<ProtectedRoute requireAnyCapability={["can_buy", "can_bulk_buy"]}><MarketplaceLayout /></ProtectedRoute>}>
                  <Route index element={<Cart />} />
                </Route>
                <Route path="/checkout" element={<ProtectedRoute requireAnyCapability={["can_buy", "can_bulk_buy"]}><MarketplaceLayout /></ProtectedRoute>}>
                  <Route index element={<Checkout />} />
                </Route>
                <Route path="/orders" element={<ProtectedRoute requireAnyCapability={["can_buy", "can_bulk_buy"]}><MarketplaceLayout /></ProtectedRoute>}>
                  <Route index element={<Orders />} />
                  <Route path=":orderId" element={<OrderTracking />} />
                  <Route path=":orderId/return" element={<ReturnRequest />} />
                </Route>

                {/* ============ SELLER routes (requires can_sell) ============ */}
                <Route path="/my-shop" element={<ProtectedRoute><MarketplaceLayout /></ProtectedRoute>}>
                  <Route index element={<MyShop />} />
                </Route>
                <Route path="/seller/onboarding" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                  <Route index element={<SellerOnboarding />} />
                </Route>
                <Route path="/seller" element={<ProtectedRoute requiredCapability="can_sell"><VendorLayout /></ProtectedRoute>}>
                  <Route path="photo-editor" element={<PhotoEditorHome />} />
                  <Route path="photo-editor/drafts" element={<PhotoEditorDrafts />} />
                  <Route path="my-shop" element={<MyShop />} />
                  <Route path="dashboard" element={<SellerDashboard />} />
                  <Route path="orders" element={<SellerOrders />} />
                  <Route path="orders/:orderId" element={<SellerOrderDetail />} />
                  <Route path="products" element={<Products />} />
                  <Route path="products/:productId" element={<SellerProductDetail />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="payouts" element={<Payouts />} />
                  <Route path="reviews" element={<VendorReviews />} />
                  <Route path="settings" element={<VendorSettings />} />
                  <Route path="notifications" element={<Notifications contextFilter={["marketplace", "general"]} />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="access-center" element={<AccessCenter />} />
                  <Route path="support" element={<CustomerSupportPage />} />
                  <Route path="support/chat/:conversationId" element={<SupportChatThread />} />
                </Route>
                <Route
                  path="/seller/photo-editor/edit"
                  element={
                    <ProtectedRoute requiredCapability="can_sell">
                      <PhotoEditorLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="new" element={<PhotoEditorWorkspace />} />
                  <Route path=":draftId" element={<PhotoEditorWorkspace />} />
                </Route>

                <Route
                  path="/admin/farmbondhu-shop/photo-editor/edit"
                  element={
                    <ProtectedRoute requiredCapability="can_manage_platform">
                      <PhotoEditorLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="new" element={<PhotoEditorWorkspace />} />
                  <Route path=":draftId" element={<PhotoEditorWorkspace />} />
                </Route>

                {/* ============ VET routes (requires can_consult_as_vet) ============ */}
                <Route path="/vet" element={<ProtectedRoute allowedRoles={["vet", "admin"]}><VetLayout /></ProtectedRoute>}>
                  <Route path="dashboard" element={<VetDashboard />} />
                  <Route path="consultations" element={<VetConsultations />} />
                  <Route path="room/:bookingId" element={<VetBondhuConsultationRoom />} />
                  <Route path="patients" element={<LazyPage><VetPatients /></LazyPage>} />
                  <Route path="prescriptions" element={<VetPrescriptions />} />
                  <Route path="prescriptions/create" element={<CreatePrescription />} />
                  <Route path="prescriptions/:prescriptionId" element={<PrescriptionDetail />} />
                  <Route path="availability" element={<LazyPage><VetAvailability /></LazyPage>} />
                  <Route path="earnings" element={<VetEarnings />} />
                  <Route path="profile" element={<VetProfilePage />} />
                  <Route path="profile-account" element={<VetProfilePage />} />
                  <Route path="access-center" element={<AccessCenter />} />
                  <Route path="notifications" element={<Notifications contextFilter={["vet", "general"]} />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="support" element={<CustomerSupportPage />} />
                  <Route path="support/chat/:conversationId" element={<SupportChatThread />} />
                  <Route path="cow-weight/*" element={<CowWeightEstimator />} />
                </Route>

                {/* ============ MEDIBONDHU — human outpatient; VetBondhu (/vetbondhu) is animal telemed ============ */}
                <Route
                  path="/medibondhu"
                  element={
                    <ProtectedRoute
                      requireAnyCapability={["can_book_human", "can_practice_human", "can_manage_platform"]}
                      capabilityBypassRoles={["doctor"]}
                    >
                      <MediBondhuLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Specialities />} />
                  <Route path="doctors" element={<DoctorDirectory />} />
                  <Route path="doctor/:id" element={<DoctorProfile />} />
                  <Route path="book/:doctorId" element={<BookConsultation />} />
                  <Route path="appointment/:appointmentId" element={<AppointmentDetail />} />
                  <Route path="waiting/:appointmentId" element={<MediWaitingRoom />} />
                  <Route path="room/:appointmentId" element={<MediHumanConsultationRoom />} />
                  <Route path="consultations" element={<LazyPage><Consultations /></LazyPage>} />
                  <Route path="prescriptions" element={<Prescriptions />} />
                  <Route path="prescription/:id" element={<PrescriptionDetailHuman />} />
                  <Route
                    path="doctor/dashboard"
                    element={
                      <ProtectedRoute requireAnyCapability={["can_practice_human", "can_manage_platform"]}>
                        <MediDoctorDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="doctor/schedule"
                    element={
                      <ProtectedRoute requireAnyCapability={["can_practice_human", "can_manage_platform"]}>
                        <MediDoctorSchedule />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="doctor/consultations"
                    element={
                      <ProtectedRoute requireAnyCapability={["can_practice_human", "can_manage_platform"]}>
                        <MediDoctorConsultations />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="doctor/patients"
                    element={
                      <ProtectedRoute requireAnyCapability={["can_practice_human", "can_manage_platform"]}>
                        <MediDoctorPatients />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="doctor/prescriptions"
                    element={
                      <ProtectedRoute requireAnyCapability={["can_practice_human", "can_manage_platform"]}>
                        <MediDoctorPrescriptions />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="doctor/earnings"
                    element={
                      <ProtectedRoute requireAnyCapability={["can_practice_human", "can_manage_platform"]}>
                        <MediDoctorEarnings />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="doctor/rx/new"
                    element={
                      <ProtectedRoute requireAnyCapability={["can_practice_human", "can_manage_platform"]}>
                        <MediDoctorPrescriptionNew />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="doctor/profile-setup" element={<Navigate to="/medibondhu/profile" replace />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="notifications" element={<Notifications contextFilter={["medibondhu", "general"]} />} />
                  <Route path="access-center" element={<AccessCenter />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="support" element={<CustomerSupportPage />} />
                  <Route path="support/chat/:conversationId" element={<SupportChatThread />} />
                </Route>

                {/* ============ VETBONDHU (isolated animal-care consult surface) ============ */}
                <Route path="/vetbondhu/access-denied" element={<VetBondhuAccessDenied />} />
                <Route
                  path="/vetbondhu"
                  element={
                    <ProtectedRoute requireAnyCapability={["can_book_vet", "can_consult_as_vet"]}>
                      <VetBondhuLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<VetBondhuSpecialities />} />
                  <Route path="vets" element={<VetBondhuDirectory />} />
                  <Route path="vet/:id" element={<VetBondhuVetProfile />} />
                  <Route path="book/:vetId" element={<VetBondhuBookConsultation />} />
                  <Route path="waiting/:bookingId" element={<VetBondhuWaitingRoom />} />
                  <Route path="room/:bookingId" element={<VetBondhuConsultationRoom />} />
                  <Route path="consultations" element={<LazyPage><VetbondhuConsultations /></LazyPage>} />
                  <Route path="prescriptions" element={<VetBondhuPrescriptions />} />
                  <Route path="cow-weight/*" element={<CowWeightEstimator />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="notifications" element={<Notifications contextFilter={["vetbondhu", "vet", "medibondhu", "general"]} />} />
                  <Route path="access-center" element={<AccessCenter />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="support" element={<CustomerSupportPage />} />
                  <Route path="support/chat/:conversationId" element={<SupportChatThread />} />
                </Route>

                {/* ============ COMMUNITY (any authenticated user) ============ */}
                <Route path="/community" element={<ProtectedRoute requiredCapability="can_access_community"><CommunityLayout /></ProtectedRoute>}>
                  <Route index element={<CommunityFeed />} />
                  <Route path="create" element={<CreatePost />} />
                  <Route path="post/:id" element={<PostDetail />} />
                  <Route path="category/:category" element={<LazyPage><CategoryFeed /></LazyPage>} />
                  <Route path="my-posts" element={<MyPosts />} />
                  <Route path="saved" element={<SavedPosts />} />
                  <Route path="history" element={<LazyPage><CommunityHistory /></LazyPage>} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="notifications" element={<Notifications contextFilter={["community"]} />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="support" element={<CustomerSupportPage />} />
                  <Route path="support/chat/:conversationId" element={<SupportChatThread />} />
                </Route>

                {/* ============ ADMIN (requires can_manage_platform) ============ */}
                <Route path="/admin" element={<ProtectedRoute requiredCapability="can_manage_platform"><DashboardLayout /></ProtectedRoute>}>
                  <Route index element={<AdminModuleHub />} />
                  <Route path="platform" element={<LazyPage><AdminDashboard /></LazyPage>} />
                  <Route path="dashboard" element={<Navigate to="/admin/platform" replace />} />
                  <Route path="users" element={<LazyPage><UserManagement /></LazyPage>} />
                  <Route path="approvals" element={<ApprovalQueue />} />
                  <Route path="vet-approvals" element={<VetApprovals />} />
                  <Route path="broadcast" element={<AdminBroadcast />} />
                  <Route path="email-audit" element={<AdminEmailAudit />} />
                  <Route path="team" element={<AdminTeam />} />
                  <Route path="farmbondhu-shop" element={<OfficialShopAdminLayout />}>
                    <Route index element={<FarmBondhuShopOverview />} />
                    <Route path="shop" element={<OfficialShopMyShop />} />
                    <Route path="products" element={<OfficialShopProducts />} />
                    <Route path="products/:productId" element={<OfficialShopProductDetail />} />
                    <Route path="photo-editor" element={<OfficialShopPhotoEditor />} />
                    <Route
                      path="photo-editor/drafts"
                      element={<PhotoEditorDrafts editorBasePath={ADMIN_PHOTO_EDITOR_BASE} />}
                    />
                    <Route path="orders" element={<OfficialShopOrders />} />
                    <Route path="orders/:orderId" element={<OfficialShopOrderDetail />} />
                    <Route path="inventory" element={<OfficialShopInventory />} />
                    <Route path="payouts" element={<OfficialShopPayouts />} />
                    <Route path="reviews" element={<OfficialShopReviews />} />
                    <Route path="settings" element={<OfficialShopSettings />} />
                    <Route path="messages" element={<OfficialShopMessages />} />
                  </Route>
                  <Route path="marketplace/seller-lanes" element={<AdminSellerLaneApprovals />} />
                  <Route path="marketplace/buyers" element={<AdminMarketplaceBuyers />} />
                  <Route path="marketplace/sellers" element={<AdminMarketplaceSellers />} />
                  <Route path="marketplace/transactions" element={<AdminMarketplaceTransactions />} />
                  <Route path="marketplace/payouts" element={<AdminMarketplaceSellerPayouts />} />
                  <Route path="marketplace/messages" element={<AdminPlatformMessages />} />
                  <Route path="marketplace/reports" element={<AdminMarketplaceReports />} />
                  <Route path="marketplace/reviews" element={<AdminMarketplaceReviews />} />
                  <Route path="moderation-reports" element={<AdminModerationReports />} />
                  <Route path="customer-support" element={<AdminCustomerSupport />} />
                  <Route path="marketplace" element={<AdminMarketplace />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="learning" element={<AdminLearning />} />
                  <Route path="vetbondhu-overview" element={<AdminVetBondhuOverview />} />
                  <Route path="medibondhu-overview" element={<Navigate to="/admin/vetbondhu-overview" replace />} />
                  <Route path="vetbondhu-access" element={<AdminVetBondhuAccess />} />
                  <Route path="medibondhu-access" element={<AdminMediBondhuAccess />} />
                  <Route path="medibondhu-human" element={<AdminMediBondhuHuman />} />
                  <Route path="medibondhu-payouts" element={<AdminMediBondhuPayouts />} />
                  <Route path="farms" element={<AdminFarms />} />
                  <Route path="orders/:orderId" element={<AdminOrderDetail />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="community" element={<AdminCommunity />} />
                  <Route path="cow-detection-export" element={<AdminCowDetectionExport />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="support" element={<CustomerSupportPage />} />
                  <Route path="support/chat/:conversationId" element={<SupportChatThread />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </OrderProvider>
          </CartProvider>
          </MarketplaceChatFocusProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </LanguageProvider>
  </ThemeProvider>
);

export default App;
