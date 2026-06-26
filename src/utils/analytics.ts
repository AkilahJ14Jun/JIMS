import type {
  InventoryItem,
  Sale,
  ShelfLife,
  ReorderAlert,
  FastMoverItem,
  SlowMoverItem,
  DemandByBranch,
  DemandByItemType,
  ProfitabilitySummary,
  Supplier,
  Branch,
  ItemType,
  Material,
} from '../types';
import { format, differenceInDays, parseISO } from 'date-fns';

// ─── Shelf Life Calculations ─────────────────────────────
export function calculateShelfLives(items: InventoryItem[]): ShelfLife[] {
  const today = new Date();
  return items.map((item) => {
    const received = parseISO(item.receivedDate);
    const sold = item.soldDate ? parseISO(item.soldDate) : today;
    const days = differenceInDays(sold, received);
    return {
      itemId: item.id,
      itemName: item.name,
      itemType: item.itemType,
      variety: item.variety,
      weightGrams: item.weightGrams,
      branchId: item.branchId,
      supplierId: item.supplierId,
      receivedDate: item.receivedDate,
      soldDate: item.soldDate,
      daysInStock: Math.max(0, days),
      status: item.status === 'Sold' ? 'Sold' : 'In Stock',
      material: item.material,
    };
  });
}

// ─── Fast Movers ─────────────────────────────────────────
export function getFastMovers(
  items: InventoryItem[],
  _sales: Sale[],
  branches: Branch[]
): FastMoverItem[] {
  const soldItems = items.filter((i) => i.status === 'Sold');
  const result: FastMoverItem[] = [];

  const grouped = new Map<string, { items: typeof soldItems; totalRevenue: number }>();

  for (const item of soldItems) {
    const key = `${item.itemType}-${item.variety}-${item.weightGrams}-${item.branchId}-${item.material}`;
    const existing = grouped.get(key);
    const itemRevenue = item.sellingPrice * item.quantity;
    if (existing) {
      existing.items.push(item);
      existing.totalRevenue += itemRevenue;
    } else {
      grouped.set(key, { items: [item], totalRevenue: itemRevenue });
    }
  }

  for (const [, data] of grouped) {
    const avgShelfLife =
      data.items.reduce((sum, i) => {
        const diff = differenceInDays(parseISO(i.soldDate!), parseISO(i.receivedDate));
        return sum + Math.max(0, diff);
      }, 0) / data.items.length;

    const totalMonths =
      differenceInDays(
        new Date(),
        parseISO(data.items.sort((a, b) => a.receivedDate.localeCompare(b.receivedDate))[0].receivedDate)
      ) / 30;

    const monthlySales = totalMonths > 0 ? data.items.length / totalMonths : data.items.length;
    const branch = branches.find((b) => b.id === data.items[0].branchId);

    result.push({
      itemId: data.items[0].id,
      itemName: data.items[0].name,
      itemType: data.items[0].itemType,
      variety: data.items[0].variety,
      weightGrams: data.items[0].weightGrams,
      material: data.items[0].material,
      branchName: branch?.name || 'Unknown',
      avgShelfLife: Math.round(avgShelfLife),
      monthlySales: Math.round(monthlySales * 10) / 10,
      revenue: Math.round(data.totalRevenue * 100) / 100,
    });
  }

  return result.sort((a, b) => b.monthlySales - a.monthlySales);
}

// ─── Slow Movers ─────────────────────────────────────────
export function getSlowMovers(
  items: InventoryItem[],
  branches: Branch[]
): SlowMoverItem[] {
  const inStock = items.filter((i) => i.status === 'In Stock' || i.status === 'Reserved');
  const today = new Date();

  return inStock
    .map((item) => {
      const daysInStock = differenceInDays(today, parseISO(item.receivedDate));
      const branch = branches.find((b) => b.id === item.branchId);
      return {
        itemId: item.id,
        itemName: item.name,
        itemType: item.itemType,
        variety: item.variety,
        weightGrams: item.weightGrams,
        material: item.material,
        branchName: branch?.name || 'Unknown',
        daysInStock,
        quantity: item.quantity,
        costValue: item.costPrice * item.quantity,
      };
    })
    .sort((a, b) => b.daysInStock - a.daysInStock);
}

