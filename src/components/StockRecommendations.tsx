import React from 'react';
import type { InventoryItem, Sale, Branch, Supplier } from '../types';
import type { StockViewMode, CSVSaleRecord } from '../types/stockRecommendations';
import { generateStockRecommendations, parseCSV, CSV_TEMPLATE, CSV_HEADERS_EXPLANATION } from '../utils/stockRecommendations';

interface StockRecommendationsProps {
  items: InventoryItem[];
  sales: Sale[];
  branches: Branch[];
  suppliers: Supplier[];
}

const VELOCITY_COLORS: Record<string, string> = {
  'Very Fast': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Fast': 'bg-green-100 text-green-700 border-green-200',
  'Moderate': 'bg-blue-100 text-blue-700 border-blue-200',
  'Slow': 'bg-amber-100 text-amber-700 border-amber-200',
  'Very Slow': 'bg-red-100 text-red-700 border-red-200',
};

const TREND_ICONS: Record<string, string> = {
  'Increasing': '📈',
  'Stable': '➡️',
  'Decreasing': '📉',
};

const MATERIAL_BADGE: Record<string, string> = {
  Gold: 'bg-amber-100 text-amber-800 border-amber-200',
  Silver: 'bg-slate-100 text-slate-700 border-slate-200',
  Diamond: 'bg-cyan-100 text-cyan-800 border-cyan-200',
};

