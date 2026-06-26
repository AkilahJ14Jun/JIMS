import React from 'react';
import type { Page } from '../types';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  reorderCount: number;
}

const navItems: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: '📊' },
  { page: 'inventory', label: 'Inventory', icon: '💎' },
  { page: 'branches', label: 'Branches', icon: '🏢' },
  { page: 'suppliers', label: 'Suppliers', icon: '🤝' },
  { page: 'analytics', label: 'Analytics', icon: '📈' },
  { page: 'shelflife', label: 'Shelf Life', icon: '⏱️' },
  { page: 'reorder', label: 'Reorder', icon: '🔄' },
  { page: 'optimizer', label: 'Optimizer', icon: '⚡' },
  { page: 'stockrec', label: 'Stock Rec.', icon: '📦' },
];

export default function Sidebar({ currentPage, onNavigate, reorderCount }: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside
      className={`flex flex-col bg-slate-900 text-white transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      } fixed left-0 top-0 h-full z-50`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
          JS
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold tracking-wide">JewelStock</h1>
            <p className="text-[10px] text-slate-400">Inventory Pro</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map(({ page, label, icon }) => {
          const isActive = currentPage === page;
          const showBadge = page === 'reorder' && reorderCount > 0;
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-amber-500/20 text-amber-300 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title={collapsed ? label : undefined}
            >
              <span className="text-lg flex-shrink-0">{icon}</span>
              {!collapsed && (
                <span className="flex-1 text-left font-medium">{label}</span>
              )}
              {!collapsed && showBadge && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                  {reorderCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-slate-700">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm"
        >
          <span className="text-lg">{collapsed ? '→' : '←'}</span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
