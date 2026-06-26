import type {
  InventoryItem,
  Sale,
  Branch,
  Supplier,
  Customer,
  OptimizerParams,
  OptimizerResult,
  BranchOptimizerConfig,
  SupplierOptimizerConfig,
  DemographicOptimizerConfig,
  AgeGroup,
  Gender,
  Occupation,
  CustomerBackground,
} from '../types';
import { differenceInDays, parseISO } from 'date-fns';

// ─── Default Optimal Parameters ────────────────────────────
export function getDefaultParams(): OptimizerParams {
  return {
    targetShelfLife: 30,
    reorderTimeline: 15,
    reorderLimitPercent: 80,
    holdingCostPerDay: 0.02,
    discountAfterDays: 45,
    discountPercent: 8,
    safetyStockDays: 7,
    targetProfitMargin: 15,
    branchMultipliers: {},
  };
}

// ─── Calculate current actuals from data ──────────────────
function calculateCurrentMetrics(
  items: InventoryItem[],
  sales: Sale[],
  branches: Branch[],
  allCustomers: Customer[]
) {
  const today = new Date();

  // Current holding cost (cost of capital tied up in inventory)
  const inStock = items.filter((i) => i.status === 'In Stock' || i.status === 'Reserved');
  const totalStockValue = inStock.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);
  const avgDaysInStock =
    inStock.length > 0
      ? inStock.reduce(
          (sum, i) => sum + differenceInDays(today, parseISO(i.receivedDate)),
          0
        ) / inStock.length
      : 0;
  const currentHoldingCost = totalStockValue * (avgDaysInStock * 0.0002); // 0.02% per day

  // Revenue from sold items
  const sold = items.filter((i) => i.status === 'Sold');
  const currentRevenue = sold.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0);
  const currentCost = sold.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);
  const currentProfit = currentRevenue - currentCost - currentHoldingCost;

  // Discount loss: items in stock longer than 45 days would have been discounted
  const longStockItems = inStock.filter(
    (i) => differenceInDays(today, parseISO(i.receivedDate)) > 45
  );
  const currentDiscountLoss = longStockItems.reduce(
    (sum, i) => sum + i.sellingPrice * i.quantity * 0.08,
    0
  );

  // Stockout loss: estimate items that were understocked
  const understocked = items.filter(
    (i) => i.status === 'In Stock' && i.quantity <= i.minStockLevel && i.avgMonthlySales > 3
  );
  const stockoutDays = understocked.reduce(
    (sum, i) =>
      sum + Math.max(0, differenceInDays(today, parseISO(i.receivedDate)) - i.reorderLeadDays),
    0
  );
  const avgDailyRevenue = currentRevenue / Math.max(1, Math.max(0, differenceInDays(today, new Date(today.getFullYear(), today.getMonth() - 3, 1))));
  const currentStockoutLoss = stockoutDays * avgDailyRevenue * 0.3;

  // By branch
  const byBranch = branches.map((branch) => {
    const branchItems = items.filter((i) => i.branchId === branch.id);
    const branchSold = branchItems.filter((i) => i.status === 'Sold');
    const branchInStock = branchItems.filter(
      (i) => i.status === 'In Stock' || i.status === 'Reserved'
    );
    const branchRevenue = branchSold.reduce(
      (sum, i) => sum + i.sellingPrice * i.quantity,
      0
    );
    const branchCost = branchSold.reduce(
      (sum, i) => sum + i.costPrice * i.quantity,
      0
    );
    const branchStockValue = branchInStock.reduce(
      (sum, i) => sum + i.costPrice * i.quantity,
      0
    );
      const branchAvgDays =
        branchInStock.length > 0
          ? branchInStock.reduce(
              (sum, i) => sum + differenceInDays(today, parseISO(i.receivedDate)),
              0
            ) / branchInStock.length
          : 0;
      const branchHoldingCost = branchStockValue * (branchAvgDays * 0.0002);
      const branchProfit = branchRevenue - branchCost - branchHoldingCost;

      // Optimal shelf life for this branch
      const soldShelfLives = branchItems
        .filter((i) => i.soldDate != null)
        .map((i) => differenceInDays(parseISO(i.soldDate!), parseISO(i.receivedDate)));
    const optimalShelfLife =
      soldShelfLives.length > 0
        ? Math.round(
            (soldShelfLives.reduce((a, b) => a + b, 0) / soldShelfLives.length) * 0.85
          )
        : 30;

    return {
      branchId: branch.id,
      branchName: branch.name,
      revenue: branchRevenue,
      profit: branchProfit,
      holdingCost: branchHoldingCost,
      avgShelfLife: Math.round(branchAvgDays),
      optimalShelfLife,
      stockValue: branchStockValue,
    };
  });

  // By supplier
  const bySupplier = items.reduce<Map<string, typeof items>>((map, item) => {
    const existing = map.get(item.supplierId) || [];
    existing.push(item);
    map.set(item.supplierId, existing);
    return map;
  }, new Map());

  const bySupplierResult = Array.from(bySupplier.entries()).map(
    ([supplierId, supItems]) => {
      const supInStock = supItems.filter(
        (i) => i.status === 'In Stock' || i.status === 'Reserved'
      );
      const supStockValue = supInStock.reduce(
        (sum, i) => sum + i.costPrice * i.quantity,
        0
      );
      const supAvgDays =
        supInStock.length > 0
          ? supInStock.reduce(
              (sum, i) => sum + differenceInDays(today, parseISO(i.receivedDate)),
              0
            ) / supInStock.length
          : 0;

      const soldShelfLives = supItems
        .filter((i) => i.soldDate != null)
        .map((i) => differenceInDays(parseISO(i.soldDate!), parseISO(i.receivedDate)));
      const optimalShelfLife =
        soldShelfLives.length > 0
          ? Math.round(
              (soldShelfLives.reduce((a, b) => a + b, 0) / soldShelfLives.length) * 0.85
            )
          : 30;

      return {
        supplierId,
        avgShelfLife: Math.round(supAvgDays),
        optimalShelfLife,
        stockValue: supStockValue,
      };
    }
  );

  // By demographics
  const salesWithCustomer = sales
    .map((sale) => {
      const customer = allCustomers.find((c) => c.id === sale.customerId);
      const item = items.find((i) => i.id === sale.itemId);
      return { sale, customer, item };
    })
    .filter((s) => s.customer && s.item);

  const byAgeGroup: Record<AgeGroup, number[]> = {
    '18-25': [],
    '26-35': [],
    '36-45': [],
    '46-55': [],
    '55+': [],
  };
  const byGender: Record<Gender, number[]> = {
    Male: [],
    Female: [],
    Unisex: [],
  };
  const byOccupation: Record<Occupation, number[]> = {
    Business: [],
    Professional: [],
    Agriculture: [],
    Government: [],
    Homemaker: [],
    Student: [],
    Retired: [],
    Other: [],
  };
  const byBackground: Record<CustomerBackground, number[]> = {
    Urban: [],
    'Semi-Urban': [],
    Rural: [],
  };

  for (const { customer, item } of salesWithCustomer) {
    const shelfLife =
      item!.soldDate != null && item!.receivedDate
        ? differenceInDays(parseISO(item!.soldDate!), parseISO(item!.receivedDate))
        : 0;
    byAgeGroup[customer!.ageGroup].push(Math.max(0, shelfLife));
    byGender[customer!.gender].push(Math.max(0, shelfLife));
    byOccupation[customer!.occupation].push(Math.max(0, shelfLife));
    byBackground[customer!.background].push(Math.max(0, shelfLife));
  }

  const calcOptimal = (arr: number[]) =>
    arr.length > 0
      ? Math.round(
          (arr.reduce((a, b) => a + b, 0) / arr.length) * 0.85
        )
      : 30;
  const calcCurrent = (arr: number[]) =>
    arr.length > 0
      ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
      : 30;

  return {
    currentProfit,
    currentRevenue,
    currentHoldingCost,
    currentDiscountLoss,
    currentStockoutLoss,
    totalStockValue,
    avgDaysInStock: Math.round(avgDaysInStock),
    byBranch,
    bySupplierResult,
    byAgeGroup: Object.entries(byAgeGroup).map(([key, vals]) => ({
      demographic: key,
      current: calcCurrent(vals),
      optimal: calcOptimal(vals),
    })),
    byGender: Object.entries(byGender).map(([key, vals]) => ({
      demographic: key,
      current: calcCurrent(vals),
      optimal: calcOptimal(vals),
    })),
    byOccupation: Object.entries(byOccupation).map(([key, vals]) => ({
      demographic: key,
      current: calcCurrent(vals),
      optimal: calcOptimal(vals),
    })),
    byBackground: Object.entries(byBackground).map(([key, vals]) => ({
      demographic: key,
      current: calcCurrent(vals),
      optimal: calcOptimal(vals),
    })),
  };
}

