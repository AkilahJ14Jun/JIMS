import React from 'react';
import type { Page } from './types';
import { suppliers, branches, inventoryItems, customers, sales } from './data/mockData';
import { getProfitability, getReorderAlerts } from './utils/analytics';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Branches from './components/Branches';
import SupplierPage from './components/Suppliers';
import AnalyticsPage from './components/Analytics';
import ShelfLifePage from './components/ShelfLifePage';
import ReorderAlertPage from './components/ReorderAlertPage';
import ProfitOptimizer from './components/Optimizer/ProfitOptimizer';
import StockRecommendations from './components/StockRecommendations';

export default function App() {
  const [currentPage, setCurrentPage] = React.useState<Page>('dashboard');

  const profitability = getProfitability(inventoryItems, sales, branches, suppliers);
  const reorderAlerts = getReorderAlerts(inventoryItems, suppliers);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            items={inventoryItems}
            suppliers={suppliers}
            branches={branches}
            sales={sales}
            profitability={profitability}
            reorderCount={reorderAlerts.length}
          />
        );
      case 'inventory':
        return <Inventory items={inventoryItems} suppliers={suppliers} branches={branches} />;
      case 'branches':
        return <Branches branches={branches} items={inventoryItems} suppliers={suppliers} sales={sales} />;
      case 'suppliers':
        return <SupplierPage suppliers={suppliers} items={inventoryItems} sales={sales} branches={branches} />;
      case 'analytics':
        return <AnalyticsPage items={inventoryItems} sales={sales} branches={branches} suppliers={suppliers} customers={customers} />;
      case 'shelflife':
        return <ShelfLifePage items={inventoryItems} suppliers={suppliers} branches={branches} />;
      case 'reorder':
        return <ReorderAlertPage items={inventoryItems} suppliers={suppliers} branches={branches} />;
      case 'optimizer':
        return <ProfitOptimizer items={inventoryItems} sales={sales} branches={branches} suppliers={suppliers} customers={customers} />;
      case 'stockrec':
        return <StockRecommendations items={inventoryItems} sales={sales} branches={branches} suppliers={suppliers} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} reorderCount={reorderAlerts.length} />
      <div className="ml-64 transition-all duration-300">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-slate-800">JewelStock</h1>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                {suppliers.filter((s) => s.isActive).length} Suppliers · {branches.length} Branches · {inventoryItems.length} Items
              </span>
            </div>
            <div className="flex items-center gap-3">
              {reorderAlerts.filter((a) => a.priority === 'Critical').length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-medium text-red-600">
                    {reorderAlerts.filter((a) => a.priority === 'Critical').length} Critical
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-bold">
                  JS
                </div>
                <div className="text-sm">
                  <p className="font-medium text-slate-700">Admin</p>
                  <p className="text-xs text-slate-400">Inventory Manager</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
