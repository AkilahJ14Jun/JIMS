// ─── Stock Recommendation Types ───────────────────────────

export interface StockRecommendation {
  id: string;
  itemType: string;
  variety: string;
  material: string;
  weightGrams: number;
  purity: string;
  design: string;
  // Sales metrics
  totalSold: number;
  avgMonthlySales: number;
  salesVelocity: 'Very Fast' | 'Fast' | 'Moderate' | 'Slow' | 'Very Slow';
  demandTrend: 'Increasing' | 'Stable' | 'Decreasing';
  // Stock recommendations
  recommendedStock: number;
  currentStock: number;
  safetyStock: number;
  reorderPoint: number;
  maxStock: number;
  // Financial
  avgUnitCost: number;
  avgUnitPrice: number;
  totalInvestment: number;
  projectedMonthlyRevenue: number;
  // Branch specific
  branchId: string;
  branchName: string;
  // Timing
  turnoverRatio: number;       // times per month
  daysOfStockRecommended: number;
  // Confidence
  confidenceScore: number;     // 0-100 based on data volume
}

export interface CategorySummary {
  itemType: string;
  totalVarieties: number;
  totalRecommendedItems: number;
  totalInvestment: number;
  projectedMonthlyRevenue: number;
  topVarieties: { variety: string; recommendedQty: number; velocity: string }[];
  weightDistribution: { weight: number; count: number; pct: number }[];
}

export interface BranchStockSummary {
  branchId: string;
  branchName: string;
  totalRecommendedItems: number;
  totalInvestment: number;
  projectedMonthlyRevenue: number;
  categoryBreakdown: { itemType: string; count: number; investment: number }[];
}

export interface CSVSaleRecord {
  date: string;
  itemType: string;
  variety: string;
  material: string;
  weightGrams: number;
  quantity: number;
  unitPrice: number;
  branch: string;
  customerAgeGroup?: string;
  customerGender?: string;
}

export interface StockViewMode {
  mode: 'summary' | 'category' | 'branch' | 'detail';
  category?: string;
  branchId?: string;
  material?: string;
  weightFilter?: 'All' | number;
}
