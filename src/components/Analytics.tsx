import React from 'react';
import type { InventoryItem, Sale, Branch, Supplier, Customer, AgeGroup, Gender, Occupation, CustomerBackground } from '../types';
import {
  formatCurrency,
  getDemandByBranch,
  getDemandByItemType,
  getFastMovers,
  getSlowMovers,
  getProfitability,
  ITEM_ICONS,
  getMaterialColorClass,
} from '../utils/analytics';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';

interface AnalyticsProps {
  items: InventoryItem[];
  sales: Sale[];
  branches: Branch[];
  suppliers: Supplier[];
  customers: Customer[];
}

const COLORS = ['#f59e0b', '#06b6d4', '#6366f1', '#ec4899', '#10b981', '#f97316', '#8b5cf6', '#ef4444', '#14b8a6'];

export default function Analytics({ items, sales, branches, suppliers, customers }: AnalyticsProps) {
  const [tab, setTab] = React.useState<'overview' | 'demand' | 'demographics' | 'movements'>('overview');

  const profitability = getProfitability(items, sales, branches, suppliers);
  const demandByBranch = getDemandByBranch(items, sales, branches);
  const demandByItemType = getDemandByItemType(items, sales);
  const fastMovers = getFastMovers(items, sales, branches);
  const slowMovers = getSlowMovers(items, branches);

  // Demographics analysis
  const demographicsData = React.useMemo(() => {
    const salesWithCust = sales.map((sale) => {
      const customer = customers.find((c) => c.id === sale.customerId);
      const item = items.find((i) => i.id === sale.itemId);
      return { ...sale, customer, item };
    }).filter((s) => s.customer && s.item);

    const byAge = new Map<AgeGroup, { count: number; revenue: number; items: Set<string> }>();
    for (const s of salesWithCust) {
      const ag = s.customer!.ageGroup;
      const existing = byAge.get(ag);
      if (existing) {
        existing.count += s.quantity;
        existing.revenue += s.salePrice * s.quantity;
        existing.items.add(s.item!.name);
      } else {
        byAge.set(ag, { count: s.quantity, revenue: s.salePrice * s.quantity, items: new Set([s.item!.name]) });
      }
    }

    const byGender = new Map<Gender, { count: number; revenue: number }>();
    for (const s of salesWithCust) {
      const g = s.customer!.gender;
      const existing = byGender.get(g);
      if (existing) { existing.count += s.quantity; existing.revenue += s.salePrice * s.quantity; }
      else { byGender.set(g, { count: s.quantity, revenue: s.salePrice * s.quantity }); }
    }

    const byOccupation = new Map<Occupation, { count: number; revenue: number }>();
    for (const s of salesWithCust) {
      const o = s.customer!.occupation;
      const existing = byOccupation.get(o);
      if (existing) { existing.count += s.quantity; existing.revenue += s.salePrice * s.quantity; }
      else { byOccupation.set(o, { count: s.quantity, revenue: s.salePrice * s.quantity }); }
    }

    const byBackground = new Map<CustomerBackground, { count: number; revenue: number }>();
    for (const s of salesWithCust) {
      const b = s.customer!.background;
      const existing = byBackground.get(b);
      if (existing) { existing.count += s.quantity; existing.revenue += s.salePrice * s.quantity; }
      else { byBackground.set(b, { count: s.quantity, revenue: s.salePrice * s.quantity }); }
    }

    const weightRanges: { range: string; count: number; revenue: number; min: number; max: number }[] = [
      { range: '1-10g', count: 0, revenue: 0, min: 0, max: 10 },
      { range: '11-25g', count: 0, revenue: 0, min: 11, max: 25 },
      { range: '26-50g', count: 0, revenue: 0, min: 26, max: 50 },
      { range: '51-80g', count: 0, revenue: 0, min: 51, max: 80 },
      { range: '80g+', count: 0, revenue: 0, min: 81, max: 9999 },
    ];
    for (const s of salesWithCust) {
      const w = s.item!.weightGrams;
      for (const wr of weightRanges) {
        if (w >= wr.min && w <= wr.max) {
          wr.count += s.quantity;
          wr.revenue += s.salePrice * s.quantity;
          break;
        }
      }
    }

    return {
      byAge: Array.from(byAge.entries()).map(([ageGroup, data]) => ({
        ageGroup,
        count: data.count,
        revenue: Math.round(data.revenue * 100) / 100,
        topItems: Array.from(data.items).slice(0, 3),
      })),
      byGender: Array.from(byGender.entries()).map(([gender, data]) => ({
        gender,
        count: data.count,
        revenue: Math.round(data.revenue * 100) / 100,
      })),
      byOccupation: Array.from(byOccupation.entries()).map(([occupation, data]) => ({
        occupation,
        count: data.count,
        revenue: Math.round(data.revenue * 100) / 100,
      })),
      byBackground: Array.from(byBackground.entries()).map(([background, data]) => ({
        background,
        count: data.count,
        revenue: Math.round(data.revenue * 100) / 100,
      })),
      byWeight: weightRanges,
    };
  }, [sales, customers, items]);

  // Monthly trend data
  const monthlyData = React.useMemo(() => {
    const monthMap = new Map<string, { revenue: number; profit: number; count: number }>();
    for (const sale of sales) {
      const month = sale.saleDate.substring(0, 7);
      const existing = monthMap.get(month);
      const profit = (sale.salePrice - sale.costPrice) * sale.quantity;
      if (existing) {
        existing.revenue += sale.salePrice * sale.quantity;
        existing.profit += profit;
        existing.count += 1;
      } else {
        monthMap.set(month, { revenue: sale.salePrice * sale.quantity, profit, count: 1 });
      }
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: Math.round(data.revenue),
        profit: Math.round(data.profit),
        count: data.count,
      }));
  }, [sales]);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: '📊' },
    { id: 'demand' as const, label: 'Demand Analysis', icon: '📈' },
    { id: 'demographics' as const, label: 'Customer Demographics', icon: '👥' },
    { id: 'movements' as const, label: 'Fast & Slow Movers', icon: '🏃' },
  ];

  const fmtTooltip = (value: unknown) => formatCurrency(Number(value));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Analytics</h2>
          <p className="text-slate-500 mt-1">Demand patterns, demographics, and movement analysis</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Monthly Revenue & Profit Trend */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Monthly Revenue & Profit Trend</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => formatCurrency(Number(v))} />
                  <Tooltip formatter={fmtTooltip} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="#f59e0b20" name="Revenue" strokeWidth={2} />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" fill="#10b98120" name="Profit" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Material Revenue Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Revenue by Material</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={profitability.materialProfitability.map((m) => ({ name: m.material, value: m.revenue }))}
                      cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {profitability.materialProfitability.map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={fmtTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Revenue by Branch</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demandByBranch}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="branchName" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => formatCurrency(Number(v))} />
                    <Tooltip formatter={fmtTooltip} />
                    <Bar dataKey="totalRevenue" fill="#f59e0b" name="Revenue" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="totalProfit" fill="#10b981" name="Profit" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Demand Tab */}
      {tab === 'demand' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Demand by Item Type & Variety</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demandByItemType.slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => formatCurrency(Number(v))} />
                  <YAxis type="category" dataKey="variety" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip formatter={fmtTooltip} />
                  <Bar dataKey="totalRevenue" fill="#6366f1" name="Revenue" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Demand by Weight Range</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demographicsData.byWeight}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Legend />
                  <Bar dataKey="count" fill="#8b5cf6" name="Units Sold" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenue" fill="#f59e0b" name="Revenue" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Demographics Tab */}
      {tab === 'demographics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Age Group */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Demand by Age Group</h3>
              <div className="space-y-3">
                {demographicsData.byAge.sort((a, b) => b.revenue - a.revenue).map((d) => (
                  <div key={d.ageGroup} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-500 w-12">{d.ageGroup}</span>
                    <div className="flex-1">
                      <div className="w-full bg-slate-100 rounded-full h-3">
                        <div
                          className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                          style={{ width: `${demographicsData.byAge.length > 0 ? (d.revenue / Math.max(...demographicsData.byAge.map(x => x.revenue))) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-slate-700 w-20 text-right">{formatCurrency(d.revenue)}</span>
                    <span className="text-xs text-slate-400 w-8 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gender */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Demand by Gender</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={demographicsData.byGender.map((d) => ({ name: d.gender, value: d.revenue }))}
                      cx="50%" cy="50%" outerRadius={70} innerRadius={35}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {demographicsData.byGender.map((_, i) => (
                        <Cell key={i} fill={COLORS[i + 3]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={fmtTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Occupation */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Demand by Occupation</h3>
              <div className="space-y-3">
                {demographicsData.byOccupation.sort((a, b) => b.revenue - a.revenue).map((d) => (
                  <div key={d.occupation} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-500 w-24 truncate">{d.occupation}</span>
                    <div className="flex-1">
                      <div className="w-full bg-slate-100 rounded-full h-3">
                        <div
                          className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                          style={{ width: `${demographicsData.byOccupation.length > 0 ? (d.revenue / Math.max(...demographicsData.byOccupation.map(x => x.revenue))) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-slate-700 w-20 text-right">{formatCurrency(d.revenue)}</span>
                    <span className="text-xs text-slate-400 w-8 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Background */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Demand by Background</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demographicsData.byBackground}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="background" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => formatCurrency(Number(v))} />
                    <Tooltip formatter={fmtTooltip} />
                    <Bar dataKey="revenue" fill="#ec4899" name="Revenue" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fast & Slow Movers Tab */}
      {tab === 'movements' && (
        <div className="space-y-6">
          {/* Fast Movers */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-emerald-50/50">
              <h3 className="text-sm font-semibold text-emerald-700 uppercase tracking-wider">🚀 Fast Moving Items (Top 15)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <th className="text-left px-4 py-2 font-medium">#</th>
                    <th className="text-left px-4 py-2 font-medium">Item</th>
                    <th className="text-left px-4 py-2 font-medium">Material</th>
                    <th className="text-left px-4 py-2 font-medium">Branch</th>
                    <th className="text-right px-4 py-2 font-medium">Avg Shelf Life</th>
                    <th className="text-right px-4 py-2 font-medium">Monthly Sales</th>
                    <th className="text-right px-4 py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fastMovers.slice(0, 15).map((item, i) => (
                    <tr key={item.itemId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span>{ITEM_ICONS[item.itemType]}</span>
                          <span className="font-medium text-slate-700">{item.itemName}</span>
                          <span className="text-xs text-slate-400">({item.variety}, {item.weightGrams}g)</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getMaterialColorClass(item.material)}`}>{item.material}</span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{item.branchName}</td>
                      <td className="px-4 py-2 text-right text-emerald-600 font-medium">{item.avgShelfLife}d</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-700">{item.monthlySales}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-700">{formatCurrency(item.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Slow Movers */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-red-50/50">
              <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wider">🐌 Slow Moving Items (Top 15)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <th className="text-left px-4 py-2 font-medium">#</th>
                    <th className="text-left px-4 py-2 font-medium">Item</th>
                    <th className="text-left px-4 py-2 font-medium">Material</th>
                    <th className="text-left px-4 py-2 font-medium">Branch</th>
                    <th className="text-right px-4 py-2 font-medium">Days in Stock</th>
                    <th className="text-right px-4 py-2 font-medium">Qty</th>
                    <th className="text-right px-4 py-2 font-medium">Cost Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {slowMovers.slice(0, 15).map((item, i) => (
                    <tr key={item.itemId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span>{ITEM_ICONS[item.itemType]}</span>
                          <span className="font-medium text-slate-700">{item.itemName}</span>
                          <span className="text-xs text-slate-400">({item.variety}, {item.weightGrams}g)</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getMaterialColorClass(item.material)}`}>{item.material}</span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{item.branchName}</td>
                      <td className="px-4 py-2 text-right text-red-600 font-bold">{item.daysInStock}d</td>
                      <td className="px-4 py-2 text-right font-medium">{item.quantity}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-700">{formatCurrency(item.costValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
