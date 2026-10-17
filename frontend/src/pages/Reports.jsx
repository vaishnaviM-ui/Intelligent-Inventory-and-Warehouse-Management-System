import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Download,
  FileSpreadsheet,
  Package,
  RefreshCw,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../services/api";

const chartColors = ["#4f46e5", "#0284c7", "#059669", "#d97706", "#db2777", "#7c3aed"];

const exports = [
  {
    id: "inventory",
    title: "Inventory Report",
    description: "On-hand quantities, reorder levels, valuation, and stock status.",
    filename: "inventory_report.csv",
    download: api.exportInventoryCsv,
    icon: Boxes,
  },
  {
    id: "movements",
    title: "Stock Movement Report",
    description: "The latest 500 stock transactions across your warehouses.",
    filename: "stock_movements_report.csv",
    download: api.exportMovementsCsv,
    icon: FileSpreadsheet,
  },
  {
    id: "sales",
    title: "Sales Report",
    description: "Completed sales, customers, order values, and item counts.",
    filename: "sales_report.csv",
    download: api.exportSalesCsv,
    icon: ShoppingCart,
  },
];

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");
  const [downloadError, setDownloadError] = useState("");

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryResult, chartResult] = await Promise.all([
        api.getDashboardSummary(),
        api.getDashboardCharts(),
      ]);
      setSummary(summaryResult);
      setCharts(chartResult);
    } catch (err) {
      setError(err.message || "Unable to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  async function downloadReport(report) {
    setDownloading(report.id);
    setDownloadError("");
    try {
      const blob = await report.download();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = report.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      setDownloadError(`${report.title}: ${err.message || "Download failed."}`);
    } finally {
      setDownloading("");
    }
  }

  const metrics = [
    {
      label: "Products",
      value: summary?.total_products,
      detail: "Catalog items",
      icon: Package,
      color: "bg-indigo-50 text-indigo-700",
    },
    {
      label: "Stock units",
      value: summary?.total_stock_units?.toLocaleString(),
      detail: `${summary?.total_warehouses ?? 0} warehouses`,
      icon: Boxes,
      color: "bg-sky-50 text-sky-700",
    },
    {
      label: "Retail valuation",
      value: formatCurrency(summary?.inventory_valuation_retail),
      detail: `Cost ${formatCurrency(summary?.inventory_valuation_cost)}`,
      icon: Warehouse,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Completed sales",
      value: summary?.total_completed_orders?.toLocaleString(),
      detail: formatCurrency(summary?.total_sales_amount),
      icon: ShoppingCart,
      color: "bg-violet-50 text-violet-700",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Business intelligence</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Reports &amp; Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Live inventory and sales metrics with downloadable reports.</p>
        </div>
        <button
          type="button"
          onClick={loadAnalytics}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={loadAnalytics} className="font-semibold underline">Try again</button>
        </div>
      )}
      {downloadError && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{downloadError}</p>
      )}

      <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, detail, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className={`rounded-lg p-2 ${color}`}><Icon className="h-4 w-4" /></span>
            </div>
            <p className="mt-3 truncate text-2xl font-bold tracking-tight text-slate-900">
              {loading && !summary ? <span className="text-slate-300">Loading</span> : value ?? "—"}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-5">
        <div className="rounded-xl border bg-white p-5 xl:col-span-3">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">Monthly sales revenue</h2>
            <p className="mt-1 text-sm text-slate-500">Completed and confirmed sales from the database.</p>
          </div>
          <div className="h-72">
            {charts?.sales_trends?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.sales_trends} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e9edf4" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value).toLocaleString()}`} />
                  <Tooltip formatter={(value) => [formatCurrency(value), "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} fill="url(#reportRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
                {loading ? "Loading sales data…" : "No sales trend data available yet."}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 xl:col-span-2">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">Stock by category</h2>
            <p className="mt-1 text-sm text-slate-500">Current units grouped by product category.</p>
          </div>
          <div className="h-72">
            {charts?.category_distribution?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts.category_distribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                    {charts.category_distribution.map((item, index) => (
                      <Cell key={`${item.name}-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} units`, "Stock"]} />
                  <Legend verticalAlign="bottom" height={34} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
                {loading ? "Loading inventory data…" : "No category stock data available yet."}
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Data exports</h2>
          <p className="mt-1 text-sm text-slate-500">CSV exports use your authenticated session and contain current backend records.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {exports.map(({ id, title, description, icon: Icon, ...report }) => (
            <article key={id} className="flex flex-col rounded-xl border bg-white p-5">
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{description}</p>
              <button
                type="button"
                onClick={() => downloadReport({ id, title, ...report })}
                disabled={Boolean(downloading)}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {downloading === id ? "Preparing CSV…" : "Download CSV"}
              </button>
            </article>
          ))}
        </div>
      </section>

      {summary && (summary.low_stock_items > 0 || summary.pending_purchase_orders > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            {summary.low_stock_items > 0 && `${summary.low_stock_items} low-stock item${summary.low_stock_items === 1 ? "" : "s"}`}
            {summary.low_stock_items > 0 && summary.pending_purchase_orders > 0 && " · "}
            {summary.pending_purchase_orders > 0 && `${summary.pending_purchase_orders} pending purchase order${summary.pending_purchase_orders === 1 ? "" : "s"}`}
          </span>
        </div>
      )}
    </div>
  );
}
