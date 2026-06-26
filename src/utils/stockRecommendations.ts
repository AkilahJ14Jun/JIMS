import type {
  InventoryItem,
  Sale,
  Branch,
  Supplier,
  Material,
  ItemType,
} from '../types';
import type {
  StockRecommendation,
  CategorySummary,
  BranchStockSummary,
  CSVSaleRecord,
} from '../types/stockRecommendations';
import { differenceInDays, parseISO } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────
const MATERIAL_LABELS: Record<string, Material> = {
  Gold: 'Gold',
  gold: 'Gold',
  SILVER: 'Silver',
  Silver: 'Silver',
  silver: 'Silver',
  Diamond: 'Diamond',
  diamond: 'Diamond',
};

const ITEM_TYPE_MAP: Record<string, ItemType> = {
  Chain: 'Chain', chain: 'Chain',
  Bangle: 'Bangle', bangle: 'Bangle', bangles: 'Bangle',
  Ring: 'Ring', ring: 'Ring', rings: 'Ring',
  Pendant: 'Pendant', pendant: 'Pendant', pendants: 'Pendant',
  Bracelet: 'Bracelet', bracelet: 'Bracelet', bracelets: 'Bracelet',
  Necklace: 'Necklace', necklace: 'Necklace',
  Earring: 'Earring', earring: 'Earring', earrings: 'Earring',
  Anklet: 'Anklet', anklet: 'Anklet',
  'Nose Pin': 'Nose Pin', nosepin: 'Nose Pin', 'NosePin': 'Nose Pin',
};

function normalizeMaterial(raw: string): Material | null {
  return MATERIAL_LABELS[raw] || null;
}

function normalizeItemType(raw: string): ItemType | null {
  return ITEM_TYPE_MAP[raw] || null;
}

function getSalesVelocity(avgMonthly: number): StockRecommendation['salesVelocity'] {
  if (avgMonthly >= 8) return 'Very Fast';
  if (avgMonthly >= 4) return 'Fast';
  if (avgMonthly >= 2) return 'Moderate';
  if (avgMonthly >= 0.5) return 'Slow';
  return 'Very Slow';
}

function getConfidence(salesCount: number, totalSales: number): number {
  // More sales = higher confidence
  const salesFactor = Math.min(1, totalSales / 20) * 50; // up to 50 points
  const countFactor = Math.min(1, salesCount / 10) * 30; // up to 30 points
  const monthsCovered = Math.min(1, salesCount / 3) * 20; // up to 20 points
  return Math.min(100, Math.round(salesFactor + countFactor + monthsCovered));
}

