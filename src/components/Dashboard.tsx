import type { InventoryItem, Supplier, Branch, Sale, ProfitabilitySummary } from '../types';
import { formatCurrency, formatFullCurrency, getMaterialColorClass, ITEM_ICONS } from '../utils/analytics';

interface DashboardProps {
  items: InventoryItem[];
  suppliers: Supplier[];
  branches: Branch[];
  sales: Sale[];
  profitability: ProfitabilitySummary;
  reorderCount: number;
}

export default function Dashboard({
  items,
  suppliers,
  branches,
  sales,
  profitability,
  reorderCount,
}: DashboardProps) {
  const inStock = items.filter((i) => i.status === 'In Stock');
  const sold = items.filter((i) => i.status === 'Sold');
  const totalStockValue = inStock.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);
  const avgShelfLife = profitability.avgShelfLife;

  // Recent sales
  const recentSales = sales
    .sort((a, b) => b.saleDate.localeCompare(a.saleDate))
    .slice(0, 8)
    .map((sale) => {
      const item = items.find((i) => i.id === sale.itemId);
      const branch = branches.find((b) => b.id === sale.branchId);
      return { ...sale, item, branch };
    });

  // Top branches by revenue
  const topBranches = profitability.branchProfitability.sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Low stock count
  const lowStockCount = inStock.filter((i) => i.quantity <= i.minStockLevel).length;

  // Critical alerts
  const criticalAlerts = reorderCount > 0 ? Math.min(reorderCount, 12) : 0;

  // Items by material
  const materialBreakdown = profitability.materialProfitability;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 mt-1">Overview of your jewelry inventory across all branches</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(profitability.totalRevenue)}
          subtitle={`${sales.length} total sales`}
          icon="💰"
          accent="from-emerald-500 to-emerald-600"
        />
        <KPICard
          title="Net Profit"
          value={formatCurrency(profitability.totalProfit)}
          subtitle={`${profitability.profitMargin}% margin`}
          icon="📈"
          accent="from-blue-500 to-blue-600"
        />
        <KPICard
          title="Stock in Hand"
          value={inStock.length.toString()}
          subtitle={`${formatCurrency(totalStockValue)} value · ${totalStockValue > 0 ? `${inStock.reduce((s, i) => s + i.quantity, 0)} pieces` : '0 pieces'}`}
          icon="📦"
          accent="from-amber-500 to-amber-600"
        />
        <KPICard
          title="Avg Shelf Life"
          value={`${avgShelfLife}d`}
          subtitle={`Low stock: ${lowStockCount} · Critical: ${criticalAlerts}`}
          icon="⏱️"
          accent="from-purple-500 to-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Material Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Material Breakdown</h3>
          <div className="space-y-4">
            {materialBreakdown.map((mat) => (
              <div key={mat.material}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getMaterialColorClass(mat.material)}`}>
                    {mat.material}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{formatCurrency(mat.revenue)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${profitability.totalRevenue > 0 ? (mat.revenue / profitability.totalRevenue) * 100 : 0}%`,
                      backgroundColor:
                        mat.material === 'Gold'
                          ? '#f59e0b'
                          : mat.material === 'Silver'
                            ? '#94a3b8'
                            : '#06b6d4',
                    }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">{mat.margin}% margin</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Branches */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Top Branches by Revenue</h3>
          <div className="space-y-3">
            {topBranches.map((b, i) => (
              <div key={b.branchId} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{b.branchName}</p>
                  <p className="text-xs text-slate-400">{b.margin}% margin</p>
                </div>
                <span className="text-sm font-semibold text-slate-800">{formatCurrency(b.revenue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Suppliers" value={suppliers.filter((s) => s.isActive).length} />
            <StatCard label="Branches" value={branches.length} />
            <StatCard label="Total Items" value={items.length} />
            <StatCard label="Items Sold" value={sold.length} />
            <StatCard label="In Stock" value={inStock.length} />
            <StatCard label="Low Stock" value={lowStockCount} alert />
            <StatCard label="Avg Shelf Life" value={`${avgShelfLife}d`} />
            <StatCard label="Reorder Alerts" value={reorderCount} alert />
          </div>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Recent Sales</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left px-5 py-3 font-medium">Item</th>
                <th className="text-left px-5 py-3 font-medium">Material</th>
                <th className="text-left px-5 py-3 font-medium">Branch</th>
                <th className="text-right px-5 py-3 font-medium">Price</th>
                <th className="text-right px-5 py-3 font-medium">Profit</th>
                <th className="text-right px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentSales.map((sale) => {
                const profit = sale.salePrice - sale.costPrice;
                return (
                  <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{sale.item ? ITEM_ICONS[sale.item.itemType] || '💎' : '💎'}</span>
                        <span className="font-medium text-slate-700 truncate max-w-[200px]">
                          {sale.item?.name || sale.itemId}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {sale.item && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getMaterialColorClass(sale.item.material)}`}>
                          {sale.item.material}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{sale.branch?.name || sale.branchId}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700">{formatFullCurrency(sale.salePrice)}</td>
                    <td className="px-5 py-3 text-right font-medium text-emerald-600">+{formatFullCurrency(profit)}</td>
                    <td className="px-5 py-3 text-right text-slate-400">{sale.saleDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, subtitle, icon, accent }: {
  title: string; value: string; subtitle: string; icon: string; accent: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${accent} flex items-center justify-center text-lg shadow-sm`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${alert ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${alert ? 'text-red-600' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
