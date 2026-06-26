import React from 'react';
import type { Supplier, InventoryItem, Sale, Branch } from '../types';
import { formatCurrency } from '../utils/analytics';

interface SuppliersProps {
  suppliers: Supplier[];
  items: InventoryItem[];
  sales: Sale[];
  branches: Branch[];
}

export default function Suppliers({ suppliers, items, sales, branches }: SuppliersProps) {
  const [selectedSupplier, setSelectedSupplier] = React.useState<string | null>(null);

  const getSupplierStats = (sup: Supplier) => {
    const supItems = items.filter((i) => i.supplierId === sup.id);
    const supItemIds = new Set(supItems.map((i) => i.id));
    const supSales = sales.filter((s) => supItemIds.has(s.itemId));
    const totalRevenue = supSales.reduce((s, sale) => s + sale.salePrice * sale.quantity, 0);
    const totalCost = supSales.reduce((s, sale) => s + sale.costPrice * sale.quantity, 0);
    const inStock = supItems.filter((i) => i.status === 'In Stock').length;
    const sold = supItems.filter((i) => i.status === 'Sold').length;

    const branchesUsed = new Set(supItems.map((i) => i.branchId));

    return {
      totalItems: supItems.length,
      inStock,
      sold,
      revenue: totalRevenue,
      profit: totalRevenue - totalCost,
      margin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      branchesUsed: branchesUsed.size,
      branchNames: Array.from(branchesUsed).map((id) => branches.find((b) => b.id === id)?.name || id),
    };
  };

  const selected = selectedSupplier ? suppliers.find((s) => s.id === selectedSupplier) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Suppliers</h2>
        <p className="text-slate-500 mt-1">{suppliers.length} suppliers managing your inventory</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Supplier Cards */}
        <div className="lg:col-span-1 space-y-3">
          {suppliers.map((sup) => {
            const stats = getSupplierStats(sup);
            const isSelected = selectedSupplier === sup.id;
            return (
              <button
                key={sup.id}
                onClick={() => setSelectedSupplier(isSelected ? null : sup.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                  isSelected
                    ? 'border-amber-400 bg-amber-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-slate-800 text-sm">{sup.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sup.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {sup.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-slate-800">{stats.totalItems}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Items</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">{stats.inStock}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Stock</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-600">{stats.sold}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Sold</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-400">📍 {sup.location}</span>
                  <span className="text-xs text-slate-500 font-medium">{formatCurrency(stats.revenue)}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Supplier Detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{selected.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{selected.location}, {selected.state}</p>
                  </div>
                  <span className="text-xs text-slate-400">{selected.id}</span>
                </div>
              </div>
              <div className="p-6">
                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <ContactField label="Contact Person" value={selected.contactPerson} />
                  <ContactField label="Phone" value={selected.phone} />
                  <ContactField label="Email" value={selected.email} />
                  <ContactField label="GST" value={selected.gstNumber} />
                  <ContactField label="Avg Delivery" value={`${selected.avgDeliveryDays} days`} />
                  <ContactField label="Reliability" value={`${selected.reliabilityScore}/10`} />
                </div>

                {/* Materials & Item Types */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {selected.materials.map((m) => (
                    <span key={m} className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                      {m}
                    </span>
                  ))}
                  {selected.itemTypes.map((t) => (
                    <span key={t} className="text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                      {t}
                    </span>
                  ))}
                </div>

                {/* Inventory by Branch */}
                <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Inventory by Branch</h4>
                <div className="grid grid-cols-2 gap-3">
                  {getSupplierStats(selected).branchNames.map((branchName) => {
                    const branchId = branches.find((b) => b.name === branchName)?.id || '';
                    const branchItems = items.filter((i) => i.supplierId === selected.id && i.branchId === branchId);
                    const branchStock = branchItems.filter((i) => i.status === 'In Stock').length;
                    const branchSold = branchItems.filter((i) => i.status === 'Sold').length;
                    const stockValue = branchItems.filter((i) => i.status === 'In Stock').reduce((s, i) => s + i.costPrice * i.quantity, 0);

                    return (
                      <div key={branchName} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-sm font-medium text-slate-700">{branchName}</p>
                        <div className="flex gap-4 mt-2">
                          <span className="text-xs text-emerald-600">{branchStock} in stock</span>
                          <span className="text-xs text-blue-600">{branchSold} sold</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Value: {formatCurrency(stockValue)}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Item Summary */}
                <h4 className="text-sm font-semibold text-slate-700 mb-3 mt-6 uppercase tracking-wider">Item Categories Supplied</h4>
                <div className="grid grid-cols-3 gap-3">
                  {selected.itemTypes.map((itemType) => {
                    const catItems = items.filter((i) => i.supplierId === selected.id && i.itemType === itemType);
                    const sold = catItems.filter((i) => i.status === 'Sold').length;
                    return (
                      <div key={itemType} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
                        <p className="text-sm font-semibold text-slate-700">{itemType}</p>
                        <p className="text-lg font-bold text-slate-800 mt-1">{catItems.length}</p>
                        <p className="text-xs text-slate-400">{sold} sold</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-400">
              <p className="text-4xl mb-3">👆</p>
              <p className="text-sm">Select a supplier to view detailed information</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-slate-700 mt-0.5">{value}</p>
    </div>
  );
}
