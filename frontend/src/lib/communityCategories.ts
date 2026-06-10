import { ICON_COLORS } from "@/lib/iconColors";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";

export type CommunityPostMode = "general" | "question" | "experience" | "knowledge" | "marketplace" | "hiring" | "help_request";
export type CommunityHiringIntent = "job_wanted" | "hiring_someone";
export type CommunityFeedFilter = "all" | "general" | "question" | "experience" | "learning" | "marketplace" | "hiring" | "help_request";

export const COMMUNITY_POST_MODES: Array<{
  value: CommunityPostMode;
  label: string;
  description: string;
  postType: string;
  intent: string;
}> = [
  { value: "general", label: "General Post", description: "Share an update", postType: "discussion", intent: "general" },
  { value: "question", label: "Question", description: "Ask the community", postType: "question", intent: "question" },
  { value: "experience", label: "Experience", description: "Tell a story", postType: "experience", intent: "general" },
  { value: "knowledge", label: "Knowledge / Learning", description: "Teach or request learning", postType: "knowledge_share", intent: "learning" },
  { value: "marketplace", label: "Marketplace", description: "Buying or selling discussion", postType: "discussion", intent: "marketplace" },
  { value: "hiring", label: "Hiring", description: "Find people or work", postType: "hiring", intent: "hiring" },
  { value: "help_request", label: "Help Request", description: "Urgent support", postType: "help_request", intent: "help" },
];

export const COMMUNITY_FEED_FILTERS: Array<{
  value: CommunityFeedFilter;
  label: string;
  tab?: "latest" | "questions" | "urgent" | "unanswered" | "top";
  postType?: string;
  intent?: string;
}> = [
  { value: "all", label: "All", tab: "latest" },
  { value: "general", label: "General Post", tab: "latest", postType: "discussion", intent: "general" },
  { value: "question", label: "Question", tab: "latest", postType: "question" },
  { value: "experience", label: "Experience", tab: "latest", postType: "experience" },
  { value: "learning", label: "Knowledge / Learning", tab: "latest", intent: "learning" },
  { value: "marketplace", label: "Marketplace", tab: "latest", intent: "marketplace" },
  { value: "hiring", label: "Hiring", tab: "latest", intent: "hiring" },
  { value: "help_request", label: "Help Request", tab: "latest", postType: "help_request", intent: "help" },
];

export const AUTO_CATEGORY_BY_MODE: Record<CommunityPostMode, string> = {
  general: "general_discussion",
  question: "general_discussion",
  experience: "general_discussion",
  knowledge: "learning_course",
  marketplace: "marketplace_buying",
  hiring: "job_wanted",
  help_request: "emergency_help",
};

export function autoCategoryForPostMode(
  mode: CommunityPostMode,
  options: { canSell?: boolean; canBuy?: boolean; hiringCategory?: string } = {},
): string {
  if (mode === "marketplace") {
    return options.canSell && !options.canBuy ? "marketplace_selling" : "marketplace_buying";
  }
  if (mode === "hiring") {
    return options.hiringCategory || AUTO_CATEGORY_BY_MODE.hiring;
  }
  return AUTO_CATEGORY_BY_MODE[mode] || "general_discussion";
}

