import React, { useEffect, useState } from 'react';
import { 
  Boxes, 
  ArrowDownLeft, 
  ArrowUpRight, 
  SlidersHorizontal, 
  Download, 
  AlertTriangle, 
  Search, 
  Building2, 
  DollarSign, 
  History, 
  CheckCircle, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import Modal from '../components/Modal';

export default function Inventory({ currentUser }) {
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [valuation, setValuation] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' or 'movements'

  // Modals
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [stockInData, setStockInData] = useState({
    product_id: '',
    warehouse_id: '',
    quantity: '10',
    reference: '',
    notes: ''
  });

  const [stockOutData, setStockOutData] = useState({
    product_id: '',
    warehouse_id: '',
    quantity: '5',
    reference: '',
    notes: ''
  });

  const [adjustData, setAdjustData] = useState({
    product_id: '',
    warehouse_id: '',
    actual_quantity: '',
    reason: 'Physical inventory audit reconciliation'
  });

  const [currentAvailableStock, setCurrentAvailableStock] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invData, whData, prodData, movData, valData] = await Promise.all([
        api.getInventory(warehouseFilter ? { warehouse_id: warehouseFilter } : {}),
        api.getWarehouses(),
        api.getProducts(),
        api.getMovements(warehouseFilter ? { warehouse_id: warehouseFilter } : {}),
        api.getValuation(warehouseFilter || undefined)
      ]);
      setInventory(invData);
      setWarehouses(whData);
      setProducts(prodData);
      setMovements(movData);
      setValuation(valData);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [warehouseFilter]);

  // Handle Dynamic Stock Lookup for Stock-Out and Adjust
  useEffect(() => {
    if (showStockOutModal && stockOutData.product_id && stockOutData.warehouse_id) {
      const match = inventory.find(
        (i) => i.product_id === Number(stockOutData.product_id) && i.warehouse_id === Number(stockOutData.warehouse_id)
      );
      setCurrentAvailableStock(match ? match.quantity : 0);
    }
  }, [showStockOutModal, stockOutData.product_id, stockOutData.warehouse_id, inventory]);

  useEffect(() => {
    if (showAdjustModal && adjustData.product_id && adjustData.warehouse_id) {
      const match = inventory.find(
        (i) => i.product_id === Number(adjustData.product_id) && i.warehouse_id === Number(adjustData.warehouse_id)
      );
      if (match) {
        setAdjustData(prev => ({ ...prev, actual_quantity: match.quantity.toString() }));
      }
    }
  }, [showAdjustModal, adjustData.product_id, adjustData.warehouse_id, inventory]);

  const handleOpenStockIn = () => {
    setStockInData({
      product_id: products[0]?.product_id || '',
      warehouse_id: warehouses[0]?.warehouse_id || '',
      quantity: '10',
      reference: 'INVOICE-STOCK-IN',
      notes: 'Standard warehouse replenishment'
    });
    setFormError('');
    setShowStockInModal(true);
  };

  const handleOpenStockOut = () => {
    const prodId = products[0]?.product_id || '';
    const whId = warehouses[0]?.warehouse_id || '';
    setStockOutData({
      product_id: prodId,
      warehouse_id: whId,
      quantity: '5',
      reference: 'DIRECT-DISPATCH',
      notes: 'Customer order fulfillment'
    });
    setFormError('');
    setShowStockOutModal(true);
  };

  const handleOpenAdjust = () => {
    const prodId = products[0]?.product_id || '';
    const whId = warehouses[0]?.warehouse_id || '';
    const match = inventory.find(i => i.product_id === Number(prodId) && i.warehouse_id === Number(whId));
    setAdjustData({
      product_id: prodId,
      warehouse_id: whId,
      actual_quantity: match ? match.quantity.toString() : '0',
      reason: 'Physical inventory cycle audit count'
    });
    setFormError('');
    setShowAdjustModal(true);
  };

  const handleStockInSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      await api.stockIn({
        product_id: parseInt(stockInData.product_id),
        warehouse_id: parseInt(stockInData.warehouse_id),
        quantity: parseInt(stockInData.quantity),
        reference: stockInData.reference,
        notes: stockInData.notes
      });
      setShowStockInModal(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStockOutSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    const qty = parseInt(stockOutData.quantity);
    if (currentAvailableStock !== null && qty > currentAvailableStock) {
      setFormError(`Insufficient stock. Current on-hand is ${currentAvailableStock} units.`);
      setSubmitting(false);
      return;
    }

    try {
      await api.stockOut({
        product_id: parseInt(stockOutData.product_id),
        warehouse_id: parseInt(stockOutData.warehouse_id),
        quantity: qty,
        reference: stockOutData.reference,
        notes: stockOutData.notes
      });
      setShowStockOutModal(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      await api.adjustStock({
        product_id: parseInt(adjustData.product_id),
        warehouse_id: parseInt(adjustData.warehouse_id),
        actual_quantity: parseInt(adjustData.actual_quantity),
        reason: adjustData.reason
      });
      setShowAdjustModal(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = 
      item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.warehouse_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (lowStockOnly) {
      return matchesSearch && item.is_low_stock;
    }
    return matchesSearch;
  });

  const lowStockCount = inventory.filter(i => i.is_low_stock).length;
  const totalStockUnits = inventory.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-navy-900 dark:text-white tracking-tight">Stock & Inventory Operations</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Real-time ledger tracking, stock intake, dispatch, and physical adjustments</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenStockIn}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Stock In</span>
          </button>

          <button
            onClick={handleOpenStockOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Stock Out</span>
          </button>

          <button
            onClick={handleOpenAdjust}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-bold shadow-2xs transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
            <span>Reconcile / Adjust</span>
          </button>

          <a
            href={api.exportInventoryCsv()}
            download
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-navy-900 rounded-2xl p-4 border border-slate-200 dark:border-navy-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total On-Hand Units</span>
            <div className="text-2xl font-black text-navy-900 dark:text-white mt-1">
              {totalStockUnits.toLocaleString()}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-300 flex items-center justify-center font-bold">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-navy-900 rounded-2xl p-4 border border-slate-200 dark:border-navy-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Retail Valuation</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              ₹{valuation?.total_retail_value?.toLocaleString() || '0'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-navy-900 rounded-2xl p-4 border border-slate-200 dark:border-navy-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cost Inventory Value</span>
            <div className="text-2xl font-black text-slate-700 dark:text-slate-200 mt-1">
              ₹{valuation?.total_cost_value?.toLocaleString() || '0'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-navy-900 rounded-2xl p-4 border border-slate-200 dark:border-navy-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Low Stock Alerts</span>
            <div className="text-2xl font-black text-rose-600 mt-1">
              {lowStockCount} items
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'stock'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
            }`}
          >
            Live Stock Records
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'movements'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Movement Audit Trail</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Warehouse Dropdown */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-1.5 text-xs border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.warehouse_id} value={w.warehouse_id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Low Stock Toggle */}
          {activeTab === 'stock' && (
            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                lowStockOnly
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  : 'bg-slate-50 dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              <span>Low Stock ({lowStockCount})</span>
            </button>
          )}

          {/* Search Field */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search product or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-xs overflow-hidden">
        {activeTab === 'stock' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-navy-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-navy-800">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Warehouse Facility</th>
                  <th className="py-3 px-4 text-center">On-Hand Stock</th>
                  <th className="py-3 px-4 text-center">Reorder Point</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-right">Total Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800 text-slate-700 dark:text-slate-200 font-medium">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      No stock records matched your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => (
                    <tr key={item.inventory_id} className="hover:bg-slate-50/70 dark:hover:bg-navy-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-navy-900 dark:text-white">
                        {item.product_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-brand-600 dark:text-brand-400 font-medium">
                        {item.sku || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {item.warehouse_name}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-navy-900 dark:text-white">
                        <span className="text-sm">{item.quantity}</span> units
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {item.reorder_level}
                      </td>
                      <td className="py-3 px-4">
                        {item.is_low_stock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400">
                            <AlertCircle className="w-3 h-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            Optimal
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        ₹{item.price ? Number(item.price).toFixed(2) : '0.00'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 font-mono">
                        ₹{((item.quantity || 0) * (item.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-navy-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-navy-800">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4 text-center">Quantity Delta</th>
                  <th className="py-3 px-4">Reference / Reason</th>
                  <th className="py-3 px-4">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800 text-slate-700 dark:text-slate-200 font-medium">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      No stock movement audit records found.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.transaction_id} className="hover:bg-slate-50/70 dark:hover:bg-navy-800/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-navy-900 dark:text-white">
                        {m.product_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {m.warehouse_name}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            m.transaction_type === 'IN'
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400'
                          }`}
                        >
                          {m.transaction_type === 'IN' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {m.transaction_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span className={m.transaction_type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>
                          {m.transaction_type === 'IN' ? `+${m.quantity}` : `-${m.quantity}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {m.reason || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {m.user_name || 'System Auto'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock In Modal */}
      <Modal isOpen={showStockInModal} onClose={() => setShowStockInModal(false)} title="Receive Stock (Stock-In)">
        <form onSubmit={handleStockInSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Select Product *</label>
            <select
              required
              value={stockInData.product_id}
              onChange={(e) => setStockInData({ ...stockInData, product_id: e.target.value })}
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
            >
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name} ({p.sku || `ID-${p.product_id}`})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Destination Warehouse *</label>
            <select
              required
              value={stockInData.warehouse_id}
              onChange={(e) => setStockInData({ ...stockInData, warehouse_id: e.target.value })}
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
            >
              {warehouses.map((w) => (
                <option key={w.warehouse_id} value={w.warehouse_id}>
                  {w.name} ({w.location || 'Central'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Quantity Received *</label>
              <input
                type="number"
                min="1"
                required
                value={stockInData.quantity}
                onChange={(e) => setStockInData({ ...stockInData, quantity: e.target.value })}
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 font-mono font-bold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Doc / Batch Ref</label>
              <input
                type="text"
                value={stockInData.reference}
                onChange={(e) => setStockInData({ ...stockInData, reference: e.target.value })}
                placeholder="e.g. BL-90823"
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Notes / Remarks</label>
            <input
              type="text"
              value={stockInData.notes}
              onChange={(e) => setStockInData({ ...stockInData, notes: e.target.value })}
              placeholder="e.g. Supplier delivery verified"
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-navy-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowStockInModal(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Confirm Stock Intake'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock Out Modal */}
      <Modal isOpen={showStockOutModal} onClose={() => setShowStockOutModal(false)} title="Dispatch Stock (Stock-Out)">
        <form onSubmit={handleStockOutSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Select Product *</label>
            <select
              required
              value={stockOutData.product_id}
              onChange={(e) => setStockOutData({ ...stockOutData, product_id: e.target.value })}
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
            >
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name} ({p.sku || `ID-${p.product_id}`})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Source Warehouse *</label>
            <select
              required
              value={stockOutData.warehouse_id}
              onChange={(e) => setStockOutData({ ...stockOutData, warehouse_id: e.target.value })}
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
            >
              {warehouses.map((w) => (
                <option key={w.warehouse_id} value={w.warehouse_id}>
                  {w.name}
                </option>
              ))}
            </select>
            {currentAvailableStock !== null && (
              <span className="text-[11px] text-slate-400 mt-1 block">
                Available on hand: <strong className="text-slate-800 dark:text-white">{currentAvailableStock} units</strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Dispatch Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={stockOutData.quantity}
                onChange={(e) => setStockOutData({ ...stockOutData, quantity: e.target.value })}
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 font-mono font-bold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Doc / Dispatch Ref</label>
              <input
                type="text"
                value={stockOutData.reference}
                onChange={(e) => setStockOutData({ ...stockOutData, reference: e.target.value })}
                placeholder="e.g. DISP-7741"
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Reason / Purpose</label>
            <input
              type="text"
              value={stockOutData.notes}
              onChange={(e) => setStockOutData({ ...stockOutData, notes: e.target.value })}
              placeholder="e.g. Wholesale fulfillment"
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-navy-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowStockOutModal(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Confirm Dispatch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust Stock Reconciliation Modal */}
      <Modal isOpen={showAdjustModal} onClose={() => setShowAdjustModal(false)} title="Inventory Count Reconciliation">
        <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300">
            <strong>Auditable Event:</strong> This adjustment will record a differential IN/OUT transaction in the ledger to match the actual physical count.
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Product *</label>
            <select
              required
              value={adjustData.product_id}
              onChange={(e) => setAdjustData({ ...adjustData, product_id: e.target.value })}
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
            >
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name} ({p.sku || `ID-${p.product_id}`})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Warehouse *</label>
            <select
              required
              value={adjustData.warehouse_id}
              onChange={(e) => setAdjustData({ ...adjustData, warehouse_id: e.target.value })}
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
            >
              {warehouses.map((w) => (
                <option key={w.warehouse_id} value={w.warehouse_id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Actual Physical Count (Units) *</label>
            <input
              type="number"
              min="0"
              required
              value={adjustData.actual_quantity}
              onChange={(e) => setAdjustData({ ...adjustData, actual_quantity: e.target.value })}
              placeholder="e.g. 50"
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 font-mono font-bold"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Reason for Variance *</label>
            <input
              type="text"
              required
              value={adjustData.reason}
              onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
              placeholder="e.g. Quarterly physical cycle count reconciliation"
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-navy-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAdjustModal(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50"
            >
              {submitting ? 'Applying...' : 'Apply Reconciliation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