// ─── Simulate profit impact ────────────────────────────────
export function simulateOptimizer(
  items: InventoryItem[],
  sales: Sale[],
  branches: Branch[],
  suppliers: Supplier[],
  allCustomers: Customer[],
  params: OptimizerParams
): OptimizerResult {
  const today = new Date();
  const current = calculateCurrentMetrics(items, sales, branches, allCustomers);

  // Simulate changes based on params
  let projectedRevenue = current.currentRevenue;
  let projectedHoldingCost = 0;
  let projectedDiscountLoss = 0;
  let projectedStockoutLoss = 0;
  let itemsAffected = 0;
  let itemsImproved = 0;
  let itemsWorsened = 0;

  const inStock = items.filter(
    (i) => i.status === 'In Stock' || i.status === 'Reserved'
  );

  // For each in-stock item, simulate holding cost impact
  for (const item of inStock) {
    const daysInStock = differenceInDays(today, parseISO(item.receivedDate));
    const itemValue = item.costPrice * item.quantity;

    // If target shelf life is reduced, holding cost decreases (faster turnover)
    // If target shelf life is increased, holding cost increases (slower turnover)
    const shelfLifeRatio = daysInStock / Math.max(1, params.targetShelfLife);

    // Holding cost: items that exceed target shelf life incur higher costs
    if (shelfLifeRatio > 1) {
      const excessDays = daysInStock - params.targetShelfLife;
      projectedHoldingCost +=
        itemValue * (params.targetShelfLife * 0.0002) + // base cost
        itemValue * (excessDays * params.holdingCostPerDay * 0.01); // penalty
    } else {
      projectedHoldingCost += itemValue * (daysInStock * 0.0002);
    }

    // Discount impact: if items exceed discount threshold
    if (daysInStock > params.discountAfterDays) {
      projectedDiscountLoss +=
        item.sellingPrice * item.quantity * (params.discountPercent / 100);
    }

    // Stockout risk: if reorder timeline is too late
    const dailySales = item.avgMonthlySales / 30;
    const estimatedDaysToStockout =
      dailySales > 0 ? item.quantity / dailySales : 999;

    if (estimatedDaysToStockout < params.reorderTimeline) {
      // High stockout risk
      const stockoutDays = params.reorderTimeline - estimatedDaysToStockout;
      projectedStockoutLoss +=
        dailySales * item.sellingPrice * stockoutDays * 0.5;
    }

    // Count affected items
    const currentShelfLife = daysInStock;
    const improvement =
      Math.abs(currentShelfLife - params.targetShelfLife) <
      Math.abs(currentShelfLife - 30)
        ? 'improved'
        : 'worsened';

    itemsAffected++;
    if (improvement === 'improved') itemsImproved++;
    else itemsWorsened++;
  }

  // Revenue impact from reorder optimization
  // If reorder limit is lower, we stock less → may lose some sales but reduce holding cost
  // If reorder limit is higher, we stock more → more sales but higher holding cost
  const reorderImpactFactor = (params.reorderLimitPercent - 80) / 80; // normalize around 80%
  projectedRevenue += current.currentRevenue * reorderImpactFactor * 0.05;

  // Safety stock impact: more safety stock = fewer stockouts
  const safetyStockBenefit =
    (params.safetyStockDays - 7) * 0.002; // each extra day reduces stockout by 0.2%
  projectedRevenue += current.currentRevenue * Math.max(0, safetyStockBenefit);
  projectedStockoutLoss *= Math.max(0.5, 1 - safetyStockBenefit);

  const projectedProfit =
    projectedRevenue -
    (current.currentRevenue - current.currentProfit) - // keep cost same
    projectedHoldingCost -
    projectedDiscountLoss -
    projectedStockoutLoss;

  // Optimal shelf life by branch (recalculate with params)
  const optimalShelfLifeByBranch = current.byBranch.map((b) => ({
    branchId: b.branchId,
    branchName: b.branchName,
    optimal: Math.max(
      7,
      Math.min(60, Math.round(b.optimalShelfLife * (params.targetShelfLife / 30)))
    ),
    current: b.avgShelfLife,
  }));

  // Optimal shelf life by supplier
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
  const optimalShelfLifeBySupplier = current.bySupplierResult.map((s) => ({
    supplierId: s.supplierId,
    supplierName: supplierMap.get(s.supplierId) || s.supplierId,
    optimal: Math.max(
      7,
      Math.min(60, Math.round(s.optimalShelfLife * (params.targetShelfLife / 30)))
    ),
    current: s.avgShelfLife,
  }));

  // Optimal shelf life by demographics
  const optimalShelfLifeByDemographic = [
    ...current.byAgeGroup.map((d) => ({
      demographic: `Age: ${d.demographic}`,
      optimal: Math.max(7, Math.min(60, Math.round(d.optimal * (params.targetShelfLife / 30)))),
      current: d.current,
    })),
    ...current.byGender.map((d) => ({
      demographic: `Gender: ${d.demographic}`,
      optimal: Math.max(7, Math.min(60, Math.round(d.optimal * (params.targetShelfLife / 30)))),
      current: d.current,
    })),
    ...current.byOccupation.map((d) => ({
      demographic: `Occ: ${d.demographic}`,
      optimal: Math.max(7, Math.min(60, Math.round(d.optimal * (params.targetShelfLife / 30)))),
      current: d.current,
    })),
    ...current.byBackground.map((d) => ({
      demographic: `Bg: ${d.demographic}`,
      optimal: Math.max(7, Math.min(60, Math.round(d.optimal * (params.targetShelfLife / 30)))),
      current: d.current,
    })),
  ];

  // Reorder timeline by branch
  const reorderTimelineByBranch = branches.map((branch) => {
    const branchMultiplier = params.branchMultipliers[branch.id] || 1;
    const baseTimeline = params.reorderTimeline * branchMultiplier;
    return {
      branchId: branch.id,
      branchName: branch.name,
      timeline: Math.round(Math.max(5, Math.min(30, baseTimeline))),
    };
  });

  // Reorder limit by supplier
  const reorderLimitBySupplier = suppliers.map((supplier) => {
    const reliabilityFactor = supplier.reliabilityScore / 10;
    const limit = Math.round(
      (params.reorderLimitPercent / 100) * reliabilityFactor * 100
    );
    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      limit: Math.max(20, Math.min(150, limit)),
    };
  });

  // Recommendations
  const recommendations: string[] = [];
  if (params.targetShelfLife < 20) {
    recommendations.push(
      '⚠️ Very low shelf life target may cause frequent stockouts. Consider increasing to 25-35 days.'
    );
  }
  if (params.targetShelfLife > 45) {
    recommendations.push(
      '⚠️ High shelf life target increases holding costs. Consider reducing to 25-40 days.'
    );
  }
  if (params.reorderTimeline < 7) {
    recommendations.push(
      '⚠️ Reorder timeline is too short. Suppliers may not deliver in time. Minimum recommended: 10 days.'
    );
  }
  if (params.reorderLimitPercent < 50) {
    recommendations.push(
      '⚠️ Very low reorder limit may cause frequent stockouts and lost sales.'
    );
  }
  if (params.discountPercent > 15) {
    recommendations.push(
      '⚠️ High discount rate significantly erodes profit margins. Consider 5-10% range.'
    );
  }
  if (projectedProfit > current.currentProfit) {
    recommendations.push(
      '✅ Current configuration projects an increase in overall profitability.'
    );
  } else {
    recommendations.push(
      '❌ Current configuration may reduce profitability. Adjust sliders to optimize.'
    );
  }

  const byBranchItems = optimalShelfLifeByBranch.filter(
    (b) => b.current > b.optimal + 5
  );
  if (byBranchItems.length > 0) {
    recommendations.push(
      `📦 ${byBranchItems.length} branches have shelf life significantly above optimal. Consider inter-branch transfers or targeted promotions.`
    );
  }

  const currentProfitMargin =
    current.currentRevenue > 0
      ? (current.currentProfit / current.currentRevenue) * 100
      : 0;
  const projectedProfitMargin =
    projectedRevenue > 0 ? (projectedProfit / projectedRevenue) * 100 : 0;

  return {
    currentProfit: Math.round(current.currentProfit),
    projectedProfit: Math.round(projectedProfit),
    profitChange: Math.round(projectedProfit - current.currentProfit),
    profitChangePercent:
      current.currentProfit !== 0
        ? Math.round(
            ((projectedProfit - current.currentProfit) /
              Math.abs(current.currentProfit)) *
              10000
          ) / 100
        : 0,
    currentProfitMargin: Math.round(currentProfitMargin * 100) / 100,
    projectedProfitMargin: Math.round(projectedProfitMargin * 100) / 100,
    targetProfitMargin: params.targetProfitMargin,
    meetsTarget: projectedProfitMargin >= params.targetProfitMargin,
    currentRevenue: Math.round(current.currentRevenue),
    projectedRevenue: Math.round(projectedRevenue),
    currentCost: Math.round(current.currentRevenue - current.currentProfit),
    projectedCost: Math.round(projectedRevenue - projectedProfit),
    currentHoldingCost: Math.round(current.currentHoldingCost),
    projectedHoldingCost: Math.round(projectedHoldingCost),
    currentDiscountLoss: Math.round(current.currentDiscountLoss),
    projectedDiscountLoss: Math.round(projectedDiscountLoss),
    currentStockoutLoss: Math.round(current.currentStockoutLoss),
    projectedStockoutLoss: Math.round(projectedStockoutLoss),
    itemsAffected,
    itemsImproved,
    itemsWorsened,
    optimalShelfLifeByBranch,
    optimalShelfLifeBySupplier,
    optimalShelfLifeByDemographic,
    reorderTimelineByBranch,
    reorderLimitBySupplier,
    recommendations,
  };
}

