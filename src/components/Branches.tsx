import React from 'react';
import type { Branch, InventoryItem, Supplier, Sale, ItemType } from '../types';
import { formatCurrency, formatFullCurrency, getMaterialColorClass, ITEM_ICONS } from '../utils/analytics';

interface BranchesProps {
  branches: Branch[];
  items: InventoryItem[];
  suppliers: Supplier[];
  sales: Sale[];
}

export default function Branches({ branches, items, suppliers, sales }: BranchesProps) {
  const [selectedBranch, setSelectedBranch] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'overview' | 'inventory'>('overview');

  const branchStats = branches.map((branch) => {
    const branchItems = items.filter((i) => i.branchId === branch.id);
    const branchItemIds = new Set(branchItems.map((i) => i.id));
    const branchSales = sales.filter((s) => branchItemIds.has(s.itemId));
    const inStock = branchItems.filter((i) => i.status === 'In Stock');
    const sold = branchItems.filter((i) => i.status === 'Sold');
    const reserved = branchItems.filter((i) => i.status === 'Reserved');

    const revenue = branchSales.reduce((s, sale) => s + sale.salePrice * sale.quantity, 0);
    const cost = branchSales.reduce((s, sale) => s + sale.costPrice * sale.quantity, 0);
    const stockValue = inStock.reduce((s, i) => s + i.costPrice * i.quantity, 0);

    // Top selling item types
    const typeCount = new Map<string, number>();
    for (const sale of branchSales) {
      const item = branchItems.find((i) => i.id === sale.itemId);
      if (item) typeCount.set(item.itemType, (typeCount.get(item.itemType) || 0) + sale.quantity);
    }
    const topTypes = Array.from(typeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      branch,
      totalItems: branchItems.length,
      inStock: inStock.length,
      sold: sold.length,
      reserved: reserved.length,
      revenue,
      profit: revenue - cost,
      margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
      stockValue,
      topTypes,
      uniqueSuppliers: new Set(branchItems.map((i) => i.supplierId)).size,
    };
  });

  const selected = selectedBranch ? branches.find((b) => b.id === selectedBranch) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Branches</h2>
        <p className="text-slate-500 mt-1">Multi-branch inventory overview and performance</p>
      </div>

      {/* Branch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branchStats.map(({ branch, inStock, sold, revenue, profit, margin, topTypes: _topTypes, uniqueSuppliers }) => (
          <button
            key={branch.id}
            onClick={() => {
              setSelectedBranch(selectedBranch === branch.id ? null : branch.id);
              setViewMode('overview');
            }}
            className={`text-left p-5 rounded-xl border transition-all duration-200 ${
              selectedBranch === branch.id
                ? 'border-amber-400 bg-amber-50 shadow-md ring-1 ring-amber-400/20'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-slate-800">{branch.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{branch.city}, {branch.state}</p>
              </div>
              <span className="text-xs font-medium text-slate-400">{branch.id}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-slate-800">{inStock}</p>
                <p className="text-[10px] text-slate-400 uppercase">In Stock</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-emerald-600">{sold}</p>
                <p className="text-[10px] text-slate-400 uppercase">Sold</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-sm font-bold text-slate-700">{formatCurrency(revenue)}</p>
                <p className="text-[10px] text-slate-400 uppercase">Revenue</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className={`text-sm font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(profit)}</p>
                <p className="text-[10px] text-slate-400 uppercase">Profit</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
              <span>{uniqueSuppliers} suppliers</span>
              <span>{margin.toFixed(1)}% margin</span>
            </div>
          </button>
        ))}
      </div>

      {/* Branch Detail */}
      {selected && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{selected.name}</h3>
              <p className="text-sm text-slate-500">{selected.address} · {selected.phone}</p>
              <p className="text-xs text-slate-400">Manager: {selected.manager} · Target: {formatFullCurrency(selected.monthlyTarget)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('overview')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  viewMode === 'overview' ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setViewMode('inventory')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  viewMode === 'inventory' ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Inventory ({items.filter((i) => i.branchId === selected.id).length} items)
              </button>
            </div>
          </div>

          {viewMode === 'overview' ? (
            <div className="p-6">
              {/* Top Item Types */}
              <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Top Selling Item Types</h4>
              <div className="flex flex-wrap gap-2 mb-6">
                {branchStats.find((s) => s.branch.id === selected.id)?.topTypes.map(([type, count]) => (
                  <span key={type} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span>{ITEM_ICONS[type as ItemType] || '💎'}</span>
                    <span className="font-medium text-slate-700">{type}</span>
                    <span className="text-slate-400">({count})</span>
                  </span>
                ))}
              </div>

              {/* Inventory by Material */}
              <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Stock by Material</h4>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {(['Gold', 'Silver', 'Diamond'] as const).map((mat) => {
                  const matItems = items.filter((i) => i.branchId === selected.id && i.material === mat);
                  const inStock = matItems.filter((i) => i.status === 'In Stock').length;
                  const value = matItems.filter((i) => i.status === 'In Stock').reduce((s, i) => s + i.costPrice * i.quantity, 0);
                  return (
                    <div key={mat} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getMaterialColorClass(mat)}`}>{mat}</span>
                      <p className="text-xl font-bold text-slate-800 mt-2">{inStock}</p>
                      <p className="text-xs text-slate-400">{matItems.length} total · {formatCurrency(value)} value</p>
                    </div>
                  );
                })}
              </div>

              {/* Suppliers for this branch */}
              <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Suppliers</h4>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const branchSupIds = new Set(items.filter((i) => i.branchId === selected.id).map((i) => i.supplierId));
                  return Array.from(branchSupIds).map((supId) => {
                    const sup = suppliers.find((s) => s.id === supId);
                    if (!sup) return null;
                    const supItems = items.filter((i) => i.branchId === selected.id && i.supplierId === supId);
                    return (
                      <div key={supId} className="p-3 bg-slate-50 rounded-lg border border-slate-100 min-w-[180px]">
                        <p className="text-sm font-medium text-slate-700">{sup.name}</p>
                        <p className="text-xs text-slate-400">{sup.location}</p>
                        <p className="text-xs text-slate-400 mt-1">{supItems.length} items · {sup.avgDeliveryDays}d delivery</p>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                      <th className="text-left px-3 py-2 font-medium">Item</th>
                      <th className="text-left px-3 py-2 font-medium">Material</th>
                      <th className="text-left px-3 py-2 font-medium">Type</th>
                      <th className="text-left px-3 py-2 font-medium">Variety</th>
                      <th className="text-right px-3 py-2 font-medium">Weight</th>
                      <th className="text-right px-3 py-2 font-medium">Qty</th>
                      <th className="text-center px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">Supplier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items
                      .filter((i) => i.branchId === selected.id)
                      .slice(0, 50)
                      .map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span>{ITEM_ICONS[item.itemType]}</span>
                              <span className="font-medium text-slate-700 truncate max-w-[120px]">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${getMaterialColorClass(item.material)}`}>{item.material}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-500">{item.itemType}</td>
                          <td className="px-3 py-2 text-slate-400 text-xs max-w-[100px] truncate">{item.variety}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{item.weightGrams}g</td>
                          <td className="px-3 py-2 text-right font-medium">{item.quantity}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              item.status === 'In Stock' ? 'bg-emerald-50 text-emerald-600' :
                              item.status === 'Sold' ? 'bg-blue-50 text-blue-600' :
                              'bg-amber-50 text-amber-600'
                            }`}>{item.status}</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-400 truncate max-w-[100px]">
                            {suppliers.find((s) => s.id === item.supplierId)?.name}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
