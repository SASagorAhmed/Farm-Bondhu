// ====== TYPE INTERFACES ONLY — No mock data ======

// ====== FARM & ANIMALS ======
export interface Farm {
  id: string;
  name: string;
  location: string;
  type: "poultry" | "dairy" | "mixed";
  totalAnimals: number;
  sheds: number;
}

export interface Shed {
  id: string;
  farmId: string;
  name: string;
  capacity: number;
  animalType: string;
  currentCount: number;
  status: "active" | "maintenance" | "empty";
}

export interface Animal {
  id: string;
  farmId: string;
  type: "chicken" | "duck" | "turkey" | "pigeon" | "cow" | "goat" | "sheep";
  trackingMode: "batch" | "individual";
  name?: string;
  batchId?: string;
  batchSize?: number;
  breed: string;
  age: string;
  healthStatus: "healthy" | "sick" | "treatment";
  lastVaccination?: string;
}

export interface HealthRecord {
  id: string;
  animalId: string;
  animalLabel?: string;
  date: string;
  type: "vaccination" | "treatment" | "checkup";
  description: string;
  vetName?: string;
  cost: number;
}

export interface FeedRecord {
  id: string;
  farmId: string;
  animalId: string;
  animalLabel?: string;
  date: string;
  feedType: string;
  quantity: number;
  unit: string;
  cost: number;
}

export interface MortalityRecord {
  id: string;
  farmId: string;
  animalId: string;
  date: string;
  cause: string;
  animalType?: string;
  batchId?: string;
  count: number;
}

export interface SaleRecord {
  id: string;
  date: string;
  product: string;
  category: "eggs" | "milk" | "meat" | "live_animals";
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  buyer: string;
}

export interface FinancialRecord {
  id: string;
  farmId: string;
  date: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  description: string;
}

export interface ProductionRecord {
  id: string;
  farmId: string;
  date: string;
  eggs: number;
  milk: number;
}

export interface WeightRecord {
  id: string;
  animalId: string;
  date: string;
  weight: number;
  unit: string;
}

export interface Notification {
  id: string;
  type: "vaccine" | "feed" | "medicine" | "order" | "vet" | "mortality" | "general";
  title: string;
  message: string;
  date: string;
  read: boolean;
  priority: "high" | "medium" | "low";
}

export interface FeedInventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  reorderLevel: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "farmer" | "buyer" | "vendor" | "vet" | "admin";
  location: string;
  joinDate: string;
  status: "active" | "inactive" | "suspended";
}

// ====== SHOP SYSTEM ======
export interface ShopRequest {
  id: string;
  userId: string;
  userName: string;
  shopName: string;
  description: string;
  nidCardUrl: string;
  phone: string;
  location: string;
  status: "pending" | "approved" | "rejected";
  requestDate: string;
  reviewDate?: string;
  reviewNote?: string;
}

export interface Shop {
  id: string;
  userId: string;
  userName: string;
  shopName: string;
  description: string;
  location: string;
  status: "active" | "suspended";
  createdDate: string;
  totalProducts: number;
  totalSales: number;
}

export interface Product {
  id: string;
  name: string;
  category: "feed" | "medicine" | "equipment" | "livestock" | "produce" | "vaccines" | "eggs" | "meat" | "milk";
  price: number;
  originalPrice?: number;
  unit: string;
  image: string;
  seller: string;
  sellerId: string;
  rating: number;
  reviewCount?: number;
  stock: number;
  description: string;
  location: string;
  freeDelivery?: boolean;
}

export interface Order {
  id: string;
  date: string;
  items: { productId: string; name: string; qty: number; price: number }[];
  total: number;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  buyerId: string;
  sellerId: string;
}

// ====== MEDIBONDHU ======
export interface Vet {
  id: string;
  name: string;
  specialization: string;
  animalTypes: string[];
  rating: number;
  experience: number;
  fee: number;
  location: string;
  available: boolean;
  avatar: string;
  degree: string;
}

export interface Consultation {
  id: string;
  vetId: string;
  vetName: string;
  userId: string;
  date: string;
  time: string;
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
  animalType: string;
  symptoms: string;
  prescription?: string;
}

export interface VetApplication {
  id: string;
  name: string;
  email: string;
  degree: string;
  specialization: string;
  experience: number;
  documents: string[];
  status: "pending" | "approved" | "rejected";
  appliedDate: string;
}
