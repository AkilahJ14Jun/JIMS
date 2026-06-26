// ─── Materials ───────────────────────────────────────────
export type Material = 'Gold' | 'Silver' | 'Diamond';

// ─── Item Types ──────────────────────────────────────────
export type ItemType = 'Chain' | 'Bangle' | 'Ring' | 'Pendant' | 'Bracelet' | 'Necklace' | 'Earring' | 'Anklet' | 'Nose Pin';

// ─── Chain Varieties ─────────────────────────────────────
export type ChainVariety = 'Machine Cut' | 'Bombay' | 'Twin String' | 'Singapore' | 'Figaro' | 'Rope' | 'Curb' | 'Box';
// ─── Bangle Varieties ────────────────────────────────────
export type BangleVariety = 'Plain' | 'Kundan' | 'Polki' | 'Temple' | 'Bridal' | 'American Diamond' | 'Filigree' | 'Enamelled';
// ─── Ring Varieties ──────────────────────────────────────
export type RingVariety = 'Solitaire' | 'Band' | 'Signet' | 'Cocktail' | 'Eternity' | 'Stackable' | 'Beaded' | 'Engraved';
// ─── Pendant Varieties ───────────────────────────────────
export type PendantVariety = 'Locket' | 'Charm' | 'Drop' | 'Statement' | 'Cross' | 'Initial' | 'Gemstone' | 'Religious';
// ─── Bracelet Varieties ──────────────────────────────────
export type BraceletVariety = 'Bangle Style' | 'Chain Link' | 'Charm' | 'Cuff' | 'Tennis' | 'Wrap' | 'Beaded' | 'Slap';

export type ItemVariety = ChainVariety | BangleVariety | RingVariety | PendantVariety | BraceletVariety;

// ─── Demographics ────────────────────────────────────────
export type Gender = 'Male' | 'Female' | 'Unisex';
export type CustomerBackground = 'Urban' | 'Semi-Urban' | 'Rural';
export type Occupation = 'Business' | 'Professional' | 'Agriculture' | 'Government' | 'Homemaker' | 'Student' | 'Retired' | 'Other';
export type AgeGroup = '18-25' | '26-35' | '36-45' | '46-55' | '55+';

// ─── Supplier ────────────────────────────────────────────
export interface Supplier {
  id: string;
  name: string;
  location: string;
  state: string;
  contactPerson: string;
  phone: string;
  email: string;
  gstNumber: string;
  materials: Material[];
  itemTypes: ItemType[];
  avgDeliveryDays: number;
  reliabilityScore: number; // 1-10
  isActive: boolean;
}

// ─── Branch ──────────────────────────────────────────────
export interface Branch {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  manager: string;
  monthlyTarget: number;
}

// ─── Inventory Item ──────────────────────────────────────
export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  material: Material;
  itemType: ItemType;
  variety: ItemVariety;
  design: string;
  weightGrams: number;
  purity: string; // e.g., 22K, 18K, 925
  supplierId: string;
  branchId: string;
  costPrice: number;
  sellingPrice: number;
  imageUrl: string;
  receivedDate: string; // ISO date string
  soldDate: string | null; // null if still in stock
  status: 'In Stock' | 'Sold' | 'Reserved' | 'Returned';
  quantity: number;
  minStockLevel: number;
  reorderLeadDays: number;
  avgMonthlySales: number;
  notes: string;
}

// ─── Customer ────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  age: number;
  ageGroup: AgeGroup;
  gender: Gender;
  occupation: Occupation;
  background: CustomerBackground;
  phone: string;
  city: string;
  totalPurchases: number;
  totalSpent: number;
}

// ─── Sale ────────────────────────────────────────────────
export interface Sale {
  id: string;
  itemId: string;
  customerId: string;
  branchId: string;
  saleDate: string;
  quantity: number;
  salePrice: number;
  costPrice: number;
  discount: number;
  paymentMethod: 'Cash' | 'Card' | 'UPI' | 'Bank Transfer';
}

// ─── Shelf Life ──────────────────────────────────────────
export interface ShelfLife {
  itemId: string;
  itemName: string;
  itemType: ItemType;
  variety: ItemVariety;
  weightGrams: number;
  branchId: string;
  supplierId: string;
  receivedDate: string;
  soldDate: string | null;
  daysInStock: number;
  status: 'In Stock' | 'Sold';
  material: Material;
}

// ─── Reorder Alert ───────────────────────────────────────
export interface ReorderAlert {
  id: string;
  itemId: string;
  itemName: string;
  itemType: ItemType;
  variety: ItemVariety;
  weightGrams: number;
  branchId: string;
  supplierId: string;
  currentStock: number;
  minStockLevel: number;
  avgMonthlySales: number;
  reorderLeadDays: number;
  estimatedDaysToStockout: number;
  recommendedQty: number;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  blocked: boolean;
  blockReason?: string;
  supplierAvgDeliveryDays: number;
  estimatedCost: number;
}

