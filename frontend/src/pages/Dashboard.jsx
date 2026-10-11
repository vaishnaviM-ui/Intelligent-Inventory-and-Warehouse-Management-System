import React, { useEffect, useState } from 'react';
import { 
  Package, 
  Boxes, 
  Warehouse, 
  Truck, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { 
  AreaChart, Area, 
  BarChart, Bar, 
  PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { api } from '../services/api';

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function Dashboard({ setActiveTab }) {
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");

  const loadData = async (whId = "") => {
    setLoading(true);
    try {
      const [sumData, chartData, whList] = await Promise.all([
        api.getDashboardSummary(whId),
        api.getDashboardCharts(whId),
        api.getWarehouses()
      ]);
      setSummary(sumData);
      setCharts(chartData);
      setWarehouses(whList);
    } catch (err) {
      console.error("Dashboard loading error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedWarehouse);
  }, [selectedWarehouse]);

  if (loading && !summary) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-navy-800 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-200 dark:bg-navy-800 rounded-2xl" />
          <div className="h-80 bg-slate-200 dark:bg-navy-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: "Total Products",
      value: summary?.total_products || 0,
      subtext: "Catalog SKU items",
      icon: Package,
      color: "from-blue-600 to-indigo-600",
      action: () => setActiveTab("products")
    },
    {
      label: "Stock Units",
      value: (summary?.total_stock_units || 0).toLocaleString(),
      subtext: `Across ${summary?.total_warehouses || 3} warehouses`,
      icon: Boxes,
      color: "from-indigo-600 to-purple-600",
      action: () => setActiveTab("inventory")
    },
    {
      label: "Inventory Valuation",
      value: `₹${(summary?.inventory_valuation_retail || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      subtext: `Cost: ₹${(summary?.inventory_valuation_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "from-emerald-600 to-teal-600",
      action: () => setActiveTab("reports")
    },
    {
      label: "Low Stock Items",
      value: summary?.low_stock_items || 0,
      subtext: `${summary?.out_of_stock_items || 0} out of stock`,
      icon: AlertTriangle,
      color: summary?.low_stock_items > 0 ? "from-amber-500 to-rose-500" : "from-slate-600 to-slate-700",
      isWarning: summary?.low_stock_items > 0,
      action: () => setActiveTab("restock")
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            Operations Center
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900 dark:text-white mt-1">
            Intelligent Inventory Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time multi-warehouse analytics, movement auditing, and predictive demand insights
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="bg-slate-50 dark:bg-navy-800 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-xl px-3.5 py-2.5 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>
            ))}
          </select>

          <button
            onClick={() => setActiveTab("ai_demand")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 hover:brightness-105 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Forecasts</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              onClick={kpi.action}
              className="bg-white dark:bg-navy-900 rounded-2xl p-5 border border-slate-200 dark:border-navy-800 shadow-xs hover:shadow-md hover:border-brand-500/40 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </span>
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${kpi.color} text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-2xl font-bold text-navy-900 dark:text-white tracking-tight">
                  {kpi.value}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center justify-between">
                  <span>{kpi.subtext}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Rechart */}
        <div className="lg:col-span-2 bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-navy-800 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Revenue Analytics</span>
              <h3 className="text-base font-bold text-navy-900 dark:text-white mt-0.5">Historical Sales Revenue (Monthly)</h3>
            </div>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> Database-backed
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts?.sales_trends || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip 
                  formatter={(val) => [`₹${Number(val).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Stock Distribution Pie */}
        <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-navy-800 shadow-xs flex flex-col">
          <div className="mb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Inventory Distribution</span>
            <h3 className="text-base font-bold text-navy-900 dark:text-white mt-0.5">Stock by Category</h3>
          </div>

          <div className="h-64 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts?.category_distribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {(charts?.category_distribution || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val) => [`${val} units`, 'Units']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Second Row: Warehouse Utilization & Fast/Slow Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Warehouse Capacity Distribution Bar */}
        <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-navy-800 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Capacity & Stock</span>
              <h3 className="text-base font-bold text-navy-900 dark:text-white mt-0.5">Warehouse Storage Utilization</h3>
            </div>
            <button onClick={() => setActiveTab("warehouses")} className="text-xs text-brand-600 font-semibold hover:underline">
              Manage Warehouses →
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.warehouse_distribution || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip 
                  formatter={(val, name) => [val, name === 'stock' ? 'Current Units' : 'Total Capacity']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="stock" fill="#4f46e5" radius={[6, 6, 0, 0]} name="Current Stock" />
                <Bar dataKey="capacity" fill="#cbd5e1" radius={[6, 6, 0, 0]} name="Capacity" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fast Moving vs Slow Moving Products */}
        <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-navy-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Product Velocity</span>
                <h3 className="text-base font-bold text-navy-900 dark:text-white mt-0.5">Fast-Moving Items</h3>
              </div>
              <button onClick={() => setActiveTab("reports")} className="text-xs text-brand-600 font-semibold hover:underline">
                Full Turnover Report →
              </button>
            </div>

            <div className="space-y-3">
              {(charts?.fast_moving || []).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-navy-800/50">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{item.name}</h4>
                      <p className="text-[11px] text-slate-400">Total units sold: {item.units_sold}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    ₹{Number(item.revenue).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-navy-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">Restock urgency detection active</span>
            <button
              onClick={() => setActiveTab("restock")}
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
            >
              <span>View AI Restock Recommendations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