// ─── Generate Branch Configs ──────────────────────────────
export function generateBranchConfigs(
  items: InventoryItem[],
  branches: Branch[]
): BranchOptimizerConfig[] {
  const today = new Date();
  return branches.map((branch) => {
    const branchItems = items.filter((i) => i.branchId === branch.id);
    const inStock = branchItems.filter(
      (i) => i.status === 'In Stock' || i.status === 'Reserved'
    );
    const sold = branchItems.filter((i) => i.status === 'Sold');

    const avgShelfLife =
      inStock.length > 0
        ? inStock.reduce(
            (sum, i) => sum + differenceInDays(today, parseISO(i.receivedDate)),
            0
          ) / inStock.length
        : 30;

    const optimalShelfLife = Math.max(15, Math.min(45, Math.round(avgShelfLife * 0.85)));
    const reorderTimeline = Math.max(10, Math.min(25, Math.round(optimalShelfLife * 0.5)));
    const reorderLimit = Math.max(50, Math.min(120, Math.round((sold.length / Math.max(1, inStock.length)) * 100)));
    const safetyStockDays = Math.max(3, Math.min(14, Math.round(reorderTimeline * 0.5)));

    return {
      branchId: branch.id,
      branchName: branch.name,
      targetShelfLife: optimalShelfLife,
      reorderTimeline,
      reorderLimit,
      safetyStockDays,
      holdingCostPercent: 2,
      discountAfterDays: Math.max(30, Math.min(60, Math.round(optimalShelfLife * 1.5))),
      discountPercent: 8,
    };
  });
}