// ─── Demand Analytics ────────────────────────────────────
export interface DemandByBranch {
  branchId: string;
  branchName: string;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  topItemTypes: { itemType: ItemType; count: number }[];
}

export interface DemandByDemographics {
  ageGroup: AgeGroup | 'All';
  gender: Gender | 'All';
  occupation: Occupation | 'All';
  background: CustomerBackground | 'All';
  totalSales: number;
  totalRevenue: number;
  topItems: string[];
}

export interface DemandByItemType {
  itemType: ItemType;
  variety: string;
  totalSales: number;
  totalRevenue: number;
  avgShelfLife: number;
  avgWeight: number;
}

export interface FastMoverItem {
  itemId: string;
  itemName: string;
  itemType: ItemType;
  variety: ItemVariety;
  weightGrams: number;
  material: Material;
  branchName: string;
  avgShelfLife: number;
  monthlySales: number;
  revenue: number;
}

export interface SlowMoverItem {
  itemId: string;
  itemName: string;
  itemType: ItemType;
  variety: ItemVariety;
  weightGrams: number;
  material: Material;
  branchName: string;
  daysInStock: number;
  quantity: number;
  costValue: number;
}

// ─── Profitability ───────────────────────────────────────
export interface ProfitabilitySummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  totalItems: number;
  totalSold: number;
  totalInStock: number;
  avgShelfLife: number;
  branchProfitability: {
    branchId: string;
    branchName: string;
    revenue: number;
    profit: number;
    margin: number;
  }[];
  supplierProfitability: {
    supplierId: string;
    supplierName: string;
    revenue: number;
    profit: number;
    margin: number;
  }[];
  materialProfitability: {
    material: Material;
    revenue: number;
    profit: number;
    margin: number;
  }[];
  itemTypeProfitability: {
    itemType: ItemType;
    revenue: number;
    profit: number;
    margin: number;
  }[];
}

// ─── Navigation ──────────────────────────────────────────
export type Page = 'dashboard' | 'inventory' | 'suppliers' | 'branches' | 'analytics' | 'reorder' | 'shelflife' | 'optimizer' | 'stockrec';

// ─── Optimizer Types ──────────────────────────────────────
export interface OptimizerParams {
  // Global sliders
  targetShelfLife: number;       // days - target max shelf life
  reorderTimeline: number;       // days before stockout to reorder
  reorderLimitPercent: number;   // % of avg monthly sales to cap reorder
  holdingCostPerDay: number;     // % of item cost per day holding cost
  discountAfterDays: number;     // days after which to apply discount
  discountPercent: number;       // % discount to apply on slow items
  safetyStockDays: number;       // extra days of stock to maintain
  targetProfitMargin: number;    // desired profit margin %

  // Per-branch overrides
  branchMultipliers: Record<string, number>; // branchId -> sales multiplier
}

export interface OptimizerResult {
  currentProfit: number;
  projectedProfit: number;
  profitChange: number;
  profitChangePercent: number;
  currentProfitMargin: number;
  projectedProfitMargin: number;
  targetProfitMargin: number;
  meetsTarget: boolean;
  currentRevenue: number;
  projectedRevenue: number;
  currentCost: number;
  projectedCost: number;
  currentHoldingCost: number;
  projectedHoldingCost: number;
  currentDiscountLoss: number;
  projectedDiscountLoss: number;
  currentStockoutLoss: number;
  projectedStockoutLoss: number;
  itemsAffected: number;
  itemsImproved: number;
  itemsWorsened: number;
  optimalShelfLifeByBranch: { branchId: string; branchName: string; optimal: number; current: number }[];
  optimalShelfLifeBySupplier: { supplierId: string; supplierName: string; optimal: number; current: number }[];
  optimalShelfLifeByDemographic: { demographic: string; optimal: number; current: number }[];
  reorderTimelineByBranch: { branchId: string; branchName: string; timeline: number }[];
  reorderLimitBySupplier: { supplierId: string; supplierName: string; limit: number }[];
  recommendations: string[];
}

export interface BranchOptimizerConfig {
  branchId: string;
  branchName: string;
  targetShelfLife: number;
  reorderTimeline: number;
  reorderLimit: number;
  safetyStockDays: number;
  holdingCostPercent: number;
  discountAfterDays: number;
  discountPercent: number;
}

export interface SupplierOptimizerConfig {
  supplierId: string;
  supplierName: string;
  targetShelfLife: number;
  reorderTimeline: number;
  reorderLimit: number;
  leadTimeDays: number;
  reliabilityAdjustment: number;
}

export interface DemographicOptimizerConfig {
  demographic: string;
  type: 'ageGroup' | 'gender' | 'occupation' | 'background';
  targetShelfLife: number;
  reorderPriority: number;
  stockLevelMultiplier: number;
}
