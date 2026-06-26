import React from 'react';
import type { JIMSBusinessRecord, ParseResult } from '../utils/excelParser';
import { parseExcelFile, fetchGitHubExcel, EXCEL_SOURCE_URL } from '../utils/excelParser';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#f59e0b', '#06b6d4', '#6366f1', '#ec4899', '#10b981', '#f97316', '#8b5cf6', '#ef4444', '#14b8a6', '#84cc16'];

function fmtCurrency(value: number): string {
  if (Math.abs(value) >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

// ─── Optimal Stock Calculation ──────────────────────────
interface StockSegment {
  key: string;
  category: string;
  subCategory: string;
  metalType: string;
  weightRange: string;
  styleCode: string;
  // Sales metrics
  totalSold: number;
  totalInward: number;
  avgMonthlySales: number;
  avgShelfLifeDays: number;
  velocity: 'Very Fast' | 'Fast' | 'Moderate' | 'Slow' | 'Very Slow';
  trend: 'Increasing' | 'Stable' | 'Decreasing';
  // Recommendations
  recommendedStock: number;
  currentInStock: number;
  safetyStock: number;
  reorderPoint: number;
  maxStock: number;
  gap: number;
  // Value
  avgGrossWeight: number;
  avgDiamondWeight: number;
  totalAmount: number;
  avgUnitPrice: number;
  projectedInvestment: number;
  projectedMonthlyRevenue: number;
  // Data quality
  recordCount: number;
  confidenceScore: number;
}

function computeOptimalStock(records: JIMSBusinessRecord[]): {
  segments: StockSegment[];
  summary: {
    totalSegments: number;
    totalRecommended: number;
    totalInvestment: number;
    totalMonthlyRevenue: number;
    byCategory: { category: string; segments: number; recommended: number; investment: number }[];
    byMetal: { metal: string; segments: number; recommended: number }[];
    byWeightRange: { range: string; segments: number; recommended: number }[];
  };
} {
  // Group by multi-dimensional key
  const groups = new Map<string, JIMSBusinessRecord[]>();
  for (const rec of records) {
    if (!rec.category || rec.category === 'Uncategorized') continue;
    const key = `${rec.category}|${rec.subCategory}|${rec.metalType}|${rec.weightRange}|${rec.styleCode}`;
    const existing = groups.get(key) || [];
    existing.push(rec);
    groups.set(key, existing);
  }

  const segments: StockSegment[] = [];

  // Determine analysis period
  const dates = records
    .filter((r) => r.inwardDate)
    .map((r) => new Date(r.inwardDate!).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const totalDays = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));
  const totalMonths = Math.max(1, totalDays / 30);

  for (const [key, group] of groups) {
    const first = group[0];
    const sold = group.filter((r) => r.isSold);
    const inStock = group.filter((r) => !r.isSold);

    const totalSold = sold.length;
    const totalInward = group.length;
    const avgMonthlySales = totalSold / totalMonths;

    // Average shelf life for sold items
    const soldShelfLives = sold
      .filter((r) => r.inwardDate && r.invoiceDate)
      .map((r) => {
        const start = new Date(r.inwardDate!).getTime();
        const end = new Date(r.invoiceDate!).getTime();
        return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
      });
    const avgShelfLifeDays = soldShelfLives.length > 0
      ? Math.round(soldShelfLives.reduce((a, b) => a + b, 0) / soldShelfLives.length)
      : 0;

    // Velocity
    let velocity: StockSegment['velocity'];
    if (avgMonthlySales >= 4) velocity = 'Very Fast';
    else if (avgMonthlySales >= 2) velocity = 'Fast';
    else if (avgMonthlySales >= 1) velocity = 'Moderate';
    else if (avgMonthlySales >= 0.3) velocity = 'Slow';
    else velocity = 'Very Slow';

    // Trend: compare first half vs second half of data
    const midDate = (minDate + maxDate) / 2;
    const firstHalfSold = sold.filter((r) => r.invoiceDate && new Date(r.invoiceDate).getTime() <= midDate).length;
    const secondHalfSold = sold.filter((r) => r.invoiceDate && new Date(r.invoiceDate).getTime() > midDate).length;
    let trend: StockSegment['trend'] = 'Stable';
    if (secondHalfSold > firstHalfSold * 1.3) trend = 'Increasing';
    else if (firstHalfSold > secondHalfSold * 1.3) trend = 'Decreasing';

    // Stock recommendations
    const baseStock = Math.ceil(avgMonthlySales * 1.5); // 1.5 months coverage
    const trendMultiplier = trend === 'Increasing' ? 1.25 : trend === 'Decreasing' ? 0.75 : 1.0;
    const velocityMultiplier =
      velocity === 'Very Fast' ? 1.4 :
      velocity === 'Fast' ? 1.2 :
      velocity === 'Moderate' ? 1.0 :
      velocity === 'Slow' ? 0.6 : 0.3;
    const recommendedStock = Math.max(1, Math.ceil(baseStock * trendMultiplier * velocityMultiplier));
    const safetyStock = Math.max(1, Math.ceil(avgMonthlySales * 0.5));
    const reorderPoint = safetyStock + Math.max(1, Math.ceil(avgMonthlySales * 0.25));
    const maxStock = Math.ceil(recommendedStock * 1.5);

    const currentInStock = inStock.length;
    const gap = recommendedStock - currentInStock;

    // Value calculations
    const avgGrossWeight = group.reduce((s, r) => s + r.grossWeight, 0) / Math.max(1, group.length);
    const avgDiamondWeight = group.reduce((s, r) => s + r.diamondWeight, 0) / Math.max(1, group.length);
    const totalAmount = group.reduce((s, r) => s + r.amount, 0);
    const avgUnitPrice = totalAmount > 0 ? totalAmount / group.length : 0;
    const projectedInvestment = recommendedStock * avgUnitPrice * 0.85;
    const projectedMonthlyRevenue = avgMonthlySales * avgUnitPrice;

    // Confidence
    const recordFactor = Math.min(1, group.length / 10) * 50;
    const soldFactor = Math.min(1, totalSold / 5) * 30;
    const timeFactor = Math.min(1, totalMonths / 12) * 20;
    const confidenceScore = Math.min(100, Math.round(recordFactor + soldFactor + timeFactor));

    segments.push({
      key,
      category: first.category,
      subCategory: first.subCategory,
      metalType: first.metalType,
      weightRange: first.weightRange,
      styleCode: first.styleCode,
      totalSold,
      totalInward,
      avgMonthlySales: Math.round(avgMonthlySales * 100) / 100,
      avgShelfLifeDays,
      velocity,
      trend,
      recommendedStock,
      currentInStock,
      safetyStock,
      reorderPoint,
      maxStock,
      gap,
      avgGrossWeight: Math.round(avgGrossWeight * 100) / 100,
      avgDiamondWeight: Math.round(avgDiamondWeight * 100) / 100,
      totalAmount,
      avgUnitPrice: Math.round(avgUnitPrice),
      projectedInvestment: Math.round(projectedInvestment),
      projectedMonthlyRevenue: Math.round(projectedMonthlyRevenue),
      recordCount: group.length,
      confidenceScore,
    });
  }

  segments.sort((a, b) => b.recommendedStock - a.recommendedStock);

  // Summary
  const byCategoryMap = new Map<string, { segments: number; recommended: number; investment: number }>();
  const byMetalMap = new Map<string, { segments: number; recommended: number }>();
  const byWeightRangeMap = new Map<string, { segments: number; recommended: number }>();

  for (const seg of segments) {
    const cat = byCategoryMap.get(seg.category) || { segments: 0, recommended: 0, investment: 0 };
    cat.segments++;
    cat.recommended += seg.recommendedStock;
    cat.investment += seg.projectedInvestment;
    byCategoryMap.set(seg.category, cat);

    const met = byMetalMap.get(seg.metalType) || { segments: 0, recommended: 0 };
    met.segments++;
    met.recommended += seg.recommendedStock;
    byMetalMap.set(seg.metalType, met);

    const wr = byWeightRangeMap.get(seg.weightRange) || { segments: 0, recommended: 0 };
    wr.segments++;
    wr.recommended += seg.recommendedStock;
    byWeightRangeMap.set(seg.weightRange, wr);
  }

  return {
    segments,
    summary: {
      totalSegments: segments.length,
      totalRecommended: segments.reduce((s, seg) => s + seg.recommendedStock, 0),
      totalInvestment: segments.reduce((s, seg) => s + seg.projectedInvestment, 0),
      totalMonthlyRevenue: segments.reduce((s, seg) => s + seg.projectedMonthlyRevenue, 0),
      byCategory: Array.from(byCategoryMap.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.investment - a.investment),
      byMetal: Array.from(byMetalMap.entries())
        .map(([metal, data]) => ({ metal, ...data }))
        .sort((a, b) => b.recommended - a.recommended),
      byWeightRange: Array.from(byWeightRangeMap.entries())
        .map(([range, data]) => ({ range, ...data }))
        .sort((a, b) => a.range.localeCompare(b.range)),
    },
  };
}

// ─── Main Component ─────────────────────────────────────
export default function BusinessDataPage() {
  const [parseResult, setParseResult] = React.useState<ParseResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<'overview' | 'categories' | 'detail' | 'raw'>('overview');
  const [filterCategory, setFilterCategory] = React.useState<string>('All');
  const [filterMetal, setFilterMetal] = React.useState<string>('All');
  const [filterWeight, setFilterWeight] = React.useState<string>('All');
  const [filterSubCategory, setFilterSubCategory] = React.useState<string>('All');
  const [filterStyleCode, setFilterStyleCode] = React.useState<string>('All');
  const [sortBy, setSortBy] = React.useState<string>('recommendedStock');
  const [searchText, setSearchText] = React.useState('');

  const loadData = React.useCallback(async (fromGitHub: boolean = true) => {
    setLoading(true);
    setError(null);
    try {
      let buffer: ArrayBuffer;
      if (fromGitHub) {
        buffer = await fetchGitHubExcel();
      } else {
        throw new Error('File upload not implemented in this path');
      }
      const result = parseExcelFile(buffer);
      setParseResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const buffer = ev.target?.result as ArrayBuffer;
        const result = parseExcelFile(buffer);
        setParseResult(result);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const { segments, summary } = React.useMemo(() => {
    if (!parseResult) return { segments: [], summary: null };
    return computeOptimalStock(parseResult.records);
  }, [parseResult]);

  const filteredSegments = React.useMemo(() => {
    let segs = segments;
    if (filterCategory !== 'All') segs = segs.filter((s) => s.category === filterCategory);
    if (filterMetal !== 'All') segs = segs.filter((s) => s.metalType === filterMetal);
    if (filterWeight !== 'All') segs = segs.filter((s) => s.weightRange === filterWeight);
    if (filterSubCategory !== 'All') segs = segs.filter((s) => s.subCategory === filterSubCategory);
    if (filterStyleCode !== 'All') segs = segs.filter((s) => s.styleCode === filterStyleCode);
    if (searchText) {
      const q = searchText.toLowerCase();
      segs = segs.filter(
        (s) =>
          s.category.toLowerCase().includes(q) ||
          s.subCategory.toLowerCase().includes(q) ||
          s.metalType.toLowerCase().includes(q) ||
          s.styleCode.toLowerCase().includes(q)
      );
    }
    return [...segs].sort((a, b) => {
      switch (sortBy) {
        case 'recommendedStock': return b.recommendedStock - a.recommendedStock;
        case 'avgMonthlySales': return b.avgMonthlySales - a.avgMonthlySales;
        case 'totalSold': return b.totalSold - a.totalSold;
        case 'avgShelfLifeDays': return a.avgShelfLifeDays - b.avgShelfLifeDays;
        case 'gap': return b.gap - a.gap;
        case 'confidence': return b.confidenceScore - a.confidenceScore;
        case 'projectedInvestment': return b.projectedInvestment - a.projectedInvestment;
        default: return 0;
      }
    });
  }, [segments, filterCategory, filterMetal, filterWeight, filterSubCategory, filterStyleCode, sortBy, searchText]);

  // ─── Welcome / Load Screen ───────────────────────────
  if (!parseResult && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Business Data Analysis</h2>
          <p className="text-slate-500 mt-1">Load actual 5-year sales data to generate optimal stock recommendations</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl flex-shrink-0 shadow-md">
              📊
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Load JIMS Business Plan Data</h3>
              <p className="text-sm text-slate-600 mb-4">
                Analyze your actual past 5 years of sales data to determine optimal stock levels for each jewelry item,
                classified by category, sub-category, metal type, weight range, style code, gross weight, and diamond weight.
              </p>
              <div className="bg-white rounded-lg border border-amber-200 p-4 mb-4">
                <p className="text-xs text-slate-500 mb-1 font-semibold">📎 Data Source</p>
                <a
                  href="https://github.com/AkilahJ14Jun/JIMS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-blue-600 hover:text-blue-700 hover:underline break-all"
                >
                  {EXCEL_SOURCE_URL}
                </a>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => loadData(true)}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
                >
                  🚀 Load from GitHub
                </button>
                <label className="px-6 py-3 bg-white border-2 border-amber-300 text-amber-700 rounded-lg font-semibold cursor-pointer hover:bg-amber-50 transition-colors">
                  📁 Upload Excel File
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">🔍 Expected Data Columns</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { name: 'Inward date', desc: 'When item came into stock', required: true },
              { name: 'Invoice date', desc: 'When item was sold (null = in stock)', required: false },
              { name: 'category', desc: 'Jewelry type: bangle, ring, bracelet, etc.', required: true },
              { name: 'sub category', desc: 'Further classification within category', required: true },
              { name: 'Metal type', desc: 'Gold, Silver, Diamond, Platinum, etc.', required: true },
              { name: 'Weight Range', desc: 'Weight bucket (e.g., 5-10g)', required: true },
              { name: 'Style code', desc: 'Design identifier / SKU', required: true },
              { name: 'Gross weight', desc: 'Total weight in grams', required: true },
              { name: 'Diamond weight', desc: 'Diamond weight in carats', required: false },
            ].map((col) => (
              <div key={col.name} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${col.required ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} font-medium mt-0.5`}>
                  {col.required ? 'Req' : 'Opt'}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-700">{col.name}</p>
                  <p className="text-xs text-slate-400">{col.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">📐 How Recommendations Are Calculated</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
              <h4 className="font-bold text-emerald-800 mb-2">Sales Velocity Analysis</h4>
              <ul className="text-xs text-emerald-700 space-y-1">
                <li>• 5-year historical data → monthly sales averages</li>
                <li>• Demand trend detection (increasing / stable / decreasing)</li>
                <li>• Velocity classification (Very Fast → Very Slow)</li>
                <li>• Average shelf life per segment</li>
              </ul>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h4 className="font-bold text-blue-800 mb-2">Multi-Dimensional Segmentation</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Category × Sub-category × Metal type</li>
                <li>• Weight range × Style code</li>
                <li>• Each unique combination = one recommendation</li>
                <li>• Confidence score based on data volume</li>
              </ul>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
              <h4 className="font-bold text-amber-800 mb-2">Stock Level Algorithm</h4>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• Base stock = avg_monthly_sales × 1.5 months</li>
                <li>• Adjusted by trend (1.25× / 1.0 / 0.75×)</li>
                <li>• Adjusted by velocity (0.3× to 1.4×)</li>
                <li>• Safety stock = avg_monthly × 0.5</li>
              </ul>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
              <h4 className="font-bold text-purple-800 mb-2">Financial Projections</h4>
              <ul className="text-xs text-purple-700 space-y-1">
                <li>• Projected investment per segment</li>
                <li>• Expected monthly revenue</li>
                <li>• Total inventory investment required</li>
                <li>• Gap analysis (recommended vs current)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading State ───────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin mb-4" />
          <p className="text-slate-600 font-medium">Loading business data from GitHub...</p>
          <p className="text-xs text-slate-400 mt-1">Parsing Excel file and analyzing 5 years of sales data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="font-bold text-red-700 mb-2">⚠️ Error Loading Data</h3>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={() => loadData(true)}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!parseResult || !summary) return null;

  // ─── Data Loaded View ─────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Business Data Analysis</h2>
          <p className="text-slate-500 mt-1">
            {parseResult.totalRows.toLocaleString()} records analyzed from{' '}
            {parseResult.earliestDate} to {parseResult.latestDate}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={loading}
            className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
          >
            🔄 Reload
          </button>
          <label className="px-3 py-2 text-sm bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg cursor-pointer transition-colors">
            📁 Upload
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Column Mapping */}
      {Object.keys(parseResult.columnMapping).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">🔗 Column Mapping Detected</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(parseResult.columnMapping).map(([key, value]) => (
              <span
                key={key}
                className={`text-xs px-2 py-1 rounded-md ${
                  value === 'Not Found' ? 'bg-red-100 text-red-700' : 'bg-white text-blue-700 border border-blue-200'
                }`}
              >
                <span className="font-semibold">{key}:</span> {value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {parseResult.errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-bold text-amber-800 mb-2">⚠️ {parseResult.errors.length} warnings:</p>
          <ul className="text-xs text-amber-700 space-y-0.5">
            {parseResult.errors.slice(0, 5).map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard title="Total Records" value={parseResult.totalRows.toLocaleString()} icon="📋" color="from-slate-500 to-slate-600" />
        <KPICard title="Items Sold" value={parseResult.soldCount.toLocaleString()} icon="✅" color="from-emerald-500 to-emerald-600" />
        <KPICard title="Currently In Stock" value={parseResult.inStockCount.toLocaleString()} icon="📦" color="from-blue-500 to-blue-600" />
        <KPICard title="Unique Segments" value={summary.totalSegments.toString()} icon="🔍" color="from-purple-500 to-purple-600" />
        <KPICard title="Recommended Stock" value={summary.totalRecommended.toString()} icon="📊" color="from-amber-500 to-amber-600" />
        <KPICard title="Total Investment" value={fmtCurrency(summary.totalInvestment)} icon="💰" color="from-orange-500 to-orange-600" />
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {([
          { id: 'overview', label: '📊 Overview' },
          { id: 'categories', label: '📂 By Category' },
          { id: 'detail', label: '📝 Detailed Table' },
          { id: 'raw', label: '📋 Raw Data' },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              view === t.id ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {view === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Category */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Optimal Stock by Category</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.byCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="recommended" fill="#f59e0b" name="Recommended Stock" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* By Metal */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Stock Distribution by Metal</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.byMetal.map((m) => ({ name: m.metal, value: m.recommended }))}
                      cx="50%" cy="50%" outerRadius={90} innerRadius={45}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {summary.byMetal.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* By Weight Range */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Optimal Stock by Weight Range</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.byWeightRange}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="recommended" fill="#6366f1" name="Recommended Stock" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Category Breakdown Cards */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Category Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.byCategory.map((cat) => (
                <div key={cat.category} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-slate-800">{cat.category}</h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{cat.segments} variants</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-slate-400 uppercase">Recommended</p>
                      <p className="text-xl font-bold text-slate-800">{cat.recommended}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase">Investment</p>
                      <p className="text-lg font-bold text-amber-600">{fmtCurrency(cat.investment)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setView('detail'); setFilterCategory(cat.category); }}
                    className="w-full text-xs text-amber-600 hover:text-amber-700 font-medium py-1"
                  >
                    View details →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Categories View */}
      {view === 'categories' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {['All', ...parseResult.uniqueCategories].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  filterCategory === cat
                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(() => {
              const catSegments = filterCategory === 'All' ? segments : segments.filter((s) => s.category === filterCategory);
              // Group by sub category
              const subCatMap = new Map<string, StockSegment[]>();
              for (const seg of catSegments) {
                const existing = subCatMap.get(seg.subCategory) || [];
                existing.push(seg);
                subCatMap.set(seg.subCategory, existing);
              }
              return Array.from(subCatMap.entries()).map(([subCat, segs]) => {
                const totalRecommended = segs.reduce((s, seg) => s + seg.recommendedStock, 0);
                const totalInvestment = segs.reduce((s, seg) => s + seg.projectedInvestment, 0);
                const topItems = [...segs].sort((a, b) => b.recommendedStock - a.recommendedStock).slice(0, 5);
                return (
                  <div key={subCat} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-slate-800">{subCat}</h4>
                      <span className="text-xs text-slate-400">{segs.length} variants</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <p className="text-xs text-slate-400">Recommended</p>
                        <p className="text-lg font-bold text-slate-700">{totalRecommended}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Investment</p>
                        <p className="text-sm font-bold text-amber-600">{fmtCurrency(totalInvestment)}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Top Variants</p>
                      {topItems.map((item) => (
                        <div key={item.key} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                          <span className="text-slate-600 truncate">
                            {item.metalType} · {item.weightRange} · {item.styleCode}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <VelocityBadge velocity={item.velocity} />
                            <span className="font-bold text-slate-700">{item.recommendedStock}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Detail Table */}
      {view === 'detail' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="flex-1 min-w-[180px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="All">All Categories</option>
                {parseResult.uniqueCategories.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select value={filterSubCategory} onChange={(e) => setFilterSubCategory(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="All">All Sub-Categories</option>
                {parseResult.uniqueSubCategories.slice(0, 50).map((c) => <option key={c}>{c}</option>)}
              </select>
              <select value={filterMetal} onChange={(e) => setFilterMetal(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="All">All Metals</option>
                {parseResult.uniqueMetals.map((m) => <option key={m}>{m}</option>)}
              </select>
              <select value={filterWeight} onChange={(e) => setFilterWeight(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="All">All Weights</option>
                {parseResult.uniqueWeightRanges.map((w) => <option key={w}>{w}</option>)}
              </select>
              <select value={filterStyleCode} onChange={(e) => setFilterStyleCode(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="All">All Styles</option>
                {parseResult.uniqueStyleCodes.slice(0, 50).map((s) => <option key={s}>{s}</option>)}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="recommendedStock">Recommended (High)</option>
                <option value="avgMonthlySales">Monthly Sales (High)</option>
                <option value="totalSold">Total Sold (High)</option>
                <option value="avgShelfLifeDays">Shelf Life (Low)</option>
                <option value="gap">Gap (High)</option>
                <option value="confidence">Confidence (High)</option>
                <option value="projectedInvestment">Investment (High)</option>
              </select>
            </div>
          </div>

          {/* Summary of filtered */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Segments Shown" value={filteredSegments.length.toString()} />
            <MiniStat label="Total Recommended" value={filteredSegments.reduce((s, seg) => s + seg.recommendedStock, 0).toString()} />
            <MiniStat label="Total Investment" value={fmtCurrency(filteredSegments.reduce((s, seg) => s + seg.projectedInvestment, 0))} />
            <MiniStat label="Monthly Revenue" value={fmtCurrency(filteredSegments.reduce((s, seg) => s + seg.projectedMonthlyRevenue, 0))} />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <th className="text-left px-3 py-2 font-medium">Category</th>
                    <th className="text-left px-3 py-2 font-medium">Sub-Category</th>
                    <th className="text-left px-3 py-2 font-medium">Metal</th>
                    <th className="text-left px-3 py-2 font-medium">Weight Range</th>
                    <th className="text-left px-3 py-2 font-medium">Style Code</th>
                    <th className="text-center px-3 py-2 font-medium">Velocity</th>
                    <th className="text-center px-3 py-2 font-medium">Trend</th>
                    <th className="text-right px-3 py-2 font-medium">Total Sold</th>
                    <th className="text-right px-3 py-2 font-medium">Monthly Sales</th>
                    <th className="text-right px-3 py-2 font-medium">Shelf Life</th>
                    <th className="text-right px-3 py-2 font-medium">In Stock</th>
                    <th className="text-right px-3 py-2 font-medium bg-amber-50 text-amber-700">Recommended</th>
                    <th className="text-right px-3 py-2 font-medium">Safety</th>
                    <th className="text-right px-3 py-2 font-medium">Reorder Pt</th>
                    <th className="text-right px-3 py-2 font-medium">Max</th>
                    <th className="text-right px-3 py-2 font-medium">Gap</th>
                    <th className="text-right px-3 py-2 font-medium">Avg Weight</th>
                    <th className="text-right px-3 py-2 font-medium">Investment</th>
                    <th className="text-right px-3 py-2 font-medium">Monthly Rev</th>
                    <th className="text-center px-3 py-2 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSegments.slice(0, 150).map((seg) => (
                    <tr key={seg.key} className={`hover:bg-slate-50/80 ${seg.gap > 0 ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-3 py-2 font-medium text-slate-700">{seg.category}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{seg.subCategory}</td>
                      <td className="px-3 py-2">
                        <MetalBadge metal={seg.metalType} />
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{seg.weightRange}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{seg.styleCode}</td>
                      <td className="px-3 py-2 text-center">
                        <VelocityBadge velocity={seg.velocity} />
                      </td>
                      <td className="px-3 py-2 text-center text-sm">
                        {seg.trend === 'Increasing' ? '📈' : seg.trend === 'Decreasing' ? '📉' : '➡️'}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{seg.totalSold}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{seg.avgMonthlySales}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{seg.avgShelfLifeDays}d</td>
                      <td className="px-3 py-2 text-right">
                        <span className={seg.currentInStock === 0 ? 'text-red-600 font-bold' : 'text-slate-700'}>
                          {seg.currentInStock}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-amber-700 bg-amber-50/50">{seg.recommendedStock}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{seg.safetyStock}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{seg.reorderPoint}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{seg.maxStock}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-xs font-bold ${seg.gap > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {seg.gap > 0 ? `+${seg.gap}` : seg.gap < 0 ? seg.gap : '✓'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{seg.avgGrossWeight}g</td>
                      <td className="px-3 py-2 text-right text-slate-600 text-xs">{fmtCurrency(seg.projectedInvestment)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600 text-xs font-medium">{fmtCurrency(seg.projectedMonthlyRevenue)}</td>
                      <td className="px-3 py-2 text-center">
                        <ConfidenceBar score={seg.confidenceScore} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredSegments.length > 150 && (
              <div className="px-4 py-3 bg-slate-50 border-t text-center text-sm text-slate-500">
                Showing first 150 of {filteredSegments.length} segments
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raw Data */}
      {view === 'raw' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-sm text-slate-500 mb-2">
              Showing raw parsed records — {parseResult.records.length.toLocaleString()} total
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100">
                  <tr className="text-slate-500 uppercase">
                    <th className="text-left px-2 py-2 font-medium">Inward</th>
                    <th className="text-left px-2 py-2 font-medium">Invoice</th>
                    <th className="text-left px-2 py-2 font-medium">Category</th>
                    <th className="text-left px-2 py-2 font-medium">Sub-Cat</th>
                    <th className="text-left px-2 py-2 font-medium">Metal</th>
                    <th className="text-left px-2 py-2 font-medium">Weight Range</th>
                    <th className="text-left px-2 py-2 font-medium">Style Code</th>
                    <th className="text-right px-2 py-2 font-medium">Gross Wt</th>
                    <th className="text-right px-2 py-2 font-medium">Diamond Wt</th>
                    <th className="text-right px-2 py-2 font-medium">Days</th>
                    <th className="text-center px-2 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parseResult.records.slice(0, 500).map((rec, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-2 py-1 text-slate-600">{rec.inwardDate || '—'}</td>
                      <td className="px-2 py-1 text-slate-600">{rec.invoiceDate || '—'}</td>
                      <td className="px-2 py-1 font-medium text-slate-700">{rec.category}</td>
                      <td className="px-2 py-1 text-slate-500">{rec.subCategory}</td>
                      <td className="px-2 py-1"><MetalBadge metal={rec.metalType} /></td>
                      <td className="px-2 py-1 text-slate-600">{rec.weightRange}</td>
                      <td className="px-2 py-1 font-mono text-slate-500">{rec.styleCode}</td>
                      <td className="px-2 py-1 text-right">{rec.grossWeight}g</td>
                      <td className="px-2 py-1 text-right">{rec.diamondWeight}ct</td>
                      <td className="px-2 py-1 text-right">{rec.daysInStock}d</td>
                      <td className="px-2 py-1 text-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${rec.isSold ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                          {rec.isSold ? 'Sold' : 'Stock'}
                        </span>
                      </td>
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

// ─── Helper Components ──────────────────────────────────
function KPICard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-lg font-bold text-slate-900 mt-0.5">{value}</p>
        </div>
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-sm shadow-sm`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <p className="text-base font-bold text-slate-800">{value}</p>
    </div>
  );
}

function VelocityBadge({ velocity }: { velocity: string }) {
  const styles: Record<string, string> = {
    'Very Fast': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Fast': 'bg-green-100 text-green-700 border-green-200',
    'Moderate': 'bg-blue-100 text-blue-700 border-blue-200',
    'Slow': 'bg-amber-100 text-amber-700 border-amber-200',
    'Very Slow': 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${styles[velocity] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {velocity}
    </span>
  );
}

function MetalBadge({ metal }: { metal: string }) {
  const lower = metal.toLowerCase();
  let style = 'bg-slate-100 text-slate-700 border-slate-200';
  if (lower.includes('gold')) style = 'bg-amber-100 text-amber-800 border-amber-200';
  else if (lower.includes('silver')) style = 'bg-slate-200 text-slate-700 border-slate-300';
  else if (lower.includes('diamond')) style = 'bg-cyan-100 text-cyan-800 border-cyan-200';
  else if (lower.includes('platinum')) style = 'bg-violet-100 text-violet-800 border-violet-200';
  else if (lower.includes('rose')) style = 'bg-pink-100 text-pink-800 border-pink-200';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${style}`}>
      {metal}
    </span>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <div className="w-10 bg-slate-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${
            score >= 70 ? 'bg-emerald-400' : score >= 40 ? 'bg-amber-400' : 'bg-red-400'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[10px] text-slate-400">{score}%</span>
    </div>
  );
}