// ─── Generate Supplier Configs ────────────────────────────
export function generateSupplierConfigs(
  items: InventoryItem[],
  suppliers: Supplier[]
): SupplierOptimizerConfig[] {
  const today = new Date();
  return suppliers.map((supplier) => {
    const supItems = items.filter((i) => i.supplierId === supplier.id);
    const inStock = supItems.filter(
      (i) => i.status === 'In Stock' || i.status === 'Reserved'
    );

    const avgShelfLife =
      inStock.length > 0
        ? inStock.reduce(
            (sum, i) => sum + differenceInDays(today, parseISO(i.receivedDate)),
            0
          ) / inStock.length
        : 30;

    const optimalShelfLife = Math.max(15, Math.min(45, Math.round(avgShelfLife * 0.85)));
    const reorderTimeline = Math.max(
      supplier.avgDeliveryDays + 3,
      Math.min(25, Math.round(optimalShelfLife * 0.5))
    );
    const reorderLimit = Math.max(
      40,
      Math.min(150, Math.round(100 / (supplier.reliabilityScore / 10)))
    );

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      targetShelfLife: optimalShelfLife,
      reorderTimeline,
      reorderLimit,
      leadTimeDays: supplier.avgDeliveryDays,
      reliabilityAdjustment: supplier.reliabilityScore / 10,
    };
  });
}