export const CATEGORY_LABELS: Record<string, string> = {
  animal_health: "Animal Health",
  feed_nutrition: "Feed & Nutrition",
  medicine_vaccination: "Medicine & Vaccination",
  farm_management: "Farm Management",
  marketplace_buying: "Marketplace Buying",
  marketplace_selling: "Marketplace Selling",
  product_question: "Product Question",
  delivery_order_help: "Delivery / Order Help",
  shop_promotion: "Shop Promotion",
  human_health: "Human Health",
  medibondhu_patient_help: "MediBondhu Patient Help",
  medibondhu_doctor_advice: "MediBondhu Doctor Advice",
  medibondhu_prescription: "Prescription Help",
  appointment_help: "Appointment Help",
  learning_course: "Course Discussion",
  tutorial_request: "Tutorial Request",
  study_note: "Study Note",
  training_help: "Training Help",
  community_hiring: "Community Hiring",
  job_wanted: "Job Wanted",
  farm_worker: "Farm Worker",
  shop_staff: "Seller / Shop Staff",
  veterinary_assistant: "Veterinary Assistant",
  clinic_staff: "Doctor / Clinic Staff",
  delivery_logistics: "Delivery / Logistics",
  breeding_growth: "Breeding & Growth",
  egg_production: "Egg Production",
  milk_production: "Milk Production",
  meat_production: "Meat Production",
  equipment_setup: "Equipment & Setup",
  vet_advice: "Vet Advice",
  disease_symptoms: "Disease & Symptoms",
  emergency_help: "Emergency Help",
  business_profit: "Business & Profit",
  general_discussion: "General Discussion",
  announcement: "Announcement",
};

export const ANIMAL_LABELS: Record<string, string> = {
  chicken: "Chicken",
  duck: "Duck",
  goat: "Goat",
  cow: "Cow",
  sheep: "Sheep",
  pigeon: "Pigeon",
  mixed: "Mixed",
  other: "Other",
};

