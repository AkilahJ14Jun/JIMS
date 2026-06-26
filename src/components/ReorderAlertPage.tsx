import React from 'react';
import type { InventoryItem, Supplier, Branch, Material, ReorderAlert } from '../types';
import { getReorderAlerts, formatCurrency, getMaterialColorClass, ITEM_ICONS } from '../utils/analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
};

interface ReorderProps {
  items: InventoryItem[];
  suppliers: Supplier[];
  branches: Branch[];
}

export default function ReorderAlertPage({ items, suppliers, branches }: ReorderProps) {
  const [filterBranch, setFilterBranch] = React.useState<string>('All');
  const [filterSupplier, setFilterSupplier] = React.useState<string>('All');
  const [filterPriority, setFilterPriority] = React.useState<string>('All');
  const [filterMaterial, setFilterMaterial] = React.useState<Material | 'All'>('All');
  const [showBlocked, setShowBlocked] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<ReorderAlert | null>(null);

  // Get ALL alerts (including blocked ones for reference)
  const allAlerts = React.useMemo(() => {
    return getReorderAlerts(items, suppliers);
  }, [items, suppliers]);

  // Also compute blocked alerts
  const blockedAlerts = React.useMemo(() => {
    const alerts: ReorderAlert[] = [];
    const grouped = new Map<string, InventoryItem[]>();
    for (const item of items) {
      if (item.status !== 'In Stock') continue;
      const key = `${item.itemType}-${item.variety}-${item.weightGrams}-${item.branchId}`;
      const existing = grouped.get(key);
      if (existing) existing.push(item);
      else grouped.set(key, [item]);
    }
    for (const [, group] of grouped) {
      const first = group[0];
      const totalStock = group.reduce((sum, i) => sum + i.quantity, 0);
      const avgMonthlySales = group.reduce((sum, i) => sum + i.avgMonthlySales, 0) / group.length;
      const avgLeadDays = group.reduce((sum, i) => sum + i.reorderLeadDays, 0) / group.length;
      const dailySales = avgMonthlySales / 30;
      const estimatedDaysToStockout = dailySales > 0 ? totalStock / dailySales : 999;
      const recommendedQty = Math.max(0, Math.ceil(avgMonthlySales * 2 - totalStock));
      const supplier = suppliers.find((s) => s.id === first.supplierId);
      const salesDuringLeadTime = dailySales * avgLeadDays;
      if (totalStock > salesDuringLeadTime * 1.5 && avgMonthlySales < 3 && recommendedQty > 0) {
        alerts.push({
          id: `BLK-${first.id}`,
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
          recommendedQty,
          priority: 'Low',
          blocked: true,
          blockReason: `Stock (${totalStock}) covers ${Math.round(estimatedDaysToStockout)} days. Reorder would arrive in ~${Math.round(avgLeadDays)} days. No restock needed.`,
          supplierAvgDeliveryDays: supplier?.avgDeliveryDays || avgLeadDays,
          estimatedCost: recommendedQty * first.costPrice,
        });
      }
    }
    return alerts;
  }, [items, suppliers]);

  const filtered = React.useMemo(() => {
    let result = allAlerts;
    if (filterBranch !== 'All') result = result.filter((a) => a.branchId === filterBranch);
    if (filterSupplier !== 'All') result = result.filter((a) => a.supplierId === filterSupplier);
    if (filterPriority !== 'All') result = result.filter((a) => a.priority === filterPriority);
    if (filterMaterial !== 'All') {
      const itemMat = new Set(items.filter((i) => i.material === filterMaterial).map((i) => i.id));
      result = result.filter((a) => itemMat.has(a.itemId));
    }
    return result;
  }, [allAlerts, filterBranch, filterSupplier, filterPriority, filterMaterial, items]);

  const getBranchName = (id: string) => branches.find((b) => b.id === id)?.name || id;
  const getSupplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id;

  // Summary stats
  const criticalCount = allAlerts.filter((a) => a.priority === 'Critical').length;
  const highCount = allAlerts.filter((a) => a.priority === 'High').length;
  const mediumCount = allAlerts.filter((a) => a.priority === 'Medium').length;
  const lowCount = allAlerts.filter((a) => a.priority === 'Low').length;
  const totalEstCost = allAlerts.reduce((sum, a) => sum + a.estimatedCost, 0);

  // Priority distribution for chart
  const priorityData = [
    { priority: 'Critical', count: criticalCount, color: '#ef4444' },
    { priority: 'High', count: highCount, color: '#f97316' },
    { priority: 'Medium', count: mediumCount, color: '#eab308' },
    { priority: 'Low', count: lowCount, color: '#22c55e' },
  ];

  // Top items by recommended qty
  const topReorderItems = [...allAlerts].sort((a, b) => b.recommendedQty - a.recommendedQty).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Stock Replenishment</h2>
          <p className="text-slate-500 mt-1">Smart reorder recommendations with duplicate prevention</p>
        </div>
        <button
          onClick={() => setShowBlocked(!showBlocked)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            showBlocked
              ? 'bg-slate-200 text-slate-700'
              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
          }`}
        >
          <span>🚫</span> Blocked Reorders ({blockedAlerts.length})
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-500 uppercase font-medium">Critical</p>
          <p className="text-2xl font-bold text-red-700">{criticalCount}</p>
          <p className="text-xs text-red-400">Immediate action needed</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-xs text-orange-500 uppercase font-medium">High</p>
          <p className="text-2xl font-bold text-orange-700">{highCount}</p>
          <p className="text-xs text-orange-400">Order soon</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-xs text-yellow-600 uppercase font-medium">Medium</p>
          <p className="text-2xl font-bold text-yellow-700">{mediumCount}</p>
          <p className="text-xs text-yellow-500">Plan ahead</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-500 uppercase font-medium">Low</p>
          <p className="text-2xl font-bold text-emerald-700">{lowCount}</p>
          <p className="text-xs text-emerald-400">Monitor only</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase font-medium">Est. Cost</p>
          <p className="text-2xl font-bold text-slate-700">{formatCurrency(totalEstCost)}</p>
          <p className="text-xs text-slate-400">Total replenishment</p>
        </div>
      </div>

      {/* Blocked Reorders Detail */}
      {showBlocked && blockedAlerts.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🚫</span>
            <h3 className="text-lg font-bold text-slate-700">Duplicate Reorder Prevention</h3>
            <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">{blockedAlerts.length} blocked</span>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            These items already have sufficient stock. The system has prevented re-ordering to avoid extending shelf life unnecessarily.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase">
                  <th className="text-left py-2 font-medium">Item</th>
                  <th className="text-left py-2 font-medium">Material</th>
                  <th className="text-right py-2 font-medium">Current Stock</th>
                  <th className="text-right py-2 font-medium">Monthly Sales</th>
                  <th className="text-right py-2 font-medium">Days of Stock</th>
                  <th className="text-left py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {blockedAlerts.slice(0, 10).map((a) => (
                  <tr key={a.id} className="hover:bg-slate-100/50">
                    <td className="py-2 font-medium text-slate-700">{a.itemName}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getMaterialColorClass(items.find((i) => i.id === a.itemId)?.material || 'Gold')}`}>
                        {items.find((i) => i.id === a.itemId)?.material || ''}
                      </span>
                    </td>
                    <td className="py-2 text-right font-bold text-slate-700">{a.currentStock}</td>
                    <td className="py-2 text-right text-slate-500">{a.avgMonthlySales}</td>
                    <td className="py-2 text-right text-emerald-600 font-medium">{a.estimatedDaysToStockout}d</td>
                    <td className="py-2 text-xs text-slate-400 max-w-[250px] truncate">{a.blockReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Alert Priority Distribution</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="priority" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {priorityData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Reorder Items */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Top Items by Reorder Qty</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topReorderItems} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="itemName" type="category" tick={{ fontSize: 10 }} width={130} />
                <Tooltip />
                <Bar dataKey="recommendedQty" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="All">All Priorities</option>
            <option value="Critical">🔴 Critical</option>
            <option value="High">🟠 High</option>
            <option value="Medium">🟡 Medium</option>
            <option value="Low">🟢 Low</option>
          </select>
          <select value={filterMaterial} onChange={(e) => setFilterMaterial(e.target.value as Material | 'All')}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="All">All Materials</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Diamond">Diamond</option>
          </select>
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="All">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="All">All Suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Reorder Alerts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Reorder Alerts</h3>
          <span className="text-xs text-slate-400">{filtered.length} items need attention</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Priority</th>
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-left px-4 py-3 font-medium">Branch</th>
                <th className="text-left px-4 py-3 font-medium">Supplier</th>
                <th className="text-right px-4 py-3 font-medium">Stock</th>
                <th className="text-right px-4 py-3 font-medium">Min Level</th>
                <th className="text-right px-4 py-3 font-medium">Monthly Sales</th>
                <th className="text-right px-4 py-3 font-medium">Days to Stockout</th>
                <th className="text-right px-4 py-3 font-medium">Lead Time</th>
                <th className="text-right px-4 py-3 font-medium">Order Qty</th>
                <th className="text-right px-4 py-3 font-medium">Est. Cost</th>
                <th className="text-center px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 100).map((alert) => (
                <tr
                  key={alert.id}
                  className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                    selectedItem?.id === alert.id ? 'bg-amber-50' : ''
                  }`}
                  onClick={() => setSelectedItem(selectedItem?.id === alert.id ? null : alert)}
                >
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-bold px-2 py-1 rounded-full text-white"
                      style={{ backgroundColor: PRIORITY_COLORS[alert.priority] }}
                    >
                      {alert.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{ITEM_ICONS[alert.itemType] || '💎'}</span>
                      <div>
                        <p className="font-medium text-slate-700 truncate max-w-[150px]">{alert.itemName}</p>
                        <p className="text-xs text-slate-400">{alert.variety} · {alert.weightGrams}g</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{getBranchName(alert.branchId)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{getSupplierName(alert.supplierId)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{alert.currentStock}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{alert.minStockLevel}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{alert.avgMonthlySales}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${
                      alert.estimatedDaysToStockout <= alert.reorderLeadDays ? 'text-red-600' :
                      alert.estimatedDaysToStockout <= alert.reorderLeadDays * 1.5 ? 'text-orange-600' :
                      'text-emerald-600'
                    }`}>{alert.estimatedDaysToStockout}d</span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{alert.reorderLeadDays}d</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-600">{alert.recommendedQty}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(alert.estimatedCost)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(selectedItem?.id === alert.id ? null : alert);
                      }}
                      className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium transition-colors"
                    >
                      {selectedItem?.id === alert.id ? 'Hide' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-slate-400">
            <p className="text-3xl mb-2">✅</p>
            <p>All stock levels are healthy!</p>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedItem && (
        <div className="bg-white rounded-xl border-2 border-amber-300 shadow-lg overflow-hidden">
          <div className="bg-amber-50 px-6 py-4 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{ITEM_ICONS[selectedItem.itemType] || '💎'}</span>
              <div>
                <h3 className="text-lg font-bold text-slate-800">{selectedItem.itemName}</h3>
                <p className="text-sm text-slate-500">{selectedItem.variety} · {selectedItem.weightGrams}g · {getBranchName(selectedItem.branchId)}</p>
              </div>
            </div>
            <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <DetailField label="Current Stock" value={String(selectedItem.currentStock)} />
              <DetailField label="Min Stock Level" value={String(selectedItem.minStockLevel)} />
              <DetailField label="Avg Monthly Sales" value={String(selectedItem.avgMonthlySales)} />
              <DetailField label="Days to Stockout" value={`${selectedItem.estimatedDaysToStockout} days`} />
              <DetailField label="Reorder Lead Time" value={`${selectedItem.reorderLeadDays} days`} />
              <DetailField label="Supplier Delivery" value={`${selectedItem.supplierAvgDeliveryDays} days`} />
              <DetailField label="Recommended Qty" value={String(selectedItem.recommendedQty)} highlight />
              <DetailField label="Est. Reorder Cost" value={formatCurrency(selectedItem.estimatedCost)} highlight />
            </div>

            {/* Smart Recommendation */}
            <div className={`p-4 rounded-lg border ${
              selectedItem.priority === 'Critical' ? 'bg-red-50 border-red-200' :
              selectedItem.priority === 'High' ? 'bg-orange-50 border-orange-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <h4 className="font-bold text-sm mb-2">
                {selectedItem.priority === 'Critical' ? '🚨 Immediate Action Required' :
                 selectedItem.priority === 'High' ? '⚡ Order Soon' :
                 selectedItem.priority === 'Medium' ? '📋 Plan Ahead' : '📊 Monitor'}
              </h4>
              <p className="text-sm text-slate-600">
                {selectedItem.estimatedDaysToStockout <= selectedItem.reorderLeadDays
                  ? `Stock will run out in ${selectedItem.estimatedDaysToStockout} days, but supplier takes ${selectedItem.reorderLeadDays} days. ORDER ${selectedItem.recommendedQty} units NOW to prevent stockout.`
                  : `Stock will last ${selectedItem.estimatedDaysToStockout} days. Supplier needs ${selectedItem.reorderLeadDays} days. You can order ${selectedItem.recommendedQty} units within the next ${selectedItem.estimatedDaysToStockout - selectedItem.reorderLeadDays} days.`}
              </p>
            </div>

            {/* Supplier Info */}
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Supplier Information</h4>
              <p className="text-sm text-slate-600">{getSupplierName(selectedItem.supplierId)}</p>
              <p className="text-xs text-slate-400 mt-1">
                Avg delivery: {selectedItem.supplierAvgDeliveryDays} days · 
                Lead time for this item: {selectedItem.reorderLeadDays} days
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${highlight ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${highlight ? 'text-amber-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
