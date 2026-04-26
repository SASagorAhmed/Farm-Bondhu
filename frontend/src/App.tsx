import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
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
import Notifications from "./pages/dashboard/Notifications";

// Marketplace pages
import Marketplace from "./pages/marketplace/Marketplace";
import ProductDetail from "./pages/marketplace/ProductDetail";
import Cart from "./pages/marketplace/Cart";
import Orders from "./pages/marketplace/Orders";
import OrderTracking from "./pages/marketplace/OrderTracking";
import Checkout from "./pages/marketplace/Checkout";
import ReturnRequest from "./pages/marketplace/ReturnRequest";
import SellerDashboard from "./pages/marketplace/SellerDashboard";
import SellerOrders from "./pages/marketplace/SellerOrders";
import Products from "./pages/vendor/Products";
import Inventory from "./pages/vendor/Inventory";
import Payouts from "./pages/vendor/Payouts";
import VendorReviews from "./pages/vendor/Reviews";
import VendorSettings from "./pages/vendor/VendorSettings";
import MyShop from "./pages/marketplace/MyShop";
import BuyerHome from "./pages/marketplace/BuyerHome";
import Categories from "./pages/marketplace/Categories";
import Wishlist from "./pages/marketplace/Wishlist";
import BuyerInbox from "./pages/marketplace/BuyerInbox";
import ChatDetail from "./pages/marketplace/ChatDetail";

// MediBondhu pages
import Specialities from "./pages/medibondhu/Specialities";
import VetDirectory from "./pages/medibondhu/VetDirectory";
import VetProfile from "./pages/medibondhu/VetProfile";
import BookConsultation from "./pages/medibondhu/BookConsultation";
import WaitingRoom from "./pages/medibondhu/WaitingRoom";
import ConsultationRoom from "./pages/medibondhu/ConsultationRoom";
import Consultations from "./pages/medibondhu/Consultations";
import Prescriptions from "./pages/medibondhu/Prescriptions";

// Learning
import LearningCenter from "./pages/learning/LearningCenter";

// Vet pages
import VetDashboard from "./pages/vet/VetDashboard";
import VetPatients from "./pages/vet/VetPatients";
import VetAvailability from "./pages/vet/VetAvailability";
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

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import AdminMarketplace from "./pages/admin/AdminMarketplace";
import FarmBondhuShop from "./pages/admin/FarmBondhuShop";
import Reports from "./pages/admin/Reports";
import ApprovalQueue from "./pages/admin/ApprovalQueue";
import AdminBroadcast from "./pages/admin/AdminBroadcast";
import AdminTeam from "./pages/admin/AdminTeam";
import AdminLearning from "./pages/admin/AdminLearning";
import AdminMediBondhu from "./pages/admin/AdminMediBondhu";
import AdminFarms from "./pages/admin/AdminFarms";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminCommunity from "./pages/admin/AdminCommunity";
import VetApprovals from "./pages/admin/VetApprovals";

// Community pages
import CommunityLayout from "@/components/layout/CommunityLayout";
import CommunityFeed from "./pages/community/CommunityFeed";
import CreatePost from "./pages/community/CreatePost";
import PostDetail from "./pages/community/PostDetail";
import CategoryFeed from "./pages/community/CategoryFeed";
import UnansweredPosts from "./pages/community/UnansweredPosts";
import UrgentPosts from "./pages/community/UrgentPosts";
import MyPosts from "./pages/community/MyPosts";
import SavedPosts from "./pages/community/SavedPosts";
import CommunityHistory from "./pages/community/CommunityHistory";

const queryClient = new QueryClient();

import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/components/ThemeProvider";