// ─── Generate Recommendations from Mock/CSV Data ──────────
export function generateStockRecommendations(
  items: InventoryItem[],
  sales: Sale[],
  branches: Branch[],
  _suppliers: Supplier[],
  csvRecords?: CSVSaleRecord[]
): {
  recommendations: StockRecommendation[];
  categorySummaries: CategorySummary[];
  branchSummaries: BranchStockSummary[];
  csvSalesCount: number;
  totalUniqueSKUs: number;
  totalProjectedInvestment: number;
  totalProjectedRevenue: number;
} {
  // Merge sales data: mock sales + CSV records
  const allSalesData: {
    itemType: string;
    variety: string;
    material: string;
    weightGrams: number;
    branch: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
    date: string;
    purity: string;
    design: string;
    supplierId?: string;
  }[] = [];

  // From mock sales
  for (const sale of sales) {
    const item = items.find((i) => i.id === sale.itemId);
    if (!item) continue;
    allSalesData.push({
      itemType: item.itemType,
      variety: item.variety,
      material: item.material,
      weightGrams: item.weightGrams,
      branch: sale.branchId,
      quantity: sale.quantity,
      unitPrice: sale.salePrice,
      unitCost: sale.costPrice,
      date: sale.saleDate,
      purity: item.purity,
      design: item.design,
      supplierId: item.supplierId,
    });
  }

  // From CSV records
  const csvSalesCount = csvRecords?.length || 0;
  if (csvRecords) {
    for (const rec of csvRecords) {
      const material = normalizeMaterial(rec.material) || 'Gold';
      const itemType = normalizeItemType(rec.itemType) || 'Chain';
      const branch = branches.find(
        (b) => b.name.toLowerCase().includes(rec.branch.toLowerCase())
      )?.id || branches[0]?.id || '';

      allSalesData.push({
        itemType,
        variety: rec.variety,
        material,
        weightGrams: rec.weightGrams,
        branch,
        quantity: rec.quantity,
        unitPrice: rec.unitPrice,
        unitCost: Math.round(rec.unitPrice * 0.85),
        date: rec.date,
        purity: material === 'Gold' ? '22K' : material === 'Silver' ? '925' : 'VS1',
        design: `${rec.variety} Design`,
      });
    }
  }

  // Group by itemType + variety + weight + branch
  const grouped = new Map<string, typeof allSalesData>();
  for (const sale of allSalesData) {
    const key = `${sale.itemType}|${sale.variety}|${sale.weightGrams}|${sale.branch}`;
    const existing = grouped.get(key) || [];
    existing.push(sale);
    grouped.set(key, existing);
  }

  // Build recommendations
  const recommendations: StockRecommendation[] = [];

  for (const [key, salesList] of grouped) {
    const first = salesList[0];
    const totalSold = salesList.reduce((sum, s) => sum + s.quantity, 0);
    const avgUnitPrice = salesList.reduce((sum, s) => sum + s.unitPrice, 0) / salesList.length;
    const avgUnitCost = salesList.reduce((sum, s) => sum + s.unitCost, 0) / salesList.length;

    // Calculate sales timeline
    const dates = salesList.map((s) => parseISO(s.date));
    const earliestDate = dates.reduce((a, b) => (a < b ? a : b));
    const latestDate = dates.reduce((a, b) => (a > b ? a : b));
    const totalDays = Math.max(1, differenceInDays(latestDate, earliestDate) + 1);
    const totalMonths = Math.max(1, totalDays / 30);

    const avgMonthlySales = totalSold / totalMonths;
    const velocity = getSalesVelocity(avgMonthlySales);

    // Demand trend: compare first half vs second half
    const midDate = new Date(earliestDate.getTime() + (latestDate.getTime() - earliestDate.getTime()) / 2);
    const firstHalfSales = salesList.filter((s) => parseISO(s.date) <= midDate).reduce((sum, s) => sum + s.quantity, 0);
    const secondHalfSales = salesList.filter((s) => parseISO(s.date) > midDate).reduce((sum, s) => sum + s.quantity, 0);
    const demandTrend: StockRecommendation['demandTrend'] =
      secondHalfSales > firstHalfSales * 1.2 ? 'Increasing' :
      firstHalfSales > secondHalfSales * 1.2 ? 'Decreasing' : 'Stable';

    // Optimal stock calculation
    const baseStock = Math.ceil(avgMonthlySales * 2); // 2 months of stock
    const trendMultiplier = demandTrend === 'Increasing' ? 1.3 : demandTrend === 'Decreasing' ? 0.7 : 1.0;
    const velocityMultiplier =
      velocity === 'Very Fast' ? 1.4 :
      velocity === 'Fast' ? 1.2 :
      velocity === 'Moderate' ? 1.0 :
      velocity === 'Slow' ? 0.7 : 0.4;
    const recommendedStock = Math.max(1, Math.ceil(baseStock * trendMultiplier * velocityMultiplier));

    const safetyStock = Math.ceil(avgMonthlySales * 0.5); // 2 weeks safety
    const reorderPoint = safetyStock + Math.ceil(avgMonthlySales * 0.25); // 1 week lead
    const maxStock = Math.ceil(recommendedStock * 1.5);

    // Current stock
    const currentItems = items.filter(
      (i) =>
        i.itemType === first.itemType &&
        i.variety === first.variety &&
        i.weightGrams === first.weightGrams &&
        i.material === first.material &&
        i.branchId === first.branch &&
        i.status === 'In Stock'
    );
    const currentStock = currentItems.reduce((sum, i) => sum + i.quantity, 0);

    const branch = branches.find((b) => b.id === first.branch);
    const turnoverRatio = currentStock > 0 ? avgMonthlySales / currentStock : avgMonthlySales;

    const confidence = getConfidence(salesList.length, totalSold);

    recommendations.push({
      id: `REC-${key.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)}-${Date.now()}`,
      itemType: first.itemType,
      variety: first.variety,
      material: first.material,
      weightGrams: first.weightGrams,
      purity: first.purity,
      design: first.design,
      totalSold,
      avgMonthlySales: Math.round(avgMonthlySales * 100) / 100,
      salesVelocity: velocity,
      demandTrend,
      recommendedStock,
      currentStock,
      safetyStock,
      reorderPoint,
      maxStock,
      avgUnitCost: Math.round(avgUnitCost),
      avgUnitPrice: Math.round(avgUnitPrice),
      totalInvestment: Math.round(recommendedStock * avgUnitCost),
      projectedMonthlyRevenue: Math.round(avgMonthlySales * avgUnitPrice * 100) / 100,
      branchId: first.branch,
      branchName: branch?.name || 'Unknown',
      turnoverRatio: Math.round(turnoverRatio * 100) / 100,
      daysOfStockRecommended: avgMonthlySales > 0 ? Math.round((recommendedStock / avgMonthlySales) * 30) : 60,
      confidenceScore: confidence,
    });
  }

  // Sort by recommended stock descending (most important first)
  recommendations.sort((a, b) => b.recommendedStock - a.recommendedStock);

  // Category summaries
  const categoryMap = new Map<string, StockRecommendation[]>();
  for (const rec of recommendations) {
    const existing = categoryMap.get(rec.itemType) || [];
    existing.push(rec);
    categoryMap.set(rec.itemType, existing);
  }

  const categorySummaries: CategorySummary[] = Array.from(categoryMap.entries()).map(
    ([itemType, recs]) => {
      const totalInvestment = recs.reduce((sum, r) => sum + r.totalInvestment, 0);
      const projectedMonthlyRevenue = recs.reduce((sum, r) => sum + r.projectedMonthlyRevenue, 0);
      const topVarieties = recs
        .sort((a, b) => b.recommendedStock - a.recommendedStock)
        .slice(0, 5)
        .map((r) => ({
          variety: r.variety,
          recommendedQty: r.recommendedStock,
          velocity: r.salesVelocity,
        }));

      // Weight distribution
      const weightMap = new Map<number, number>();
      for (const r of recs) {
        weightMap.set(r.weightGrams, (weightMap.get(r.weightGrams) || 0) + 1);
      }
      const totalRecs = recs.length;
      const weightDistribution = Array.from(weightMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([weight, count]) => ({
          weight,
          count,
          pct: Math.round((count / totalRecs) * 100),
        }));

      return {
        itemType,
        totalVarieties: recs.length,
        totalRecommendedItems: recs.reduce((sum, r) => sum + r.recommendedStock, 0),
        totalInvestment,
        projectedMonthlyRevenue,
        topVarieties,
        weightDistribution,
      };
    }
  );

  categorySummaries.sort((a, b) => b.totalInvestment - a.totalInvestment);

  // Branch summaries
  const branchMap = new Map<string, StockRecommendation[]>();
  for (const rec of recommendations) {
    const existing = branchMap.get(rec.branchId) || [];
    existing.push(rec);
    branchMap.set(rec.branchId, existing);
  }

  const branchSummaries: BranchStockSummary[] = Array.from(branchMap.entries()).map(
    ([branchId, recs]) => {
      const branch = branches.find((b) => b.id === branchId);
      const categoryBreakdownMap = new Map<string, { count: number; investment: number }>();
      for (const r of recs) {
        const existing = categoryBreakdownMap.get(r.itemType) || { count: 0, investment: 0 };
        existing.count += r.recommendedStock;
        existing.investment += r.totalInvestment;
        categoryBreakdownMap.set(r.itemType, existing);
      }
      const categoryBreakdown = Array.from(categoryBreakdownMap.entries())
        .map(([itemType, data]) => ({ itemType, count: data.count, investment: data.investment }))
        .sort((a, b) => b.investment - a.investment);

      return {
        branchId,
        branchName: branch?.name || 'Unknown',
        totalRecommendedItems: recs.reduce((sum, r) => sum + r.recommendedStock, 0),
        totalInvestment: recs.reduce((sum, r) => sum + r.totalInvestment, 0),
        projectedMonthlyRevenue: recs.reduce((sum, r) => sum + r.projectedMonthlyRevenue, 0),
        categoryBreakdown,
      };
    }
  );

  branchSummaries.sort((a, b) => b.totalInvestment - a.totalInvestment);

  const totalUniqueSKUs = recommendations.length;
  const totalProjectedInvestment = recommendations.reduce((sum, r) => sum + r.totalInvestment, 0);
  const totalProjectedRevenue = recommendations.reduce((sum, r) => sum + r.projectedMonthlyRevenue, 0);

  return {
    recommendations,
    categorySummaries,
    branchSummaries,
    csvSalesCount,
    totalUniqueSKUs,
    totalProjectedInvestment,
    totalProjectedRevenue,
  };
}