// ─── Reorder Alerts ──────────────────────────────────────
export function getReorderAlerts(
  items: InventoryItem[],
  suppliers: Supplier[]
): ReorderAlert[] {
  const alerts: ReorderAlert[] = [];

  // Group in-stock items by itemType + variety + weight + branch
  const grouped = new Map<string, InventoryItem[]>();

  for (const item of items) {
    if (item.status !== 'In Stock' && item.status !== 'Sold') continue;
    const key = `${item.itemType}-${item.variety}-${item.weightGrams}-${item.branchId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }

  for (const [, group] of grouped) {
    const first = group[0];
    const totalStock = group.reduce((sum, i) => sum + i.quantity, 0);
    const avgMonthlySales =
      group.reduce((sum, i) => sum + i.avgMonthlySales, 0) / group.length;
    const avgLeadDays =
      group.reduce((sum, i) => sum + i.reorderLeadDays, 0) / group.length;

    // Calculate estimated days to stockout
    const dailySales = avgMonthlySales / 30;
    const estimatedDaysToStockout = dailySales > 0 ? totalStock / dailySales : 999;

    // Determine priority
    const priority: ReorderAlert['priority'] =
      estimatedDaysToStockout <= avgLeadDays
        ? 'Critical'
        : estimatedDaysToStockout <= avgLeadDays * 1.5
          ? 'High'
          : estimatedDaysToStockout <= avgLeadDays * 3
            ? 'Medium'
            : 'Low';

    // Recommended quantity
    const recommendedQty = Math.max(
      0,
      Math.ceil(avgMonthlySales * 2 - totalStock)
    );

    // Duplicate / re-order prevention check
    let blocked = false;
    let blockReason: string | undefined;

    if (recommendedQty <= 0) {
      blocked = true;
      blockReason = 'Sufficient stock available';
    } else {
      // Check if current stock can cover until reorder arrives
      const salesDuringLeadTime = dailySales * avgLeadDays;
      if (totalStock > salesDuringLeadTime * 1.5 && avgMonthlySales < 3) {
        blocked = true;
        blockReason = `Current stock (${totalStock}) covers ${Math.round(estimatedDaysToStockout)} days of sales (avg ${avgMonthlySales.toFixed(1)}/month). No reorder needed.`;
      }
    }

    const supplier = suppliers.find((s) => s.id === first.supplierId);

    alerts.push({
      id: `REO-${first.id}`,
      itemId: first.id,
      itemName: first.name,
      itemType: first.itemType,
      variety: first.variety,
      weightGrams: first.weightGrams,
      branchId: first.branchId,
      supplierId: first.supplierId,
      currentStock: totalStock,
      minStockLevel: first.minStockLevel,
      avgMonthlySales: Math.round(avgMonthlySales * 10) / 10,
      reorderLeadDays: Math.round(avgLeadDays),
      estimatedDaysToStockout: Math.round(estimatedDaysToStockout),
      recommendedQty: recommendedQty,
      priority,
      blocked,
      blockReason,
      supplierAvgDeliveryDays: supplier?.avgDeliveryDays || avgLeadDays,
      estimatedCost: recommendedQty * first.costPrice,
    });
  }

  return alerts
    .filter((a) => !a.blocked)
    .sort((a, b) => {
      const pOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4);
    });
}

// ─── Demand by Branch ────────────────────────────────────
export function getDemandByBranch(
  items: InventoryItem[],
  sales: Sale[],
  branches: Branch[]
): DemandByBranch[] {
  return branches.map((branch) => {
    const branchSales = sales.filter((s) => s.branchId === branch.id);
    const totalRevenue = branchSales.reduce((s, sale) => s + sale.salePrice * sale.quantity, 0);
    const totalCost = branchSales.reduce((s, sale) => s + sale.costPrice * sale.quantity, 0);
    const branchItems = items.filter((i) => i.branchId === branch.id);

    const itemTypeCount = new Map<string, number>();
    for (const sale of branchSales) {
      const item = branchItems.find((i) => i.id === sale.itemId);
      if (item) {
        itemTypeCount.set(item.itemType, (itemTypeCount.get(item.itemType) || 0) + sale.quantity);
      }
    }

    const topItemTypes = Array.from(itemTypeCount.entries())
      .map(([itemType, count]) => ({ itemType: itemType as ItemType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      branchId: branch.id,
      branchName: branch.name,
      totalSales: branchSales.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalProfit: Math.round((totalRevenue - totalCost) * 100) / 100,
      topItemTypes,
    };
  });
}

// ─── Demand by Item Type ─────────────────────────────────
export function getDemandByItemType(
  items: InventoryItem[],
  sales: Sale[]
): DemandByItemType[] {
  const result: DemandByItemType[] = [];

  for (const item of items) {
    const itemSales = sales.filter((s) => s.itemId === item.id);
    const totalSales = itemSales.reduce((s, sale) => s + sale.quantity, 0);
    const totalRevenue = itemSales.reduce((s, sale) => s + sale.salePrice * sale.quantity, 0);

    const shelfLife = item.soldDate
      ? Math.max(0, differenceInDays(parseISO(item.soldDate), parseISO(item.receivedDate)))
      : null;

    result.push({
      itemType: item.itemType,
      variety: item.variety,
      totalSales,
      totalRevenue,
      avgShelfLife: shelfLife || 0,
      avgWeight: item.weightGrams,
    });
  }

  // Aggregate
  const grouped = new Map<string, DemandByItemType>();
  for (const r of result) {
    const key = `${r.itemType}-${r.variety}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.totalSales += r.totalSales;
      existing.totalRevenue += r.totalRevenue;
      existing.avgShelfLife = (existing.avgShelfLife + r.avgShelfLife) / 2;
      existing.avgWeight = (existing.avgWeight + r.avgWeight) / 2;
    } else {
      grouped.set(key, { ...r });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

// ─── Profitability ───────────────────────────────────────
export function getProfitability(
  items: InventoryItem[],
  sales: Sale[],
  branches: Branch[],
  suppliersList: Supplier[]
): ProfitabilitySummary {
  const totalRevenue = sales.reduce((s, sale) => s + sale.salePrice * sale.quantity, 0);
  const totalCost = sales.reduce((s, sale) => s + sale.costPrice * sale.quantity, 0);
  const totalProfit = totalRevenue - totalCost;
  const totalSold = sales.length;
  const totalInStock = items.filter((i) => i.status === 'In Stock').length;
  const avgShelfLife =
    items
      .filter((i) => i.soldDate)
      .reduce((sum, i) => sum + differenceInDays(parseISO(i.soldDate!), parseISO(i.receivedDate)), 0) /
    Math.max(1, items.filter((i) => i.soldDate).length);

  // Branch profitability
  const branchProfitability = branches.map((branch) => {
    const branchSales = sales.filter((s) => s.branchId === branch.id);
    const rev = branchSales.reduce((s, sale) => s + sale.salePrice * sale.quantity, 0);
    const cost = branchSales.reduce((s, sale) => s + sale.costPrice * sale.quantity, 0);
    return {
      branchId: branch.id,
      branchName: branch.name,
      revenue: Math.round(rev * 100) / 100,
      profit: Math.round((rev - cost) * 100) / 100,
      margin: rev > 0 ? Math.round(((rev - cost) / rev) * 10000) / 100 : 0,
    };
  });

  // Supplier profitability
  const supplierProfitability = suppliersList.map((sup) => {
    const supItems = items.filter((i) => i.supplierId === sup.id);
    const supItemIds = new Set(supItems.map((i) => i.id));
    const supSales = sales.filter((s) => supItemIds.has(s.itemId));
    const rev = supSales.reduce((s, sale) => s + sale.salePrice * sale.quantity, 0);
    const cost = supSales.reduce((s, sale) => s + sale.costPrice * sale.quantity, 0);
    return {
      supplierId: sup.id,
      supplierName: sup.name,
      revenue: Math.round(rev * 100) / 100,
      profit: Math.round((rev - cost) * 100) / 100,
      margin: rev > 0 ? Math.round(((rev - cost) / rev) * 10000) / 100 : 0,
    };
  });

  // Material profitability
  const materials: Material[] = ['Gold', 'Silver', 'Diamond'];
  const materialProfitability = materials.map((mat) => {
    const matItems = items.filter((i) => i.material === mat);
    const matItemIds = new Set(matItems.map((i) => i.id));
    const matSales = sales.filter((s) => matItemIds.has(s.itemId));
    const rev = matSales.reduce((s, sale) => s + sale.salePrice * sale.quantity, 0);
    const cost = matSales.reduce((s, sale) => s + sale.costPrice * sale.quantity, 0);
    return {
      material: mat,
      revenue: Math.round(rev * 100) / 100,
      profit: Math.round((rev - cost) * 100) / 100,
      margin: rev > 0 ? Math.round(((rev - cost) / rev) * 10000) / 100 : 0,
    };
  });

  // Item type profitability
  const itemTypes: ItemType[] = [
    'Chain', 'Bangle', 'Ring', 'Pendant', 'Bracelet', 'Necklace', 'Earring', 'Anklet', 'Nose Pin',
  ];
  const itemTypeProfitability = itemTypes.map((it) => {
    const itItems = items.filter((i) => i.itemType === it);
    const itItemIds = new Set(itItems.map((i) => i.id));
    const itSales = sales.filter((s) => itItemIds.has(s.itemId));
    const rev = itSales.reduce((s, sale) => s + sale.salePrice * sale.quantity, 0);
    const cost = itSales.reduce((s, sale) => s + sale.costPrice * sale.quantity, 0);
    return {
      itemType: it,
      revenue: Math.round(rev * 100) / 100,
      profit: Math.round((rev - cost) * 100) / 100,
      margin: rev > 0 ? Math.round(((rev - cost) / rev) * 10000) / 100 : 0,
    };
  });

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 10000) / 100 : 0,
    totalItems: items.length,
    totalSold,
    totalInStock,
    avgShelfLife: Math.round(avgShelfLife),
    branchProfitability,
    supplierProfitability,
    materialProfitability,
    itemTypeProfitability,
  };
}

// ─── Helpers ─────────────────────────────────────────────
export function formatCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

export function formatFullCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export const ITEM_ICONS: Record<ItemType, string> = {
  Chain: '🔗',
  Bangle: '⭕',
  Ring: '💍',
  Pendant: '📿',
  Bracelet: '✨',
  Necklace: '📿',
  Earring: '💎',
  Anklet: '🦶',
  'Nose Pin': '👃',
};

export const MATERIAL_COLORS: Record<Material, string> = {
  Gold: '#FFD700',
  Silver: '#C0C0C0',
  Diamond: '#B9F2FF',
};

export const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
};

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd MMM yyyy');
}

export function getMaterialColorClass(material: Material): string {
  switch (material) {
    case 'Gold':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Silver':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'Diamond':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
  }
}