const App = () => (
  <ThemeProvider>
  <LanguageProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
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
                <Route path="/access-center" element={<ProtectedRoute><BuyerLayout /></ProtectedRoute>}>
                  <Route index element={<AccessCenter />} />
                </Route>

                {/* ============ FARMER routes (requires can_manage_farm) ============ */}
                <Route path="/dashboard" element={<ProtectedRoute requiredCapability="can_manage_farm"><FarmLayout /></ProtectedRoute>}>
                  <Route index element={<Overview />} />
                  <Route path="farms" element={<Farms />} />
                  <Route path="animals" element={<Animals />} />
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
                </Route>

                {/* ============ LEARNING (requires can_access_learning) ============ */}
                <Route path="/learning" element={<ProtectedRoute requiredCapability="can_access_learning"><LearningLayout /></ProtectedRoute>}>
                  <Route index element={<LearningCenter />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="notifications" element={<Notifications contextFilter={["learning", "general"]} />} />
                  <Route path="access-center" element={<AccessCenter />} />
                  <Route path="settings" element={<Settings />} />
                </Route>

                {/* ============ MARKETPLACE (requires can_buy) ============ */}
                <Route path="/marketplace" element={<ProtectedRoute requiredCapability="can_buy"><MarketplaceLayout /></ProtectedRoute>}>
                  <Route index element={<Marketplace />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="notifications" element={<Notifications contextFilter={["marketplace", "general"]} />} />
                  <Route path="access-center" element={<AccessCenter />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="inbox" element={<BuyerInbox />} />
                  <Route path="chat/:conversationId" element={<ChatDetail />} />
                  <Route path=":id" element={<ProductDetail />} />
                </Route>
                <Route path="/cart" element={<ProtectedRoute requiredCapability="can_buy"><MarketplaceLayout /></ProtectedRoute>}>
                  <Route index element={<Cart />} />
                </Route>
                <Route path="/checkout" element={<ProtectedRoute requiredCapability="can_buy"><MarketplaceLayout /></ProtectedRoute>}>
                  <Route index element={<Checkout />} />
                </Route>
                <Route path="/orders" element={<ProtectedRoute requiredCapability="can_buy"><MarketplaceLayout /></ProtectedRoute>}>
                  <Route index element={<Orders />} />
                  <Route path=":orderId" element={<OrderTracking />} />
                  <Route path=":orderId/return" element={<ReturnRequest />} />
                </Route>

                {/* ============ SELLER routes (requires can_sell) ============ */}
                <Route path="/my-shop" element={<ProtectedRoute><MarketplaceLayout /></ProtectedRoute>}>
                  <Route index element={<MyShop />} />
                </Route>
                <Route path="/seller" element={<ProtectedRoute requiredCapability="can_sell"><VendorLayout /></ProtectedRoute>}>
                  <Route path="dashboard" element={<SellerDashboard />} />
                  <Route path="orders" element={<SellerOrders />} />
                  <Route path="products" element={<Products />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="payouts" element={<Payouts />} />
                  <Route path="reviews" element={<VendorReviews />} />
                  <Route path="settings" element={<VendorSettings />} />
                  <Route path="notifications" element={<Notifications contextFilter={["marketplace", "general"]} />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="access-center" element={<AccessCenter />} />
                </Route>

                {/* ============ VET routes (requires can_consult_as_vet) ============ */}
                <Route path="/vet" element={<ProtectedRoute allowedRoles={["vet", "admin"]}><VetLayout /></ProtectedRoute>}>
                  <Route path="dashboard" element={<VetDashboard />} />
                  <Route path="consultations" element={<VetConsultations />} />
                  <Route path="room/:bookingId" element={<ConsultationRoom />} />
                  <Route path="patients" element={<VetPatients />} />
                  <Route path="prescriptions" element={<VetPrescriptions />} />
                  <Route path="prescriptions/create" element={<CreatePrescription />} />
                  <Route path="prescriptions/:prescriptionId" element={<PrescriptionDetail />} />
                  <Route path="availability" element={<VetAvailability />} />
                  <Route path="earnings" element={<VetEarnings />} />
                  <Route path="profile" element={<VetProfilePage />} />
                  <Route path="profile-account" element={<VetProfilePage />} />
                  <Route path="access-center" element={<AccessCenter />} />
                  <Route path="notifications" element={<Notifications contextFilter={["vet", "general"]} />} />
                  <Route path="settings" element={<Settings />} />
                </Route>

                {/* ============ MEDIBONDHU (patient books or vet conducts) ============ */}
                <Route
                  path="/medibondhu"
                  element={
                    <ProtectedRoute requireAnyCapability={["can_book_vet", "can_consult_as_vet"]}>
                      <MediBondhuLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Specialities />} />
                  <Route path="vets" element={<VetDirectory />} />
                  <Route path="vet/:id" element={<VetProfile />} />
                  <Route path="book/:vetId" element={<BookConsultation />} />
                  <Route path="waiting/:bookingId" element={<WaitingRoom />} />
                  <Route path="room/:bookingId" element={<ConsultationRoom />} />
                  <Route path="consultations" element={<Consultations />} />
                  <Route path="prescriptions" element={<Prescriptions />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="notifications" element={<Notifications contextFilter={["medibondhu", "general"]} />} />
                  <Route path="access-center" element={<AccessCenter />} />
                  <Route path="settings" element={<Settings />} />
                </Route>

                {/* ============ COMMUNITY (any authenticated user) ============ */}
                <Route path="/community" element={<ProtectedRoute><CommunityLayout /></ProtectedRoute>}>
                  <Route index element={<CommunityFeed />} />
                  <Route path="create" element={<CreatePost />} />
                  <Route path="post/:id" element={<PostDetail />} />
                  <Route path="category/:category" element={<CategoryFeed />} />
                  <Route path="unanswered" element={<UnansweredPosts />} />
                  <Route path="urgent" element={<UrgentPosts />} />
                  <Route path="my-posts" element={<MyPosts />} />
                  <Route path="saved" element={<SavedPosts />} />
                  <Route path="history" element={<CommunityHistory />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="notifications" element={<Notifications contextFilter={["general"]} />} />
                  <Route path="settings" element={<Settings />} />
                </Route>

                {/* ============ ADMIN (requires can_manage_platform) ============ */}
                <Route path="/admin" element={<ProtectedRoute requiredCapability="can_manage_platform"><DashboardLayout /></ProtectedRoute>}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<UserManagement />} />
                  <Route path="approvals" element={<ApprovalQueue />} />
                  <Route path="vet-approvals" element={<VetApprovals />} />
                  <Route path="broadcast" element={<AdminBroadcast />} />
                  <Route path="team" element={<AdminTeam />} />
                  <Route path="farmbondhu-shop" element={<FarmBondhuShop />} />
                  <Route path="marketplace" element={<AdminMarketplace />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="learning" element={<AdminLearning />} />
                  <Route path="medibondhu-overview" element={<AdminMediBondhu />} />
                  <Route path="farms" element={<AdminFarms />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="community" element={<AdminCommunity />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="settings" element={<Settings />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </OrderProvider>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </LanguageProvider>
  </ThemeProvider>
);

export default App;