// ─── CSV Parser ───────────────────────────────────────────
export function parseCSV(text: string): { records: CSVSaleRecord[]; errors: string[] } {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { records: [], errors: ['CSV must have a header row and at least one data row'] };

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const records: CSVSaleRecord[] = [];
  const errors: string[] = [];

  // Find column indices
  const findCol = (names: string[]) => {
    for (const name of names) {
      const idx = header.findIndex((h) => h.includes(name.toLowerCase()));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateIdx = findCol(['date', 'sale_date', 'saledate']);
  const typeIdx = findCol(['type', 'item_type', 'itemtype', 'category']);
  const varietyIdx = findCol(['variety', 'design', 'style', 'pattern']);
  const materialIdx = findCol(['material', 'metal', 'type_metal']);
  const weightIdx = findCol(['weight', 'weight_grams', 'grams', 'wt']);
  const qtyIdx = findCol(['quantity', 'qty', 'count', 'units']);
  const priceIdx = findCol(['price', 'unit_price', 'sale_price', 'amount']);
  const branchIdx = findCol(['branch', 'store', 'location', 'shop']);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',').map((c) => c.trim());

    if (typeIdx < 0 || cols.length < 3) {
      errors.push(`Row ${i + 1}: Invalid format`);
      continue;
    }

    const date = dateIdx >= 0 ? cols[dateIdx] : new Date().toISOString().split('T')[0];
    const itemType = cols[typeIdx] || '';
    const variety = varietyIdx >= 0 ? cols[varietyIdx] : 'Standard';
    const material = materialIdx >= 0 ? cols[materialIdx] : 'Gold';
    const weight = weightIdx >= 0 ? parseFloat(cols[weightIdx]) || 0 : 0;
    const quantity = qtyIdx >= 0 ? parseInt(cols[qtyIdx]) || 1 : 1;
    const unitPrice = priceIdx >= 0 ? parseFloat(cols[priceIdx]) || 0 : 0;
    const branch = branchIdx >= 0 ? cols[branchIdx] : '';

    if (!itemType) {
      errors.push(`Row ${i + 1}: Missing item type`);
      continue;
    }

    records.push({
      date,
      itemType,
      variety,
      material,
      weightGrams: weight,
      quantity,
      unitPrice,
      branch,
    });
  }

  return { records, errors };
}

