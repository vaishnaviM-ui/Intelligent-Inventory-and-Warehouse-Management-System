import React, { useState } from 'react';
import { API_BASE_URL } from "../services/api";
import { 
  Search, 
  Bell, 
  Sun, 
  Moon, 
  User, 
  LogOut, 
  Shield, 
  ExternalLink 
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  isCollapsed, 
  currentUser, 
  unreadCount, 
  onOpenNotifications, 
  darkMode, 
  setDarkMode, 
  onLogout,
  onGlobalSearch 
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const pageTitles = {
    dashboard: "Executive Dashboard",
    products: "Products & Catalog Management",
    warehouses: "Multi-Warehouse Locations",
    inventory: "Stock Operations & Ledger",
    purchases: "Suppliers & Purchasing",
    sales: "Sales & Order Fulfillment",
    ai_demand: "AI-Powered Demand Forecasting",
    restock: "Intelligent Restocking Engine",
    reports: "Reports & Business Intelligence",
    audit_logs: "Security & Operational Audit Trail",
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (onGlobalSearch) {
      onGlobalSearch(e.target.value);
    }
  };

  return (
    <header 
      className={`fixed top-0 right-0 z-30 h-16 bg-white/90 dark:bg-navy-900/90 backdrop-blur-md border-b border-slate-200 dark:border-navy-800 transition-all duration-300 ease-in-out px-4 sm:px-8 flex items-center justify-between ${
        isCollapsed ? 'left-20' : 'left-64'
      }`}
    >
      {/* Page Title & Breadcrumb */}
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-navy-900 dark:text-white tracking-tight">
            {pageTitles[activeTab] || "Inventory Overview"}
          </h2>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <span>Platform</span>
            <span>/</span>
            <span className="capitalize font-medium text-slate-600 dark:text-slate-300">{activeTab.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Global Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Search */}
        <div className="relative hidden md:block w-64 lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search SKU, products, orders..."
            className="w-full bg-slate-100 dark:bg-navy-800/80 text-xs text-slate-900 dark:text-slate-100 rounded-xl pl-9 pr-4 py-2 border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-navy-800 focus:outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Live Status indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>System Live</span>
        </div>

        {/* Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Notification Bell */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce shadow-sm">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
              {currentUser?.name?.[0]?.toUpperCase() || "U"}
            </div>
          </button>

          {showProfileMenu && (
            <div 
              className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-xl py-2 text-xs z-50 animate-in fade-in zoom-in-95 duration-150"
              onMouseLeave={() => setShowProfileMenu(false)}
            >
              <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-800">
                <p className="font-bold text-slate-900 dark:text-white truncate">{currentUser?.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{currentUser?.email}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-300 font-semibold text-[10px] uppercase">
                  <Shield className="w-3 h-3" />
                  {currentUser?.role?.replace('_', ' ') || "Staff"}
                </div>
              </div>

              {API_BASE_URL && (
                <a
                  href={`${API_BASE_URL}/docs`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between px-4 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                >
                  <span>Swagger API Docs</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              )}

              <a
                href={`${import.meta.env.BASE_URL}legacy_vanilla/index.html`}
                className="flex items-center justify-between px-4 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
              >
                <span>Legacy Vanilla View</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>

              <div className="border-t border-slate-100 dark:border-navy-800 mt-1 pt-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