function fmt(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

const ITEM_ICONS: Record<string, string> = {
  Chain: '🔗', Bangle: '⭕', Ring: '💍', Pendant: '📿',
  Bracelet: '✨', Necklace: '📿', Earring: '💎', Anklet: '🦶', 'Nose Pin': '👃',
};

export default function StockRecommendations({ items, sales, branches, suppliers }: StockRecommendationsProps) {
  const [csvText, setCsvText] = React.useState('');
  const [csvRecords, setCsvRecords] = React.useState<CSVSaleRecord[]>([]);
  const [csvErrors, setCsvErrors] = React.useState<string[]>([]);
  const [csvUploaded, setCsvUploaded] = React.useState(false);
  const [showCsvModal, setShowCsvModal] = React.useState(false);
  const [showImportGuide, setShowImportGuide] = React.useState(false);
  const [view, setView] = React.useState<StockViewMode>({ mode: 'summary' });
  const [materialFilter, setMaterialFilter] = React.useState<string>('All');
  const [branchFilter, setBranchFilter] = React.useState<string>('All');
  const [sortBy, setSortBy] = React.useState<string>('recommendedStock');
  const [searchText, setSearchText] = React.useState('');


  const { recommendations, categorySummaries, branchSummaries, csvSalesCount, totalUniqueSKUs, totalProjectedInvestment, totalProjectedRevenue } =
    React.useMemo(
      () => generateStockRecommendations(items, sales, branches, suppliers, csvRecords.length > 0 ? csvRecords : undefined),
      [items, sales, branches, suppliers, csvRecords]
    );

  const filteredRecs = React.useMemo(() => {
    let recs = recommendations;
    if (materialFilter !== 'All') recs = recs.filter((r) => r.material === materialFilter);
    if (branchFilter !== 'All') recs = recs.filter((r) => r.branchId === branchFilter);
    if (searchText) {
      const s = searchText.toLowerCase();
      recs = recs.filter(
        (r) =>
          r.itemType.toLowerCase().includes(s) ||
          r.variety.toLowerCase().includes(s) ||
          r.design.toLowerCase().includes(s)
      );
    }
    if (view.material && view.material !== 'All') recs = recs.filter((r) => r.material === view.material);
    if (view.category) recs = recs.filter((r) => r.itemType === view.category);
    if (view.branchId) recs = recs.filter((r) => r.branchId === view.branchId);

    return [...recs].sort((a, b) => {
      switch (sortBy) {
        case 'recommendedStock': return b.recommendedStock - a.recommendedStock;
        case 'avgMonthlySales': return b.avgMonthlySales - a.avgMonthlySales;
        case 'totalInvestment': return b.totalInvestment - a.totalInvestment;
        case 'projectedMonthlyRevenue': return b.projectedMonthlyRevenue - a.projectedMonthlyRevenue;
        case 'confidence': return b.confidenceScore - a.confidenceScore;
        case 'currentStock': return a.currentStock - b.currentStock; // low stock first
        default: return 0;
      }
    });
  }, [recommendations, materialFilter, branchFilter, searchText, view, sortBy]);

  const handleCsvUpload = (text: string) => {
    const { records, errors } = parseCSV(text);
    setCsvRecords(records);
    setCsvErrors(errors);
    setCsvUploaded(records.length > 0);
    setCsvText(text);
    setShowCsvModal(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      handleCsvUpload(text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Stock Recommendations</h2>
          <p className="text-slate-500 mt-1">
            AI-suggested optimal stock levels based on {csvUploaded ? `${csvSalesCount} CSV + mock` : 'historical'} sales data
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportGuide(!showImportGuide)}
            className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
          >
            <span>📋</span> CSV Format Guide
          </button>
          <button
            onClick={() => setShowCsvModal(true)}
            className="px-3 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-1.5"
          >
            <span>📤</span> Upload Sales CSV
          </button>
        </div>
      </div>

      {/* CSV Import Guide */}
      {showImportGuide && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-blue-800 mb-3">📋 How to Share Your Sales Data via CSV</h3>
          <p className="text-sm text-blue-700 mb-4">
            Create a CSV file (from Excel, Google Sheets, or your billing system) with the following columns:
          </p>
          <div className="bg-white rounded-lg border border-blue-100 overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-100">
                  <th className="text-left px-3 py-2 text-blue-800 text-xs font-medium">Column</th>
                  <th className="text-left px-3 py-2 text-blue-800 text-xs font-medium">Example</th>
                  <th className="text-left px-3 py-2 text-blue-800 text-xs font-medium">Description</th>
                  <th className="text-center px-3 py-2 text-blue-800 text-xs font-medium">Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {CSV_HEADERS_EXPLANATION.map((col) => (
                  <tr key={col.header} className="hover:bg-blue-50/50">
                    <td className="px-3 py-1.5 font-mono text-xs text-blue-900 font-medium">{col.header}</td>
                    <td className="px-3 py-1.5 text-xs text-blue-600">{col.example}</td>
                    <td className="px-3 py-1.5 text-xs text-blue-500">{col.desc}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${col.required ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {col.required ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { navigator.clipboard?.writeText(CSV_TEMPLATE); }}
              className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              📋 Copy Sample CSV
            </button>
            <button
              onClick={() => {
                const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'sales_data_template.csv';
                a.click();
              }}
              className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              ⬇️ Download Template
            </button>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCsvModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">Upload Sales Data (CSV)</h3>
              <button onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Paste your CSV data below or upload a file. The system will analyze past sales to generate optimal stock recommendations.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Upload CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Or paste CSV data</label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={8}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                placeholder={`date,item_type,variety,material,weight_grams,quantity,unit_price,branch\n2024-01-15,Bangle,Kundan,Gold,20,2,85000,Chennai\n...`}
              />
            </div>
            {csvErrors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700 mb-1">⚠️ {csvErrors.length} parse error(s):</p>
                <ul className="text-xs text-red-600 list-disc list-inside">
                  {csvErrors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCsvModal(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => handleCsvUpload(csvText)}
                className="px-6 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
              >
                Analyze & Generate Recommendations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Unique SKUs to Stock" value={totalUniqueSKUs.toString()} subtitle="Based on sales patterns" icon="📦" color="from-blue-500 to-blue-600" />
        <KPICard title="Total Investment" value={fmt(totalProjectedInvestment)} subtitle="Optimal stock cost" icon="💰" color="from-amber-500 to-amber-600" />
        <KPICard title="Monthly Revenue" value={fmt(totalProjectedRevenue)} subtitle="Projected from recommendations" icon="📈" color="from-emerald-500 to-emerald-600" />
        <KPICard title="Data Sources" value={csvUploaded ? `${csvSalesCount} CSV + mock` : 'Mock data only'} subtitle={csvUploaded ? '✅ Your data included' : 'Upload CSV for accuracy'} icon="📊" color={csvUploaded ? 'from-purple-500 to-purple-600' : 'from-slate-400 to-slate-500'} />
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {([
          { mode: 'summary', label: '📊 Summary' },
          { mode: 'category', label: '📋 By Category' },
          { mode: 'branch', label: '🏢 By Branch' },
          { mode: 'detail', label: '📝 Detailed Table' },
        ] as const).map((t) => (
          <button
            key={t.mode}
            onClick={() => setView({ mode: t.mode })}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              view.mode === t.mode ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters (for detail view) */}
      {view.mode === 'detail' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Search item type, variety, design..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1 min-w-[200px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
            <select value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="All">All Materials</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Diamond">Diamond</option>
            </select>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="All">All Branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="recommendedStock">Stock Qty (High)</option>
              <option value="avgMonthlySales">Monthly Sales (High)</option>
              <option value="totalInvestment">Investment (High)</option>
              <option value="projectedMonthlyRevenue">Revenue (High)</option>
              <option value="confidence">Confidence (High)</option>
              <option value="currentStock">Low Stock First</option>
            </select>
          </div>
        </div>
      )}

      {/* Summary View */}
      {view.mode === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categorySummaries.map((cat) => (
            <div key={cat.itemType} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{ITEM_ICONS[cat.itemType] || '💎'}</span>
                  <h3 className="font-bold text-slate-800">{cat.itemType}</h3>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{cat.totalVarieties} variants</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Recommended Qty</p>
                    <p className="text-xl font-bold text-slate-800">{cat.totalRecommendedItems}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Investment</p>
                    <p className="text-lg font-bold text-amber-600">{fmt(cat.totalInvestment)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase mb-2">Top Varieties</p>
                  <div className="space-y-1.5">
                    {cat.topVarieties.map((v) => (
                      <div key={v.variety} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{v.variety}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${VELOCITY_COLORS[v.velocity]}`}>{v.velocity}</span>
                          <span className="font-medium text-slate-700">{v.recommendedQty} pcs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase mb-2">Weight Distribution</p>
                  <div className="flex gap-1 flex-wrap">
                    {cat.weightDistribution.map((w) => (
                      <div key={w.weight} className="text-center">
                        <div className="w-10 bg-slate-100 rounded-t" style={{ height: `${Math.max(8, w.pct)}px` }} />
                        <p className="text-[9px] text-slate-400 mt-0.5">{w.weight}g</p>
                        <p className="text-[9px] text-slate-500">{w.count}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setView({ mode: 'category', category: cat.itemType })}
                  className="w-full text-center text-xs text-amber-600 hover:text-amber-700 font-medium py-1"
                >
                  View full details →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category View */}
      {view.mode === 'category' && (
        <div className="space-y-6">
          {/* Category filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {categorySummaries.map((cat) => (
              <button
                key={cat.itemType}
                onClick={() => setView({ mode: 'category', category: view.category === cat.itemType ? undefined : cat.itemType })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  view.category === cat.itemType ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{ITEM_ICONS[cat.itemType]}</span>
                {cat.itemType}
                <span className="text-xs text-slate-400">({cat.totalVarieties})</span>
              </button>
            ))}
          </div>

          {/* Category detail table */}
          {(() => {
            const catRecs = view.category
              ? filteredRecs.filter((r) => r.itemType === view.category)
              : filteredRecs;
            return (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                    {view.category ? `${ITEM_ICONS[view.category]} ${view.category}` : 'All Categories'} — Detailed Recommendations
                  </h3>
                  <span className="text-xs text-slate-400">{catRecs.length} variants</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                        <th className="text-left px-3 py-2 font-medium">Item</th>
                        <th className="text-left px-3 py-2 font-medium">Material</th>
                        <th className="text-right px-3 py-2 font-medium">Weight</th>
                        <th className="text-center px-3 py-2 font-medium">Velocity</th>
                        <th className="text-center px-3 py-2 font-medium">Trend</th>
                        <th className="text-right px-3 py-2 font-medium">Monthly Sales</th>
                        <th className="text-right px-3 py-2 font-medium">Current</th>
                        <th className="text-right px-3 py-2 font-medium bg-amber-50">Recommended</th>
                        <th className="text-right px-3 py-2 font-medium">Safety</th>
                        <th className="text-right px-3 py-2 font-medium">Reorder Point</th>
                        <th className="text-right px-3 py-2 font-medium">Max</th>
                        <th className="text-right px-3 py-2 font-medium">Investment</th>
                        <th className="text-left px-3 py-2 font-medium">Branch</th>
                        <th className="text-center px-3 py-2 font-medium">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {catRecs.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{ITEM_ICONS[rec.itemType]}</span>
                              <div>
                                <p className="font-medium text-slate-700 text-xs">{rec.variety}</p>
                                <p className="text-[10px] text-slate-400">{rec.design} · {rec.purity}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${MATERIAL_BADGE[rec.material]}`}>{rec.material}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-slate-600">{rec.weightGrams}g</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${VELOCITY_COLORS[rec.salesVelocity]}`}>{rec.salesVelocity}</span>
                          </td>
                          <td className="px-3 py-2 text-center text-sm">{TREND_ICONS[rec.demandTrend]}</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-600">{rec.avgMonthlySales}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={`font-bold ${rec.currentStock === 0 ? 'text-red-600' : rec.currentStock < rec.recommendedStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {rec.currentStock}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-amber-700 bg-amber-50/30">{rec.recommendedStock}</td>
                          <td className="px-3 py-2 text-right text-slate-500 text-xs">{rec.safetyStock}</td>
                          <td className="px-3 py-2 text-right text-slate-500 text-xs">{rec.reorderPoint}</td>
                          <td className="px-3 py-2 text-right text-slate-500 text-xs">{rec.maxStock}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{fmt(rec.totalInvestment)}</td>
                          <td className="px-3 py-2 text-xs text-slate-400">{rec.branchName.split(' - ')[0]}</td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <div className="w-12 bg-slate-100 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${rec.confidenceScore >= 70 ? 'bg-emerald-400' : rec.confidenceScore >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                                  style={{ width: `${rec.confidenceScore}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-400">{rec.confidenceScore}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Branch View */}
      {view.mode === 'branch' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {branchSummaries.map((branch) => (
            <div key={branch.branchId} className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">{branch.branchName}</h3>
                <div className="flex gap-4 mt-2">
                  <span className="text-xs text-slate-400">{branch.totalRecommendedItems} items recommended</span>
                  <span className="text-xs text-amber-600">Investment: {fmt(branch.totalInvestment)}</span>
                  <span className="text-xs text-emerald-600">Revenue: {fmt(branch.projectedMonthlyRevenue)}/mo</span>
                </div>
              </div>
              <div className="p-5">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Category Breakdown</p>
                <div className="space-y-2">
                  {branch.categoryBreakdown.map((cat) => (
                    <div key={cat.itemType} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{ITEM_ICONS[cat.itemType]}</span>
                        <span className="text-sm text-slate-600">{cat.itemType}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{cat.count} pcs</span>
                        <span className="text-sm font-medium text-slate-700">{fmt(cat.investment)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setView({ mode: 'detail', branchId: branch.branchId })}
                  className="w-full mt-4 text-xs text-amber-600 hover:text-amber-700 font-medium py-1"
                >
                  View full branch details →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Table View */}
      {view.mode === 'detail' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Complete Stock Recommendations</h3>
            <span className="text-xs text-slate-400">{filteredRecs.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <th className="text-left px-3 py-2 font-medium">Item</th>
                  <th className="text-left px-3 py-2 font-medium">Material</th>
                  <th className="text-right px-3 py-2 font-medium">Weight</th>
                  <th className="text-center px-3 py-2 font-medium">Velocity</th>
                  <th className="text-center px-3 py-2 font-medium">Trend</th>
                  <th className="text-right px-3 py-2 font-medium">Monthly Sales</th>
                  <th className="text-right px-3 py-2 font-medium">Current Stock</th>
                  <th className="text-right px-3 py-2 font-medium bg-amber-50 text-amber-700">Recommended</th>
                  <th className="text-right px-3 py-2 font-medium">Gap</th>
                  <th className="text-right px-3 py-2 font-medium">Safety</th>
                  <th className="text-right px-3 py-2 font-medium">Reorder Pt</th>
                  <th className="text-right px-3 py-2 font-medium">Max</th>
                  <th className="text-right px-3 py-2 font-medium">Investment</th>
                  <th className="text-right px-3 py-2 font-medium">Monthly Rev</th>
                  <th className="text-left px-3 py-2 font-medium">Branch</th>
                  <th className="text-center px-3 py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecs.slice(0, 100).map((rec) => {
                  const gap = rec.recommendedStock - rec.currentStock;
                  return (
                    <tr key={rec.id} className={`hover:bg-slate-50/80 ${gap > 0 ? 'bg-amber-50/20' : ''}`}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span>{ITEM_ICONS[rec.itemType]}</span>
                          <div>
                            <p className="font-medium text-slate-700 text-xs">{rec.variety}</p>
                            <p className="text-[10px] text-slate-400">{rec.purity}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${MATERIAL_BADGE[rec.material]}`}>{rec.material}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-600">{rec.weightGrams}g</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${VELOCITY_COLORS[rec.salesVelocity]}`}>{rec.salesVelocity}</span>
                      </td>
                      <td className="px-3 py-2 text-center">{TREND_ICONS[rec.demandTrend]}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-600">{rec.avgMonthlySales}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-bold ${rec.currentStock === 0 ? 'text-red-600' : rec.currentStock < rec.recommendedStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {rec.currentStock}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-amber-700 bg-amber-50/30">{rec.recommendedStock}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-bold text-xs ${gap > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {gap > 0 ? `+${gap} needed` : gap < 0 ? `${gap} excess` : '✓ OK'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500 text-xs">{rec.safetyStock}</td>
                      <td className="px-3 py-2 text-right text-slate-500 text-xs">{rec.reorderPoint}</td>
                      <td className="px-3 py-2 text-right text-slate-500 text-xs">{rec.maxStock}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{fmt(rec.totalInvestment)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600 font-medium">{fmt(rec.projectedMonthlyRevenue)}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">{rec.branchName.split(' - ')[0]}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-10 bg-slate-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${rec.confidenceScore >= 70 ? 'bg-emerald-400' : rec.confidenceScore >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${rec.confidenceScore}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400">{rec.confidenceScore}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredRecs.length > 100 && (
            <div className="px-4 py-3 bg-slate-50 border-t text-center text-sm text-slate-500">
              Showing first 100 of {filteredRecs.length} recommendations. Use filters to narrow down.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KPICard({ title, value, subtitle, icon, color }: { title: string; value: string; subtitle: string; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-lg shadow-sm`}>{icon}</div>
      </div>
    </div>
  );
}
