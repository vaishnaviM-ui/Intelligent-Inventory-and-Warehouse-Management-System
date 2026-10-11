import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Building2, 
  Boxes, 
  Truck, 
  ShoppingCart, 
  BrainCircuit, 
  Sparkles, 
  BarChart3, 
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserCheck
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, isCollapsed, setIsCollapsed, currentUser, onLogout }) {
  const navSections = [
    {
      title: "OVERVIEW",
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      ]
    },
    {
      title: "OPERATIONS",
      items: [
        { id: "products", label: "Products & Catalog", icon: Package },
        { id: "warehouses", label: "Multi-Warehouse", icon: Building2 },
        { id: "inventory", label: "Stock Operations", icon: Boxes },
      ]
    },
    {
      title: "COMMERCE",
      items: [
        { id: "purchases", label: "Purchases & Suppliers", icon: Truck },
        { id: "sales", label: "Sales Orders", icon: ShoppingCart },
      ]
    },
    {
      title: "AI INTELLIGENCE",
      items: [
        { id: "ai_demand", label: "Demand Forecast", icon: BrainCircuit, badge: "AI" },
        { id: "restock", label: "Restock Engine", icon: Sparkles, badge: "Smart" },
      ]
    },
    {
      title: "ANALYTICS & GOVERNANCE",
      items: [
        { id: "reports", label: "Reports & Analytics", icon: BarChart3 },
        { id: "audit_logs", label: "Audit Logs", icon: ShieldCheck, adminOnly: true },
      ]
    }
  ];

  const getRoleBadgeColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'inventory_manager':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <aside 
      className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 ease-in-out bg-white dark:bg-navy-900 border-r border-slate-200 dark:border-navy-800 flex flex-col ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 dark:border-navy-800">
        <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-brand-500/20">
            <span className="text-xl">📦</span>
          </div>
          {!isCollapsed && (
            <div className="truncate">
              <h1 className="text-base font-bold tracking-tight text-navy-900 dark:text-white leading-tight">
                SmartInventory
              </h1>
              <p className="text-[11px] font-medium text-brand-600 dark:text-brand-400">
                Enterprise Logistics
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 dark:hover:text-slate-200 transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navSections.map((section, sIdx) => {
          // Filter out admin items if not admin
          const visibleItems = section.items.filter(
            item => !item.adminOnly || currentUser?.role === 'admin'
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx}>
              {!isCollapsed && (
                <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  {section.title}
                </h3>
              )}
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 group relative ${
                          isActive
                            ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
                            : 'text-slate-600 hover:text-navy-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-navy-800/60'
                        } ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <Icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-navy-800 dark:group-hover:text-slate-200'
                        }`} />
                        
                        {!isCollapsed && (
                          <span className="truncate flex-1 text-left">{item.label}</span>
                        )}

                        {!isCollapsed && item.badge && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            isActive 
                              ? 'bg-white/20 text-white' 
                              : 'bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300'
                          }`}>
                            {item.badge}
                          </span>
                        )}

                        {/* Collapsed active dot */}
                        {isCollapsed && isActive && (
                          <span className="absolute right-1 w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
        <div className={`flex items-center gap-3 p-2 rounded-xl ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-200 to-indigo-100 dark:from-navy-800 dark:to-indigo-950 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold shrink-0 border border-slate-200 dark:border-navy-700">
            {currentUser?.name?.[0]?.toUpperCase() || <UserCheck className="w-4 h-4" />}
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {currentUser?.name || "Staff Member"}
              </p>
              <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 border rounded mt-0.5 uppercase tracking-wide ${getRoleBadgeColor(currentUser?.role)}`}>
                {currentUser?.role?.replace('_', ' ') || "Staff"}
              </span>
            </div>
          )}

          {!isCollapsed && (
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-white dark:hover:bg-navy-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