// ─── CSV Template ─────────────────────────────────────────
export const CSV_TEMPLATE = `date,item_type,variety,material,weight_grams,quantity,unit_price,branch
2024-01-15,Bangle,Kundan,Gold,20,2,85000,Chennai
2024-01-20,Chain,Machine Cut,Gold,8,5,52000,Mumbai
2024-02-05,Ring,Solitaire,Diamond,3,1,45000,Bangalore
2024-02-10,Bangle,Temple,Gold,30,1,180000,Hyderabad
2024-03-01,Chain,Bombay,Gold,16,3,105000,Chennai`;

export const CSV_HEADERS_EXPLANATION = [
  { header: 'date', example: '2024-01-15', required: true, desc: 'Sale date (YYYY-MM-DD)' },
  { header: 'item_type', example: 'Bangle', required: true, desc: 'Chain, Bangle, Ring, Pendant, Bracelet, Necklace, Earring, Anklet, Nose Pin' },
  { header: 'variety', example: 'Kundan', required: true, desc: 'Machine Cut, Bombay, Solitaire, Temple, etc.' },
  { header: 'material', example: 'Gold', required: true, desc: 'Gold, Silver, Diamond' },
  { header: 'weight_grams', example: '20', required: true, desc: 'Weight in grams' },
  { header: 'quantity', example: '2', required: true, desc: 'Number of units sold' },
  { header: 'unit_price', example: '85000', required: true, desc: 'Price per unit in ₹' },
  { header: 'branch', example: 'Chennai', required: false, desc: 'Branch/city name' },
];
