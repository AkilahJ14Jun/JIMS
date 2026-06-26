import React from 'react';
import type { InventoryItem, Supplier, Branch, Material, ItemType } from '../types';
import { calculateShelfLives, getMaterialColorClass } from '../utils/analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#f59e0b', '#06b6d4', '#6366f1', '#ec4899', '#10b981', '#f97316', '#8b5cf6'];

interface ShelfLifeProps {
  items: InventoryItem[];
  suppliers: Supplier[];
  branches: Branch[];
}

export default function ShelfLifePage({ items, suppliers, branches }: ShelfLifeProps) {
  const [filterMaterial, setFilterMaterial] = React.useState<Material | 'All'>('All');
  const [filterType, setFilterType] = React.useState<ItemType | 'All'>('All');
  const [filterBranch, setFilterBranch] = React.useState<string>('All');
  const [filterSupplier, setFilterSupplier] = React.useState<string>('All');
  const [filterStatus, setFilterStatus] = React.useState<'All' | 'In Stock' | 'Sold'>('All');
  const [sortBy, setSortBy] = React.useState<'daysDesc' | 'daysAsc' | 'weight'>('daysDesc');

  const shelfLives = React.useMemo(() => calculateShelfLives(items), [items]);

  const getBranchName = (id: string) => branches.find((b) => b.id === id)?.name || id;
  const getSupplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id;

  const filtered = React.useMemo(() => {
    return shelfLives
      .filter((sl) => {
        if (filterMaterial !== 'All' && sl.material !== filterMaterial) return false;
        if (filterType !== 'All' && sl.itemType !== filterType) return false;
        if (filterBranch !== 'All' && sl.branchId !== filterBranch) return false;
        if (filterSupplier !== 'All' && sl.supplierId !== filterSupplier) return false;
        if (filterStatus !== 'All' && sl.status !== filterStatus) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'daysDesc') return b.daysInStock - a.daysInStock;
        if (sortBy === 'daysAsc') return a.daysInStock - b.daysInStock;
        return b.weightGrams - a.weightGrams;
      });
  }, [shelfLives, filterMaterial, filterType, filterBranch, filterSupplier, filterStatus, sortBy]);

  // Stats
  const inStock = filtered.filter((s) => s.status === 'In Stock');
  const sold = filtered.filter((s) => s.status === 'Sold');
  const avgShelfLifeAll = filtered.length > 0
    ? Math.round(filtered.reduce((sum, s) => sum + s.daysInStock, 0) / filtered.length)
    : 0;
  const avgShelfLifeSold = sold.length > 0
    ? Math.round(sold.reduce((sum, s) => sum + s.daysInStock, 0) / sold.length)
    : 0;
  // Stuck items (> 60 days in stock)
  const stuckItems = inStock.filter((s) => s.daysInStock > 60);

  // Shelf life distribution
  const shelfLifeBuckets = [
    { range: '0-7 days', min: 0, max: 7, count: 0 },
    { range: '8-14 days', min: 8, max: 14, count: 0 },
    { range: '15-30 days', min: 15, max: 30, count: 0 },
    { range: '31-60 days', min: 31, max: 60, count: 0 },
    { range: '61-90 days', min: 61, max: 90, count: 0 },
    { range: '90+ days', min: 91, max: 9999, count: 0 },
  ];
  for (const sl of filtered) {
    for (const bucket of shelfLifeBuckets) {
      if (sl.daysInStock >= bucket.min && sl.daysInStock <= bucket.max) {
        bucket.count++;
        break;
      }
    }
  }

  // By branch average shelf life
  const branchAvgShelf = branches.map((branch) => {
    const branchItems = filtered.filter((sl) => sl.branchId === branch.id);
    const avg = branchItems.length > 0
      ? Math.round(branchItems.reduce((s, sl) => s + sl.daysInStock, 0) / branchItems.length)
      : 0;
    return { name: branch.city, avg, count: branchItems.length };
  });

  // By supplier average shelf life
  const supplierAvgShelf = suppliers.map((sup) => {
    const supItems = filtered.filter((sl) => sl.supplierId === sup.id);
    const avg = supItems.length > 0
      ? Math.round(supItems.reduce((s, sl) => s + sl.daysInStock, 0) / supItems.length)
      : 0;
    return { name: sup.name, avg, count: supItems.length };
  });

  // By item type average shelf life
  const typeAvgShelf = Array.from(new Set(items.map((i) => i.itemType))).map((type) => {
    const typeItems = filtered.filter((sl) => sl.itemType === type);
    const avg = typeItems.length > 0
      ? Math.round(typeItems.reduce((s, sl) => s + sl.daysInStock, 0) / typeItems.length)
      : 0;
    return { name: type, avg, count: typeItems.length };
  }).sort((a, b) => a.avg - b.avg);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Shelf Life Analysis</h2>
        <p className="text-slate-500 mt-1">Track how long items stay in stock before being sold across all branches</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-xl">📦</div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Avg Shelf Life (All)</p>
              <p className="text-2xl font-bold text-slate-800">{avgShelfLifeAll} days</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-xl">✅</div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Avg Shelf Life (Sold)</p>
              <p className="text-2xl font-bold text-emerald-600">{avgShelfLifeSold} days</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-xl">🏷️</div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Currently In Stock</p>
              <p className="text-2xl font-bold text-blue-600">{inStock.length} items</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-xl">⚠️</div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Stuck Items (60+ days)</p>
              <p className="text-2xl font-bold text-red-600">{stuckItems.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shelf Life Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Shelf Life Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shelfLifeBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {shelfLifeBuckets.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Avg Shelf Life by Branch */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Avg Shelf Life by Branch (days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchAvgShelf}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown) => [`${v} days`, 'Avg Shelf Life']} />
                <Bar dataKey="avg" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Avg Shelf Life by Item Type */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Avg Shelf Life by Item Type (days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeAvgShelf} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v: unknown) => [`${v} days`, 'Avg Shelf Life']} />
                <Bar dataKey="avg" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Supplier */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Avg Shelf Life by Supplier (days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplierAvgShelf}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown) => [`${v} days`, 'Avg Shelf Life']} />
                <Bar dataKey="avg" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stuck Items Alert */}
      {stuckItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🚨</span>
            <h3 className="text-lg font-bold text-red-700">Stuck Inventory Alert</h3>
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">{stuckItems.length} items</span>
          </div>
          <p className="text-sm text-red-600 mb-4">These items have been in stock for over 60 days. Consider transferring to other branches or discounting.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-red-500 text-xs uppercase">
                  <th className="text-left py-2 font-medium">Item</th>
                  <th className="text-left py-2 font-medium">Material</th>
                  <th className="text-left py-2 font-medium">Type</th>
                  <th className="text-right py-2 font-medium">Weight</th>
                  <th className="text-left py-2 font-medium">Branch</th>
                  <th className="text-left py-2 font-medium">Supplier</th>
                  <th className="text-right py-2 font-medium">Days in Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {stuckItems.slice(0, 15).map((sl) => (
                  <tr key={sl.itemId} className="hover:bg-red-100/50">
                    <td className="py-2 font-medium text-red-800">{sl.itemName}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getMaterialColorClass(sl.material)}`}>{sl.material}</span>
                    </td>
                    <td className="py-2 text-red-700">{sl.itemType}</td>
                    <td className="py-2 text-right text-red-700">{sl.weightGrams}g</td>
                    <td className="py-2 text-red-600 text-xs">{getBranchName(sl.branchId)}</td>
                    <td className="py-2 text-red-600 text-xs">{getSupplierName(sl.supplierId)}</td>
                    <td className="py-2 text-right font-bold text-red-700">{sl.daysInStock}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Filter Shelf Life Records</h3>
        <div className="flex flex-wrap gap-3">
          <select value={filterMaterial} onChange={(e) => setFilterMaterial(e.target.value as Material | 'All')}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="All">All Materials</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Diamond">Diamond</option>
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as ItemType | 'All')}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="All">All Types</option>
            {['Chain', 'Bangle', 'Ring', 'Pendant', 'Bracelet', 'Necklace', 'Earring', 'Anklet', 'Nose Pin'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
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
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'All' | 'In Stock' | 'Sold')}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="All">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Sold">Sold</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="daysDesc">Days (Highest)</option>
            <option value="daysAsc">Days (Lowest)</option>
            <option value="weight">Weight (Heavy)</option>
          </select>
        </div>
      </div>

      {/* Shelf Life Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Shelf Life Records</h3>
          <span className="text-xs text-slate-400">{filtered.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-left px-4 py-3 font-medium">Material</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Variety</th>
                <th className="text-right px-4 py-3 font-medium">Weight</th>
                <th className="text-left px-4 py-3 font-medium">Branch</th>
                <th className="text-left px-4 py-3 font-medium">Supplier</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Received</th>
                <th className="text-left px-4 py-3 font-medium">Sold</th>
                <th className="text-right px-4 py-3 font-medium">Days in Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 100).map((sl) => (
                <tr key={sl.itemId} className="hover:bg-slate-50/80">
                  <td className="px-4 py-2.5 font-medium text-slate-700 truncate max-w-[160px]">{sl.itemName}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getMaterialColorClass(sl.material)}`}>{sl.material}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{sl.itemType}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{sl.variety}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-600">{sl.weightGrams}g</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{getBranchName(sl.branchId)}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{getSupplierName(sl.supplierId)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      sl.status === 'Sold' ? 'bg-emerald-100 text-emerald-700' :
                      sl.status === 'In Stock' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{sl.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{sl.receivedDate}</td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{sl.soldDate || '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-bold ${
                      sl.daysInStock > 60 ? 'text-red-600' :
                      sl.daysInStock > 30 ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>{sl.daysInStock}d</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="px-4 py-3 bg-slate-50 border-t text-center text-sm text-slate-500">
            Showing first 100 of {filtered.length} records
          </div>
        )}
      </div>
    </div>
  );
}