// ─── Generate Demographic Configs ─────────────────────────
export function generateDemographicConfigs(
  items: InventoryItem[],
  sales: Sale[],
  customers: Customer[]
): DemographicOptimizerConfig[] {
  const salesWithCustomer = sales
    .map((sale) => {
      const customer = customers.find((c) => c.id === sale.customerId);
      const item = items.find((i) => i.id === sale.itemId);
      return { sale, customer, item };
    })
    .filter((s) => s.customer && s.item);

  const calcMetrics = (
    filterFn: (c: Customer) => boolean
  ): { avgShelfLife: number; salesCount: number; totalRevenue: number } => {
    const filtered = salesWithCustomer.filter((s) => filterFn(s.customer!));
    const shelfLives = filtered.map((s) => {
      if (!s.item?.soldDate || !s.item?.receivedDate) return 0;
      return Math.max(
        0,
        differenceInDays(parseISO(s.item.soldDate), parseISO(s.item.receivedDate))
      );
    });
    const avgShelfLife =
      shelfLives.length > 0
        ? shelfLives.reduce((a, b) => a + b, 0) / shelfLives.length
        : 30;
    const totalRevenue = filtered.reduce(
      (sum, s) => sum + s.sale.salePrice * s.sale.quantity,
      0
    );
    return {
      avgShelfLife: Math.round(avgShelfLife),
      salesCount: filtered.length,
      totalRevenue,
    };
  };

  const ageGroups: AgeGroup[] = ['18-25', '26-35', '36-45', '46-55', '55+'];
  const genders: Gender[] = ['Male', 'Female', 'Unisex'];
  const occupations: Occupation[] = [
    'Business',
    'Professional',
    'Agriculture',
    'Government',
    'Homemaker',
    'Student',
    'Retired',
    'Other',
  ];
  const backgrounds: CustomerBackground[] = ['Urban', 'Semi-Urban', 'Rural'];

  const configs: DemographicOptimizerConfig[] = [];

  for (const ag of ageGroups) {
    const metrics = calcMetrics((c) => c.ageGroup === ag);
    configs.push({
      demographic: ag,
      type: 'ageGroup',
      targetShelfLife: Math.max(15, Math.min(50, Math.round(metrics.avgShelfLife * 0.85))),
      reorderPriority: metrics.salesCount > 10 ? 3 : metrics.salesCount > 5 ? 2 : 1,
      stockLevelMultiplier:
        metrics.totalRevenue > 500000
          ? 1.3
          : metrics.totalRevenue > 200000
          ? 1.1
          : 0.9,
    });
  }

  for (const g of genders) {
    const metrics = calcMetrics((c) => c.gender === g);
    configs.push({
      demographic: g,
      type: 'gender',
      targetShelfLife: Math.max(15, Math.min(50, Math.round(metrics.avgShelfLife * 0.85))),
      reorderPriority: metrics.salesCount > 15 ? 3 : metrics.salesCount > 5 ? 2 : 1,
      stockLevelMultiplier:
        metrics.totalRevenue > 500000
          ? 1.2
          : metrics.totalRevenue > 200000
          ? 1.0
          : 0.8,
    });
  }

  for (const o of occupations) {
    const metrics = calcMetrics((c) => c.occupation === o);
    configs.push({
      demographic: o,
      type: 'occupation',
      targetShelfLife: Math.max(15, Math.min(50, Math.round(metrics.avgShelfLife * 0.85))),
      reorderPriority: metrics.salesCount > 8 ? 3 : metrics.salesCount > 3 ? 2 : 1,
      stockLevelMultiplier:
        metrics.totalRevenue > 300000 ? 1.2 : metrics.totalRevenue > 100000 ? 1.0 : 0.8,
    });
  }

  for (const b of backgrounds) {
    const metrics = calcMetrics((c) => c.background === b);
    configs.push({
      demographic: b,
      type: 'background',
      targetShelfLife: Math.max(15, Math.min(50, Math.round(metrics.avgShelfLife * 0.85))),
      reorderPriority: metrics.salesCount > 10 ? 3 : metrics.salesCount > 5 ? 2 : 1,
      stockLevelMultiplier:
        metrics.totalRevenue > 400000 ? 1.2 : metrics.totalRevenue > 150000 ? 1.0 : 0.8,
    });
  }

  return configs;
}

// ─── Format helpers ────────────────────────────────────────
export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}
