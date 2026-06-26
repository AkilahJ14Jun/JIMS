import React from 'react';
import type { InventoryItem, Sale, Branch, Supplier, Customer } from '../../types';
import {
  getDefaultParams,
  simulateOptimizer,
  generateBranchConfigs,
  generateSupplierConfigs,
  generateDemographicConfigs,
  formatCurrency,
} from '../../utils/optimizer';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend } from 'recharts';

interface ProfitOptimizerProps {
  items: InventoryItem[];
  sales: Sale[];
  branches: Branch[];
  suppliers: Supplier[];
  customers: Customer[];
}

type SliderView = 'global' | 'branch' | 'supplier' | 'demographic';

export default function ProfitOptimizer({ items, sales, branches, suppliers, customers }: ProfitOptimizerProps) {
  const [params, setParams] = React.useState(getDefaultParams());
  const [view, setView] = React.useState<SliderView>('global');
  const [selectedBranch, setSelectedBranch] = React.useState(branches[0]?.id || '');
  const [selectedSupplier, setSelectedSupplier] = React.useState(suppliers[0]?.id || '');
  const [selectedDemographic, setSelectedDemographic] = React.useState('ageGroup');

  const result = React.useMemo(
    () => simulateOptimizer(items, sales, branches, suppliers, customers, params),
    [items, sales, branches, suppliers, customers, params]
  );

  const branchConfigs = React.useMemo(() => generateBranchConfigs(items, branches), [items, branches]);
  const supplierConfigs = React.useMemo(() => generateSupplierConfigs(items, suppliers), [items, suppliers]);
  const demographicConfigs = React.useMemo(
    () => generateDemographicConfigs(items, sales, customers),
    [items, sales, customers]
  );

  const updateParam = (key: string, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  // ─── Slider Component ─────────────────────────────────
  const Slider = ({
    label,
    value,
    min,
    max,
    step = 1,
    unit = '',
    onChange,
    optimal,
    description,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    onChange: (v: number) => void;
    optimal?: number;
    description?: string;
  }) => {
    const pct = ((value - min) / (max - min)) * 100;
    const isOptimal = optimal !== undefined && value === optimal;
    const isAbove = optimal !== undefined && value > optimal;
    const isBelow = optimal !== undefined && value < optimal;

    return (
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-semibold text-slate-700">{label}</label>
          <div className="flex items-center gap-2">
            {optimal !== undefined && (
              <button
                onClick={() => onChange(optimal)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium transition-colors"
              >
                Reset to optimal
              </button>
            )}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1">
              <input
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
                className="w-14 bg-transparent text-right text-sm font-bold text-slate-800 focus:outline-none"
              />
              <span className="text-xs text-slate-400">{unit}</span>
            </div>
          </div>
        </div>
        <div className="relative h-8 flex items-center">
          <div className="absolute w-full h-2 bg-slate-200 rounded-full" />
          <div
            className={`absolute h-2 rounded-full transition-all ${
              isOptimal ? 'bg-emerald-400' : isAbove ? 'bg-red-400' : isBelow ? 'bg-blue-400' : 'bg-amber-400'
            }`}
            style={{ width: `${pct}%` }}
          />
          {optimal !== undefined && (
            <div
              className="absolute w-0.5 h-4 bg-emerald-500 top-2"
              style={{ left: `${((optimal - min) / (max - min)) * 100}%` }}
              title={`Optimal: ${optimal}${unit}`}
            />
          )}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute w-full h-2 opacity-0 cursor-pointer"
          />
          <div
            className="absolute w-5 h-5 bg-white border-2 border-amber-500 rounded-full shadow-md -ml-2.5 transition-transform hover:scale-110 pointer-events-none"
            style={{ left: `${pct}%` }}
          />
        </div>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        {optimal !== undefined && (
          <p className={`text-xs mt-0.5 ${isOptimal ? 'text-emerald-500 font-medium' : 'text-slate-400'}`}>
            Optimal: {optimal}{unit} {isOptimal ? '✓' : `(current: ${value}${unit})`}
          </p>
        )}
      </div>
    );
  };

  // ─── Global Sliders ───────────────────────────────────
  const GlobalSliders = () => {
    const currentMargin = result.currentProfitMargin;
    const projectedMargin = result.projectedProfitMargin;
    const targetMargin = params.targetProfitMargin;
    const marginDiff = projectedMargin - currentMargin;
    const gapToTarget = targetMargin - projectedMargin;

    return (
      <div className="space-y-6">
        {/* Profitability Target Slider - Always visible at top */}
        <div className="bg-gradient-to-r from-amber-50 via-amber-50/50 to-amber-50 rounded-xl border-2 border-amber-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💎</span>
            <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider">
              Profitability Target
            </h3>
          </div>
          <p className="text-xs text-amber-600 mb-4">Set your desired profit margin and see how each factor affects it</p>

          {/* Profitability Slider */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-bold text-slate-800">Target Profit Margin</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateParam('targetProfitMargin', 15)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 hover:bg-amber-300 font-medium transition-colors"
                >
                  Reset to optimal
                </button>
                <div className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border border-amber-200">
                  <input
                    type="number"
                    value={params.targetProfitMargin}
                    min={5}
                    max={30}
                    step={0.5}
                    onChange={(e) => updateParam('targetProfitMargin', Math.min(30, Math.max(5, Number(e.target.value))))}
                    className="w-12 bg-transparent text-right text-sm font-bold text-amber-800 focus:outline-none"
                  />
                  <span className="text-xs text-amber-600">%</span>
                </div>
              </div>
            </div>
            <div className="relative h-8 flex items-center">
              <div className="absolute w-full h-2 bg-amber-100 rounded-full" />
              <div
                className="absolute h-2 rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-400 transition-all"
                style={{ width: `${((params.targetProfitMargin - 5) / 25) * 100}%` }}
              />
              {/* Target marker */}
              <div
                className="absolute w-0.5 h-5 bg-amber-800 top-1.5"
                style={{ left: `${((params.targetProfitMargin - 5) / 25) * 100}%` }}
              />
              <input
                type="range"
                min={5}
                max={30}
                step={0.5}
                value={params.targetProfitMargin}
                onChange={(e) => updateParam('targetProfitMargin', Number(e.target.value))}
                className="absolute w-full h-2 opacity-0 cursor-pointer"
              />
              <div
                className="absolute w-6 h-6 bg-amber-600 border-3 border-white rounded-full shadow-lg -ml-3 transition-transform hover:scale-110 pointer-events-none"
                style={{ left: `${((params.targetProfitMargin - 5) / 25) * 100}%` }}
              />
            </div>
            <p className="text-xs text-amber-600 mt-0.5">Optimal: 15% (current setting: {params.targetProfitMargin}%)</p>
          </div>

          {/* Profit Margin Visual Gauge */}
          <div className="bg-white rounded-lg p-4 border border-amber-100">
            <div className="grid grid-cols-3 gap-4 mb-4">
              {/* Current */}
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Current Margin</p>
                <p className={`text-3xl font-bold ${currentMargin >= targetMargin ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {currentMargin.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(result.currentProfit)}</p>
              </div>
              {/* Projected */}
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Projected Margin</p>
                <p className={`text-3xl font-bold ${projectedMargin >= targetMargin ? 'text-emerald-600' : 'text-red-600'}`}>
                  {projectedMargin.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(result.projectedProfit)}</p>
              </div>
              {/* Gap */}
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Gap to Target</p>
                <p className={`text-3xl font-bold ${gapToTarget <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {gapToTarget > 0 ? '+' : ''}{gapToTarget.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {gapToTarget <= 0 ? '✅ Target met!' : 'Need to optimize'}
                </p>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="relative h-6 bg-slate-100 rounded-full overflow-hidden">
              {/* Gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-200 via-yellow-200 to-emerald-200" />
              {/* Current margin fill */}
              <div
                className="absolute h-full bg-slate-400/60 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (currentMargin / 30) * 100)}%` }}
              />
              {/* Projected margin fill */}
              <div
                className={`absolute h-full rounded-full transition-all duration-300 ${
                  projectedMargin >= targetMargin ? 'bg-emerald-500/70' : 'bg-red-400/70'
                }`}
                style={{ width: `${Math.min(100, (projectedMargin / 30) * 100)}%` }}
              />
              {/* Target marker */}
              <div
                className="absolute top-0 h-full w-0.5 bg-amber-700"
                style={{ left: `${(targetMargin / 30) * 100}%` }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-amber-700"
                style={{ left: `${(targetMargin / 30) * 100}%` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-amber-700 text-white text-[8px] px-1 rounded">
                  TARGET
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-slate-400">0%</span>
              <span className="text-[10px] text-slate-400">15%</span>
              <span className="text-[10px] text-slate-400">30%</span>
            </div>

            {/* Margin change indicator */}
            <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-slate-400" />
                <span className="text-xs text-slate-500">Current</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${projectedMargin >= targetMargin ? 'bg-emerald-500' : 'bg-red-400'}`} />
                <span className="text-xs text-slate-500">Projected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-700" />
                <span className="text-xs text-slate-500">Target ({targetMargin}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600">
                  Margin Change: <span className={marginDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {marginDiff >= 0 ? '+' : ''}{marginDiff.toFixed(1)}%
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Shelf Life & Reorder */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-1 uppercase tracking-wider">
              📦 Shelf Life & Reorder Controls
            </h3>
            <p className="text-xs text-slate-400 mb-5">Adjust to see real-time profit impact</p>

            <Slider
              label="Target Shelf Life"
              value={params.targetShelfLife}
              min={7}
              max={60}
              unit=" days"
              optimal={30}
              description="Maximum days an item should stay in stock before being discounted or transferred"
              onChange={(v) => updateParam('targetShelfLife', v)}
            />
            <Slider
              label="Reorder Timeline"
              value={params.reorderTimeline}
              min={3}
              max={30}
              unit=" days"
              optimal={15}
              description="Days before estimated stockout to trigger a reorder"
              onChange={(v) => updateParam('reorderTimeline', v)}
            />
            <Slider
              label="Reorder Limit (% of monthly avg)"
              value={params.reorderLimitPercent}
              min={20}
              max={150}
              unit="%"
              optimal={80}
              description="Max quantity to reorder as percentage of average monthly sales"
              onChange={(v) => updateParam('reorderLimitPercent', v)}
            />
            <Slider
              label="Safety Stock Buffer"
              value={params.safetyStockDays}
              min={1}
              max={21}
              unit=" days"
              optimal={7}
              description="Extra days of stock to maintain above minimum level"
              onChange={(v) => updateParam('safetyStockDays', v)}
            />
          </div>

          {/* Cost & Discount Controls */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-1 uppercase tracking-wider">
              💰 Cost & Discount Controls
            </h3>
            <p className="text-xs text-slate-400 mb-5">Manage holding costs and markdown strategies</p>

            <Slider
              label="Holding Cost Rate"
              value={Math.round(params.holdingCostPerDay * 1000)}
              min={5}
              max={50}
              step={1}
              unit="‰/day"
              optimal={20}
              description="Daily cost of holding inventory as per-mille of item value (capital, insurance, storage)"
              onChange={(v) => updateParam('holdingCostPerDay', v / 1000)}
            />
            <Slider
              label="Discount Trigger (days)"
              value={params.discountAfterDays}
              min={15}
              max={90}
              unit=" days"
              optimal={45}
              description="Apply discount to items that have been in stock longer than this"
              onChange={(v) => updateParam('discountAfterDays', v)}
            />
            <Slider
              label="Discount Percentage"
              value={params.discountPercent}
              min={2}
              max={25}
              unit="%"
              optimal={8}
              description="Percentage markdown for slow-moving items past discount trigger"
              onChange={(v) => updateParam('discountPercent', v)}
            />
          </div>

          {/* Per-Branch Quick View */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-1 uppercase tracking-wider">
              🏢 Optimal Shelf Life by Branch
            </h3>
            <p className="text-xs text-slate-400 mb-4">Based on local demand patterns</p>
            <div className="space-y-3">
              {result.optimalShelfLifeByBranch.map((b) => {
                const diff = b.optimal - b.current;
                return (
                  <div key={b.branchId} className="flex items-center gap-3">
                    <div className="w-32 text-sm font-medium text-slate-700">{b.branchName.split(' - ')[0]}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-3 rounded-full transition-all bg-blue-400"
                            style={{ width: `${Math.min(100, (b.current / 60) * 100)}%` }}
                          />
                        </div>
                        <div className="w-8 text-right text-xs text-slate-500">{b.current}d</div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden relative">
                          <div className="absolute left-0 top-0 w-full h-full flex items-center">
                            <div className="absolute w-0.5 h-3 bg-emerald-500" style={{ left: `${(b.optimal / 60) * 100}%` }} />
                          </div>
                        </div>
                        <div className="w-8 text-right text-xs text-emerald-600 font-medium">{b.optimal}d</div>
                      </div>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      diff > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {diff > 0 ? `+${diff}` : diff}d
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-Supplier View */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-1 uppercase tracking-wider">
              🤝 Optimal Shelf Life by Supplier
            </h3>
            <p className="text-xs text-slate-400 mb-4">Based on delivery reliability & item mix</p>
            <div className="space-y-3">
              {result.optimalShelfLifeBySupplier.map((s) => {
                const diff = s.optimal - s.current;
                return (
                  <div key={s.supplierId} className="flex items-center gap-3">
                    <div className="w-40 text-sm font-medium text-slate-700 truncate">{s.supplierName.split(' ')[0]}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-3 rounded-full transition-all bg-violet-400"
                            style={{ width: `${Math.min(100, (s.current / 60) * 100)}%` }}
                          />
                        </div>
                        <div className="w-8 text-right text-xs text-slate-500">{s.current}d</div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-emerald-400 transition-all"
                            style={{ width: `${Math.min(100, (s.optimal / 60) * 100)}%` }}
                          />
                        </div>
                        <div className="w-8 text-right text-xs text-emerald-600 font-medium">{s.optimal}d</div>
                      </div>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      diff > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {diff > 0 ? `+${diff}` : diff}d
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Branch-Level Sliders ─────────────────────────────
  const BranchSliders = () => {
    const config = branchConfigs.find((c) => c.branchId === selectedBranch);
    if (!config) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-medium"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-1 uppercase tracking-wider">
              🏢 {config.branchName} — Controls
            </h3>
            <p className="text-xs text-slate-400 mb-5">Branch-specific optimization parameters</p>
            <Slider
              label="Target Shelf Life"
              value={config.targetShelfLife}
              min={7}
              max={60}
              unit=" days"
              optimal={Math.max(15, Math.min(45, Math.round(config.targetShelfLife * 0.85)))}
              onChange={() => {}}
            />
            <Slider
              label="Reorder Timeline"
              value={config.reorderTimeline}
              min={5}
              max={30}
              unit=" days"
              optimal={Math.max(10, Math.min(25, Math.round(config.targetShelfLife * 0.5)))}
              onChange={() => {}}
            />
            <Slider
              label="Reorder Limit"
              value={config.reorderLimit}
              min={20}
              max={200}
              unit="%"
              optimal={Math.max(50, Math.min(120, config.reorderLimit))}
              onChange={() => {}}
            />
            <Slider
              label="Safety Stock Days"
              value={config.safetyStockDays}
              min={1}
              max={14}
              unit=" days"
              optimal={Math.max(3, Math.min(14, Math.round(config.reorderTimeline * 0.5)))}
              onChange={() => {}}
            />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-1 uppercase tracking-wider">
              📊 {config.branchName} — Optimal Values
            </h3>
            <p className="text-xs text-slate-400 mb-4">Calculated from historical demand patterns</p>
            <div className="space-y-4">
              <OptimalMetric label="Optimal Shelf Life" value={Math.max(15, Math.min(45, Math.round(config.targetShelfLife * 0.85)))} unit="days" />
              <OptimalMetric label="Reorder Timeline" value={Math.max(10, Math.min(25, Math.round(config.targetShelfLife * 0.5)))} unit="days" />
              <OptimalMetric label="Reorder Limit" value={Math.max(50, Math.min(120, config.reorderLimit))} unit="%" />
              <OptimalMetric label="Safety Stock" value={Math.max(3, Math.min(14, Math.round(config.reorderTimeline * 0.5)))} unit="days" />
              <OptimalMetric label="Discount After" value={Math.max(30, Math.min(60, Math.round(config.targetShelfLife * 1.5)))} unit="days" />
              <OptimalMetric label="Discount Rate" value={config.discountPercent} unit="%" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Supplier-Level Sliders ───────────────────────────
  const SupplierSliders = () => {
    const config = supplierConfigs.find((c) => c.supplierId === selectedSupplier);
    if (!config) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-medium"
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-1 uppercase tracking-wider">
              🤝 {config.supplierName} — Controls
            </h3>
            <p className="text-xs text-slate-400 mb-5">Supplier-specific optimization parameters</p>
            <Slider
              label="Target Shelf Life"
              value={config.targetShelfLife}
              min={7}
              max={60}
              unit=" days"
              optimal={Math.max(15, Math.min(45, Math.round(config.targetShelfLife * 0.85)))}
              onChange={() => {}}
            />
            <Slider
              label="Reorder Timeline"
              value={config.reorderTimeline}
              min={5}
              max={30}
              unit=" days"
              optimal={Math.max(config.leadTimeDays + 3, Math.min(25, Math.round(config.targetShelfLife * 0.5)))}
              onChange={() => {}}
            />
            <Slider
              label="Reorder Limit"
              value={config.reorderLimit}
              min={20}
              max={200}
              unit="%"
              optimal={Math.max(40, Math.min(150, Math.round(100 / config.reliabilityAdjustment)))}
              onChange={() => {}}
            />
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-xs text-slate-500">Lead Time: <span className="font-bold text-slate-700">{config.leadTimeDays} days</span></p>
              <p className="text-xs text-slate-500 mt-1">Reliability: <span className="font-bold text-slate-700">{Math.round(config.reliabilityAdjustment * 100)}%</span></p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-1 uppercase tracking-wider">
              📊 {config.supplierName} — Optimal Values
            </h3>
            <p className="text-xs text-slate-400 mb-4">Calculated from delivery reliability & demand</p>
            <div className="space-y-4">
              <OptimalMetric label="Optimal Shelf Life" value={Math.max(15, Math.min(45, Math.round(config.targetShelfLife * 0.85)))} unit="days" />
              <OptimalMetric label="Reorder Timeline" value={Math.max(config.leadTimeDays + 3, Math.min(25, Math.round(config.targetShelfLife * 0.5)))} unit="days" />
              <OptimalMetric label="Reorder Limit" value={Math.max(40, Math.min(150, Math.round(100 / config.reliabilityAdjustment)))} unit="%" />
              <OptimalMetric label="Safety Stock" value={Math.round(config.leadTimeDays * 0.8)} unit="days" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Demographic Sliders ──────────────────────────────
  const DemographicSliders = () => {
    const typeOptions = [
      { value: 'ageGroup', label: 'Age Group' },
      { value: 'gender', label: 'Gender' },
      { value: 'occupation', label: 'Occupation' },
      { value: 'background', label: 'Background' },
    ];

    const filtered = demographicConfigs.filter((d) => d.type === selectedDemographic);
    const maxRevenue = Math.max(...filtered.map((d) => d.stockLevelMultiplier));

    return (
      <div className="space-y-6">
        <div className="flex gap-2">
          {typeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedDemographic(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                selectedDemographic === opt.value
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {filtered.map((d) => (
            <div key={d.demographic} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">{d.demographic}</h3>
              <div className="space-y-4">
                <OptimalMetric label="Optimal Shelf Life" value={d.targetShelfLife} unit="days" />
                <OptimalMetric label="Reorder Priority" value={d.reorderPriority} unit="/3" />
                <OptimalMetric label="Stock Level Multiplier" value={d.stockLevelMultiplier} unit="x" decimals={1} />
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-amber-400"
                    style={{ width: `${(d.stockLevelMultiplier / maxRevenue) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Relative demand intensity</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Profit Impact Visualization ──────────────────────
  const ProfitImpact = () => {
    const impactData = [
      { metric: 'Holding Cost', current: result.currentHoldingCost, projected: result.projectedHoldingCost },
      { metric: 'Discount Loss', current: result.currentDiscountLoss, projected: result.projectedDiscountLoss },
      { metric: 'Stockout Loss', current: result.currentStockoutLoss, projected: result.projectedStockoutLoss },
      { metric: 'Revenue', current: result.currentRevenue, projected: result.projectedRevenue },
    ];

    const radarData = [
      { metric: 'Shelf Life', current: 60, projected: Math.max(20, Math.min(100, 100 - Math.abs(params.targetShelfLife - 30) * 2)) },
      { metric: 'Reorder Speed', current: 50, projected: Math.max(20, Math.min(100, params.reorderTimeline * 3)) },
      { metric: 'Stock Level', current: 60, projected: Math.max(20, Math.min(100, params.reorderLimitPercent * 0.67)) },
      { metric: 'Cost Efficiency', current: 70, projected: Math.max(20, Math.min(100, 100 - params.holdingCostPerDay * 1000)) },
      { metric: 'Safety Margin', current: 50, projected: Math.max(20, Math.min(100, params.safetyStockDays * 7)) },
      { metric: 'Discount Mgmt', current: 60, projected: Math.max(20, Math.min(100, 100 - params.discountPercent * 2)) },
    ];

    const marginGap = result.projectedProfitMargin - result.currentProfitMargin;
    const meetsTarget = result.meetsTarget;
    const targetDiff = result.targetProfitMargin - result.projectedProfitMargin;

    return (
      <div className="space-y-6">
        {/* Profit Margin Visual - Always prominent */}
        <div className={`rounded-xl border-2 p-5 shadow-sm transition-all duration-300 ${
          meetsTarget
            ? 'bg-emerald-50 border-emerald-300'
            : 'bg-amber-50 border-amber-300'
        }`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">{meetsTarget ? '✅' : '⚠️'}</span>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Profitability Impact
              </h3>
              <p className={`text-xs ${meetsTarget ? 'text-emerald-600' : 'text-amber-600'}`}>
                {meetsTarget
                  ? `Projected margin meets your ${result.targetProfitMargin}% target`
                  : `${targetDiff.toFixed(1)}% short of your ${result.targetProfitMargin}% target — adjust sliders below`}
              </p>
            </div>
          </div>

          {/* Margin Comparison */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
              <p className="text-[10px] text-slate-400 uppercase">Current Margin</p>
              <p className="text-xl font-bold text-slate-700">{result.currentProfitMargin.toFixed(1)}%</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${meetsTarget ? 'bg-emerald-100 border-emerald-200' : 'bg-white border-slate-100'}`}>
              <p className="text-[10px] text-slate-400 uppercase">Projected Margin</p>
              <p className={`text-xl font-bold ${meetsTarget ? 'text-emerald-700' : 'text-amber-700'}`}>
                {result.projectedProfitMargin.toFixed(1)}%
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
              <p className="text-[10px] text-slate-400 uppercase">Your Target</p>
              <p className="text-xl font-bold text-amber-600">{result.targetProfitMargin.toFixed(1)}%</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${marginGap >= 0 ? 'bg-emerald-100 border-emerald-200' : 'bg-red-100 border-red-200'}`}>
              <p className="text-[10px] text-slate-400 uppercase">Margin Change</p>
              <p className={`text-xl font-bold ${marginGap >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {marginGap >= 0 ? '+' : ''}{marginGap.toFixed(1)}%
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
              <p className="text-[10px] text-slate-400 uppercase">Profit Impact</p>
              <p className={`text-lg font-bold ${result.profitChange >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {result.profitChange >= 0 ? '+' : ''}{formatCurrency(result.profitChange)}
              </p>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="relative h-8 bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* Color gradient background */}
            <div className="absolute inset-0.5 rounded-md bg-gradient-to-r from-red-100 via-yellow-100 to-emerald-100" />
            {/* Current margin fill */}
            <div
              className="absolute h-full bg-slate-500/40 rounded-r-md transition-all duration-500"
              style={{ width: `${Math.min(100, (result.currentProfitMargin / 30) * 100)}%` }}
            />
            {/* Projected margin fill */}
            <div
              className={`absolute h-full rounded-r-md transition-all duration-500 ${
                result.projectedProfitMargin >= result.targetProfitMargin
                  ? 'bg-emerald-400/60'
                  : 'bg-amber-400/60'
              }`}
              style={{ width: `${Math.min(100, (result.projectedProfitMargin / 30) * 100)}%` }}
            />
            {/* Target marker */}
            <div
              className="absolute top-0 h-full w-1 bg-amber-600 transition-all"
              style={{ left: `${(result.targetProfitMargin / 30) * 100}%` }}
            >
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[9px] px-1.5 py-0.5 rounded-b-md font-bold whitespace-nowrap">
                TARGET {result.targetProfitMargin}%
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-slate-400">0%</span>
            <span className="text-[10px] text-slate-400">10%</span>
            <span className="text-[10px] text-slate-400">20%</span>
            <span className="text-[10px] text-slate-400">30%</span>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-slate-400/40" />
              <span className="text-slate-500">Current: {result.currentProfitMargin.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className={`w-3 h-3 rounded ${result.projectedProfitMargin >= result.targetProfitMargin ? 'bg-emerald-400/60' : 'bg-amber-400/60'}`} />
              <span className="text-slate-500">Projected: {result.projectedProfitMargin.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-amber-600" />
              <span className="text-slate-500">Target: {result.targetProfitMargin}%</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={`font-bold ${result.meetsTarget ? 'text-emerald-600' : 'text-red-500'}`}>
                {result.meetsTarget ? '✓ Target met' : '✗ Below target'}
              </span>
            </div>
          </div>
        </div>

        {/* Profit & Cost Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Current Profit</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(result.currentProfit)}</p>
            <p className="text-xs text-slate-400 mt-1">at {result.currentProfitMargin.toFixed(1)}% margin</p>
          </div>
          <div className={`rounded-xl p-5 border ${
            result.projectedProfit >= result.currentProfit
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Projected Profit</p>
            <p className={`text-xl font-bold mt-1 ${
              result.projectedProfit >= result.currentProfit ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {formatCurrency(result.projectedProfit)}
            </p>
            <p className={`text-xs mt-1 ${
              result.projectedProfit >= result.currentProfit ? 'text-emerald-500' : 'text-red-500'
            }`}>at {result.projectedProfitMargin.toFixed(1)}% margin</p>
          </div>
          <div className={`rounded-xl p-5 border ${
            result.profitChange >= 0
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Profit Change</p>
            <p className={`text-xl font-bold mt-1 ${result.profitChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {result.profitChange >= 0 ? '+' : ''}{formatCurrency(result.profitChange)}
            </p>
            <p className={`text-xs font-medium mt-1 ${result.profitChangePercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {result.profitChangePercent >= 0 ? '↑' : '↓'} {Math.abs(result.profitChangePercent)}%
            </p>
          </div>
          <div className={`rounded-xl p-5 border ${
            meetsTarget ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Target Status</p>
            <p className={`text-xl font-bold mt-1 ${meetsTarget ? 'text-emerald-600' : 'text-red-600'}`}>
              {meetsTarget ? '✅ On Track' : '⚠️ Off Target'}
            </p>
            <p className={`text-xs font-medium mt-1 ${targetDiff <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {targetDiff <= 0 ? 'Exceeds' : 'Below'} by {Math.abs(targetDiff).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Impact Comparison Bar Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Cost & Revenue Impact</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={impactData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="metric" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: unknown) => formatCurrency(Number(v))} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="current" fill="#94a3b8" name="Current" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="projected" fill={result.profitChange >= 0 ? '#10b981' : '#ef4444'} name="Projected" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cost Detail Cards */}
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs text-slate-400 uppercase">Holding Cost</p>
              <div className="flex items-end justify-between mt-1">
                <p className="text-sm text-slate-500 line-through">{formatCurrency(result.currentHoldingCost)}</p>
                <p className={`text-lg font-bold ${
                  result.projectedHoldingCost <= result.currentHoldingCost ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {formatCurrency(result.projectedHoldingCost)}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs text-slate-400 uppercase">Discount Loss</p>
              <div className="flex items-end justify-between mt-1">
                <p className="text-sm text-slate-500 line-through">{formatCurrency(result.currentDiscountLoss)}</p>
                <p className={`text-lg font-bold ${
                  result.projectedDiscountLoss <= result.currentDiscountLoss ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {formatCurrency(result.projectedDiscountLoss)}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs text-slate-400 uppercase">Stockout Loss</p>
              <div className="flex items-end justify-between mt-1">
                <p className="text-sm text-slate-500 line-through">{formatCurrency(result.currentStockoutLoss)}</p>
                <p className={`text-lg font-bold ${
                  result.projectedStockoutLoss <= result.currentStockoutLoss ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {formatCurrency(result.projectedStockoutLoss)}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs text-slate-400 uppercase">Total Cost Impact</p>
              <div className="flex items-end justify-between mt-1">
                <p className="text-sm text-slate-500">{formatCurrency(result.currentCost)}</p>
                <p className={`text-lg font-bold ${
                  result.projectedCost <= result.currentCost ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {formatCurrency(result.projectedCost)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Optimization Score by Factor</h3>
          <div className="h-72 max-w-lg mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar name="Current" dataKey="current" stroke="#94a3b8" fill="#94a3b830" strokeWidth={2} />
                <Radar name="Projected" dataKey="projected" stroke="#f59e0b" fill="#f59e0b30" strokeWidth={2} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Items affected summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Inventory Impact Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-2xl font-bold text-blue-600">{result.itemsAffected}</p>
              <p className="text-xs text-blue-500 mt-1">Items Affected</p>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-2xl font-bold text-emerald-600">{result.itemsImproved}</p>
              <p className="text-xs text-emerald-500 mt-1">Items Improved</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-100">
              <p className="text-2xl font-bold text-red-600">{result.itemsWorsened}</p>
              <p className="text-xs text-red-500 mt-1">Items Worsened</p>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Smart Recommendations</h3>
          <div className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg text-sm ${
                  rec.includes('✅')
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : rec.includes('❌')
                    ? 'bg-red-50 text-red-700 border border-red-100'
                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                }`}
              >
                {rec}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── Main Render ──────────────────────────────────────
  const viewTabs = [
    { id: 'global' as SliderView, label: '🌐 Global Controls', icon: '🌐' },
    { id: 'branch' as SliderView, label: '🏢 By Branch', icon: '🏢' },
    { id: 'supplier' as SliderView, label: '🤝 By Supplier', icon: '🤝' },
    { id: 'demographic' as SliderView, label: '👥 By Demographics', icon: '👥' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Profit Optimization Simulator</h2>
        <p className="text-slate-500 mt-1">Adjust sliders to find optimal shelf life, reorder timelines, and limits — see real-time profit impact</p>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {viewTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              view === t.id
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Profit Impact (always visible) */}
      <ProfitImpact />

      {/* View Content */}
      {view === 'global' && <GlobalSliders />}
      {view === 'branch' && <BranchSliders />}
      {view === 'supplier' && <SupplierSliders />}
      {view === 'demographic' && <DemographicSliders />}
    </div>
  );
}

// ─── OptimalMetric Component ──────────────────────────────
function OptimalMetric({ label, value, unit, decimals = 0 }: { label: string; value: number; unit: string; decimals?: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-800">
        {typeof value === 'number' && decimals > 0 ? value.toFixed(decimals) : value}{unit}
      </span>
    </div>
  );
}