export const CATEGORY_COLORS: Record<string, string> = {
  animal_health: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  feed_nutrition: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  disease_symptoms: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  emergency_help: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  vet_advice: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  breeding_growth: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  farm_management: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  marketplace_buying: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  marketplace_selling: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  product_question: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  delivery_order_help: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  shop_promotion: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  human_health: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  medibondhu_patient_help: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  medibondhu_doctor_advice: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  medibondhu_prescription: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  appointment_help: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  learning_course: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  tutorial_request: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  study_note: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  training_help: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  community_hiring: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  job_wanted: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  farm_worker: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  shop_staff: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  veterinary_assistant: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  clinic_staff: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  delivery_logistics: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

export const CATEGORY_CONTEXTS: Record<string, string[]> = {
  animal_health: ["farm", "vetbondhu"],
  feed_nutrition: ["farm", "vetbondhu"],
  medicine_vaccination: ["vetbondhu", "farm"],
  farm_management: ["farm"],
  marketplace_buying: ["marketplace_buyer"],
  marketplace_selling: ["marketplace_seller", "marketplace_buyer"],
  product_question: ["marketplace_buyer"],
  delivery_order_help: ["marketplace_buyer", "marketplace_seller"],
  shop_promotion: ["marketplace_seller"],
  human_health: ["medibondhu"],
  medibondhu_patient_help: ["medibondhu"],
  medibondhu_doctor_advice: ["medibondhu"],
  medibondhu_prescription: ["medibondhu"],
  appointment_help: ["medibondhu"],
  learning_course: ["learning"],
  tutorial_request: ["learning"],
  study_note: ["learning"],
  training_help: ["learning"],
  community_hiring: ["community_hiring"],
  job_wanted: ["community_hiring"],
  farm_worker: ["community_hiring", "farm"],
  shop_staff: ["community_hiring", "marketplace_seller"],
  veterinary_assistant: ["community_hiring", "vetbondhu"],
  clinic_staff: ["community_hiring", "medibondhu"],
  delivery_logistics: ["community_hiring", "marketplace_buyer", "marketplace_seller"],
  breeding_growth: ["farm", "vetbondhu"],
  egg_production: ["farm"],
  milk_production: ["farm"],
  meat_production: ["farm", "marketplace_seller"],
  equipment_setup: ["farm", "marketplace_seller"],
  vet_advice: ["vetbondhu"],
  disease_symptoms: ["vetbondhu"],
  emergency_help: ["vetbondhu"],
  business_profit: ["farm", "marketplace_seller"],
  general_discussion: ["general"],
  announcement: ["general"],
};

export const MODE_CATEGORY_SUGGESTIONS: Record<CommunityPostMode, string[]> = {
  general: ["general_discussion", "announcement", "farm_management", "marketplace_buying"],
  question: ["animal_health", "feed_nutrition", "human_health", "product_question", "learning_course"],
  experience: ["general_discussion", "farm_management", "marketplace_selling", "vet_advice"],
  knowledge: ["learning_course", "tutorial_request", "study_note", "training_help"],
  marketplace: ["marketplace_buying", "marketplace_selling", "product_question", "delivery_order_help", "shop_promotion"],
  hiring: ["community_hiring", "job_wanted", "farm_worker", "shop_staff", "veterinary_assistant", "clinic_staff", "delivery_logistics"],
  help_request: ["emergency_help", "disease_symptoms", "medibondhu_patient_help", "delivery_order_help", "training_help"],
};

export const HIRING_INTENTS: Array<{
  value: CommunityHiringIntent;
  label: string;
  description: string;
  defaultCategory: string;
}> = [
  {
    value: "job_wanted",
    label: "Looking for work",
    description: "Post your skills, availability, and preferred work.",
    defaultCategory: "job_wanted",
  },
  {
    value: "hiring_someone",
    label: "Hiring someone",
    description: "Post a job and collect interested applicants.",
    defaultCategory: "farm_worker",
  },
];

export const HIRING_CATEGORY_GROUPS: Record<CommunityHiringIntent, Array<{ label: string; categories: string[] }>> = {
  job_wanted: [
    { label: "Looking for work", categories: ["job_wanted"] },
  ],
  hiring_someone: [
    { label: "Hiring workers", categories: ["farm_worker", "shop_staff", "delivery_logistics"] },
    { label: "Hiring assistants", categories: ["veterinary_assistant", "clinic_staff"] },
    { label: "General", categories: ["community_hiring"] },
  ],
};

export const HIRING_TEMPLATE_COPY: Record<
  CommunityHiringIntent,
  {
    titlePlaceholder: string;
    bodyPlaceholder: string;
    titleLabel: string;
    locationPlaceholder: string;
    payPlaceholder: string;
    skillsPlaceholder: string;
    contactPlaceholder: string;
    datePlaceholder: string;
    detailsTitle: string;
  }
> = {
  job_wanted: {
    titlePlaceholder: "Desired role, e.g. Farm worker looking for work",
    bodyPlaceholder: "Tell employers about your skills, experience, availability, and what kind of work you want...",
    titleLabel: "Desired role",
    locationPlaceholder: "Preferred work location",
    payPlaceholder: "Expected pay (optional)",
    skillsPlaceholder: "Your skills / experience",
    contactPlaceholder: "Best contact method",
    datePlaceholder: "Available from",
    detailsTitle: "Work preference details",
  },
  hiring_someone: {
    titlePlaceholder: "Position title, e.g. Farm assistant needed",
    bodyPlaceholder: "Describe the job, schedule, requirements, and who should apply...",
    titleLabel: "Position title",
    locationPlaceholder: "Workplace / location",
    payPlaceholder: "Pay range (optional)",
    skillsPlaceholder: "Skills needed",
    contactPlaceholder: "Contact method",
    datePlaceholder: "Deadline",
    detailsTitle: "Hiring details",
  },
};

const ANIMAL_CONTEXTS = new Set(["farm", "vetbondhu"]);

export function categoryNeedsAnimal(category: string): boolean {
  return (CATEGORY_CONTEXTS[category] || []).some((context) => ANIMAL_CONTEXTS.has(context));
}

export function resolveCategoryContexts(category: string, userContexts: string[] = []): string[] {
  const contexts = new Set(CATEGORY_CONTEXTS[category] || ["general"]);
  for (const context of userContexts) contexts.add(context);
  return [...contexts];
}

export function workspaceChipColor(context: string): string {
  if (context === "medibondhu") return ICON_COLORS.medibondhu;
  if (context === "vetbondhu") return ICON_COLORS.vetbondhu;
  if (context === "marketplace_buyer") return MARKETPLACE_THEME.primary;
  if (context === "marketplace_seller") return ICON_COLORS.marketplace;
  if (context === "learning") return ICON_COLORS.learning;
  return ICON_COLORS.community;
}
