import React from 'react';
import type { InventoryItem, Supplier, Branch, Material, ItemType } from '../types';
import { formatFullCurrency, getMaterialColorClass, ITEM_ICONS } from '../utils/analytics';

interface InventoryProps {
  items: InventoryItem[];
  suppliers: Supplier[];
  branches: Branch[];
}

export default function Inventory({ items, suppliers, branches }: InventoryProps) {
  const [search, setSearch] = React.useState('');
  const [materialFilter, setMaterialFilter] = React.useState<Material | 'All'>('All');
  const [typeFilter, setTypeFilter] = React.useState<ItemType | 'All'>('All');
  const [statusFilter, setStatusFilter] = React.useState<string>('All');
  const [branchFilter, setBranchFilter] = React.useState<string>('All');
  const [sortBy, setSortBy] = React.useState<string>('receivedDate');
  const [showAddModal, setShowAddModal] = React.useState(false);

  const filtered = items
    .filter((item) => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.sku.toLowerCase().includes(search.toLowerCase())) return false;
      if (materialFilter !== 'All' && item.material !== materialFilter) return false;
      if (typeFilter !== 'All' && item.itemType !== typeFilter) return false;
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;
      if (branchFilter !== 'All' && item.branchId !== branchFilter) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'weight': return b.weightGrams - a.weightGrams;
        case 'cost': return b.costPrice - a.costPrice;
        case 'selling': return b.sellingPrice - a.sellingPrice;
        case 'receivedDate': return b.receivedDate.localeCompare(a.receivedDate);
        default: return 0;
      }
    });

  const getSupplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id;
  const getBranchName = (id: string) => branches.find((b) => b.id === id)?.name || id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventory</h2>
          <p className="text-slate-500 mt-1">{items.length} total items · {filtered.length} showing</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span>+</span> Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
          <select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value as Material | 'All')}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-white"
          >
            <option value="All">All Materials</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Diamond">Diamond</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ItemType | 'All')}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-white"
          >
            <option value="All">All Types</option>
            {['Chain', 'Bangle', 'Ring', 'Pendant', 'Bracelet', 'Necklace', 'Earring', 'Anklet', 'Nose Pin'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-white"
          >
            <option value="All">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Sold">Sold</option>
            <option value="Reserved">Reserved</option>
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-white"
          >
            <option value="All">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-white"
          >
            <option value="receivedDate">Latest First</option>
            <option value="weight">Weight (Heavy)</option>
            <option value="cost">Cost (High)</option>
            <option value="selling">Price (High)</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-left px-4 py-3 font-medium">Material</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Variety</th>
                <th className="text-right px-4 py-3 font-medium">Weight</th>
                <th className="text-left px-4 py-3 font-medium">Supplier</th>
                <th className="text-left px-4 py-3 font-medium">Branch</th>
                <th className="text-right px-4 py-3 font-medium">Cost</th>
                <th className="text-right px-4 py-3 font-medium">Price</th>
                <th className="text-center px-4 py-3 font-medium">Qty</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 100).map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{ITEM_ICONS[item.itemType] || '💎'}</span>
                      <div>
                        <p className="font-medium text-slate-700 truncate max-w-[150px]">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getMaterialColorClass(item.material)}`}>
                      {item.material}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.itemType}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[120px] truncate" title={item.variety}>{item.variety}</td>
                  <td className="px-4 py-3 text-right text-slate-600 font-medium">{item.weightGrams}g</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[120px] truncate" title={getSupplierName(item.supplierId)}>{getSupplierName(item.supplierId)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[100px] truncate" title={getBranchName(item.branchId)}>{getBranchName(item.branchId)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatFullCurrency(item.costPrice)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{formatFullCurrency(item.sellingPrice)}</td>
                  <td className="px-4 py-3 text-center font-medium text-slate-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{item.receivedDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-center text-sm text-slate-500">
            Showing first 100 of {filtered.length} items. Use filters to narrow down.
          </div>
        )}
        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-slate-400">
            <p className="text-2xl mb-2">🔍</p>
            <p>No items match your filters</p>
          </div>
        )}
      </div>

      {/* Add Item Modal Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900">Add New Inventory Item</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <p className="text-slate-500 mb-6">Fill in the details to add a new jewelry item to the inventory.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Name</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" placeholder="e.g., Gold Chain" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Material</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option>Gold</option><option>Silver</option><option>Diamond</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Type</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                  {['Chain', 'Bangle', 'Ring', 'Pendant', 'Bracelet', 'Necklace', 'Earring'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Variety</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g., Machine Cut" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Weight (grams)</label>
                <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g., 8" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purity</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g., 22K" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cost Price (₹)</label>
                <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g., 50000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (₹)</label>
                <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g., 58000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g., 5" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock Level</label>
                <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g., 2" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'In Stock': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Sold': 'bg-blue-50 text-blue-700 border-blue-200',
    'Reserved': 'bg-amber-50 text-amber-700 border-amber-200',
    'Returned': 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {status}
    </span>
  );
}
