// Semantic icon color system for FarmBondhu
// All colors are fixed RGB hex values for consistent professional appearance

export const ICON_COLORS = {
  // Dashboard & Analytics
  dashboard: "#3B82F6",    // Deep Blue
  analytics: "#3B82F6",    // Deep Blue
  trending: "#3B82F6",     // Deep Blue

  // Farm & Agriculture
  farm: "#10B981",         // Emerald Green
  warehouse: "#10B981",
  animals: "#10B981",
  wheat: "#10B981",
  production: "#10B981",

  // Health & Medical
  health: "#F43F5E",       // Rose Red
  mortality: "#F43F5E",
  syringe: "#F43F5E",
  alert: "#F43F5E",
  heartPulse: "#F43F5E",

  // Finance & Money
  finance: "#F59E0B",      // Amber Gold
  wallet: "#F59E0B",
  dollar: "#F59E0B",
  trendingDown: "#F59E0B",

  // Marketplace & Commerce
  marketplace: "#0EA5E9",  // Sky Blue
  cart: "#0EA5E9",
  store: "#0EA5E9",
  package: "#0EA5E9",
  orders: "#0EA5E9",
  shopping: "#0EA5E9",

  // Vet & Medical Services (MediBondhu brand)
  vet: "#12C2D6",          // MediBondhu Cyan
  stethoscope: "#12C2D6",
  calendar: "#12C2D6",
  prescription: "#12C2D6",
  medibondhu: "#12C2D6",   // MediBondhu brand color

  // Admin
  admin: "#6366F1",        // Indigo
  users: "#6366F1",
  shield: "#6366F1",

  // Learning
  learning: "#F97316",     // Orange
  book: "#F97316",

  // Notifications
  bell: "#EC4899",         // Pink

  // Community
  community: "#14B8A6",    // Teal

  // Chatbot
  bot: "#14B8A6",          // Teal
  userChat: "#3B82F6",     // Blue

  // Profile & Active Nav
  profile: "#2563EB",      // Royal Blue
  activeNav: "#2563EB",    // Royal Blue
  farmBrand: "#10B981",    // Emerald Green — Farm Management brand

  // Eggs & Milk (production specifics)
  egg: "#F59E0B",          // Amber
  milk: "#12C2D6",         // Cyan
} as const;

// Helper to create a 10% opacity background from a hex color
export function iconBg(hex: string): string {
  return `${hex}1A`; // 1A = ~10% opacity in hex
}
