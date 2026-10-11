import React, { useEffect, useState } from 'react';
import { 
  Building2, 
  Plus, 
  ArrowLeftRight, 
  MapPin, 
  User, 
  Boxes, 
  History, 
  Eye, 
  Edit2, 
  Trash2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import Modal from '../components/Modal';

export default function Warehouses({ currentUser }) {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [transferHistory, setTransferHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [warehouseDetail, setWarehouseDetail] = useState(null);

  // Forms
  const [formData, setFormData] = useState({ name: "", location: "", manager: "", capacity: "10000" });
  const [transferData, setTransferData] = useState({
    product_id: "",
    from_warehouse_id: "",
    to_warehouse_id: "",
    quantity: "5"
  });
  const [availableStockAtSource, setAvailableStockAtSource] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [whList, prodList, history] = await Promise.all([
        api.getWarehouses(),
        api.getProducts(),
        api.getTransferHistory()
      ]);
      setWarehouses(whList);
      setProducts(prodList);
      setTransferHistory(history);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setFormData({ name: "", location: "", manager: "", capacity: "10000" });
    setFormError("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (w) => {
    setSelectedWarehouse(w);
    setFormData({
      name: w.name,
      location: w.location || "",
      manager: w.manager || "",
      capacity: w.capacity || "10000"
    });
    setFormError("");
    setShowEditModal(true);
  };

  const handleOpenDetail = async (w) => {
    setSelectedWarehouse(w);
    try {
      const detail = await api.getWarehouse(w.warehouse_id);
      setWarehouseDetail(detail);
      setShowDetailModal(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenTransfer = (defaultFromWh = "") => {
    const fromId = defaultFromWh || warehouses[0]?.warehouse_id || "";
    const toId = warehouses.find(w => w.warehouse_id !== Number(fromId))?.warehouse_id || "";
    setTransferData({
      product_id: products[0]?.product_id || "",
      from_warehouse_id: fromId,
      to_warehouse_id: toId,
      quantity: "5"
    });
    setFormError("");
    setShowTransferModal(true);
  };

  // Check source availability dynamically
  useEffect(() => {
    if (transferData.product_id && transferData.from_warehouse_id) {
      api.getInventory({
        warehouse_id: transferData.from_warehouse_id
      }).then(records => {
        const item = records.find(r => r.product_id === Number(transferData.product_id));
        setAvailableStockAtSource(item ? item.quantity : 0);
      }).catch(() => setAvailableStockAtSource(0));
    }
  }, [transferData.product_id, transferData.from_warehouse_id]);

  const handleCreateWarehouse = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await api.createWarehouse({
        ...formData,
        capacity: parseInt(formData.capacity)
      });
      setShowAddModal(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateWarehouse = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await api.updateWarehouse(selectedWarehouse.warehouse_id, {
        ...formData,
        capacity: parseInt(formData.capacity)
      });
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWarehouse = async (w) => {
    if (!window.confirm(`Delete warehouse '${w.name}'?`)) return;
    try {
      await api.deleteWarehouse(w.warehouse_id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");

    const qty = parseInt(transferData.quantity);
    if (availableStockAtSource !== null && qty > availableStockAtSource) {
      setFormError(`Cannot transfer ${qty} units. Only ${availableStockAtSource} units available in source warehouse.`);
      setSubmitting(false);
      return;
    }

    try {
      await api.transferStock({
        product_id: parseInt(transferData.product_id),
        from_warehouse_id: parseInt(transferData.from_warehouse_id),
        to_warehouse_id: parseInt(transferData.to_warehouse_id),
        quantity: qty
      });
      setShowTransferModal(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-navy-900 dark:text-white tracking-tight">Multi-Warehouse Network</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage storage locations, stock distribution, and atomic inter-warehouse transfers</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenTransfer()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-brand-600" />
            <span>Transfer Stock</span>
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Warehouse</span>
            </button>
          )}
        </div>
      </div>

      {/* Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {warehouses.map((w) => (
          <div
            key={w.warehouse_id}
            className="bg-white dark:bg-navy-900 rounded-2xl p-5 border border-slate-200 dark:border-navy-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-300 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenDetail(w)}
                    title="View Inventory"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(w)}
                    title="Edit Location"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => handleDeleteWarehouse(w)}
                      title="Delete Warehouse"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-base font-bold text-navy-900 dark:text-white">{w.name}</h3>
                <div className="mt-2 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{w.location || "Location unassigned"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Manager: {w.manager || "Unassigned"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Storage Utilization Gauge */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-navy-800">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {w.total_stock?.toLocaleString()} / {w.capacity?.toLocaleString()} units
                </span>
                <span className="font-bold text-brand-600 dark:text-brand-400">
                  {w.utilization_rate}% capacity
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    w.utilization_rate > 85 ? 'bg-rose-500' : (w.utilization_rate > 60 ? 'bg-amber-500' : 'bg-brand-600')
                  }`}
                  style={{ width: `${Math.min(100, w.utilization_rate)}%` }}
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleOpenTransfer(w.warehouse_id)}
                  className="w-full py-2 rounded-xl bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Transfer From Here</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Transfer History Table */}
      <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-brand-600" />
              <span>Inter-Warehouse Transfer Log</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Auditable records of all inventory redistributed across warehouse facilities</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-navy-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-navy-800">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">From Warehouse</th>
                <th className="py-3 px-4">To Warehouse</th>
                <th className="py-3 px-4 text-center">Units Transferred</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800 text-slate-700 dark:text-slate-200 font-medium">
              {transferHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No warehouse transfers recorded yet.
                  </td>
                </tr>
              ) : (
                transferHistory.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(t.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-navy-900 dark:text-white">
                      {t.product_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-brand-600 dark:text-brand-400">
                      {t.sku || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {t.from_warehouse}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">
                      {t.to_warehouse}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-brand-600">
                      {t.quantity} units
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Transfer Modal */}
      <Modal isOpen={showTransferModal} onClose={() => setShowTransferModal(false)} title="Transfer Stock Between Facilities">
        <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
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
              value={transferData.product_id}
              onChange={(e) => setTransferData({ ...transferData, product_id: e.target.value })}
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
            >
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name} ({p.sku || `ID-${p.product_id}`})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Source Warehouse *</label>
              <select
                required
                value={transferData.from_warehouse_id}
                onChange={(e) => setTransferData({ ...transferData, from_warehouse_id: e.target.value })}
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              >
                {warehouses.map((w) => (
                  <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>
                ))}
              </select>
              {availableStockAtSource !== null && (
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Available in source: <strong className="text-slate-700 dark:text-slate-200">{availableStockAtSource} units</strong>
                </span>
              )}
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Destination Warehouse *</label>
              <select
                required
                value={transferData.to_warehouse_id}
                onChange={(e) => setTransferData({ ...transferData, to_warehouse_id: e.target.value })}
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              >
                {warehouses
                  .filter(w => w.warehouse_id !== Number(transferData.from_warehouse_id))
                  .map((w) => (
                    <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Transfer Quantity (Units) *</label>
            <input
              type="number"
              min="1"
              required
              value={transferData.quantity}
              onChange={(e) => setTransferData({ ...transferData, quantity: e.target.value })}
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 font-mono font-bold"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-navy-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowTransferModal(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {submitting ? "Processing Transfer..." : "Execute Transfer"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Warehouse Modal */}
      <Modal isOpen={showAddModal || showEditModal} onClose={() => { setShowAddModal(false); setShowEditModal(false); }} title={showAddModal ? "Add New Warehouse Location" : "Edit Warehouse Location"}>
        <form onSubmit={showAddModal ? handleCreateWarehouse : handleUpdateWarehouse} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">{formError}</div>
          )}

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Warehouse Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. West Coast Fulfillment Center"
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Location / City</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Mumbai, India"
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Facility Manager</label>
              <input
                type="text"
                value={formData.manager}
                onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                placeholder="e.g. Anand V."
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Storage Capacity (Units)</label>
            <input
              type="number"
              min="100"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-navy-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {submitting ? "Saving..." : (showAddModal ? "Create Warehouse" : "Update Warehouse")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Warehouse Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title={`Facility: ${warehouseDetail?.name || 'Warehouse'}`}>
        {warehouseDetail && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                <span className="text-slate-400 block text-[11px]">Total Units</span>
                <strong className="text-base font-bold text-navy-900 dark:text-white">{warehouseDetail.total_units}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                <span className="text-slate-400 block text-[11px]">Retail Value</span>
                <strong className="text-base font-bold text-emerald-600">₹{warehouseDetail.total_retail_value?.toLocaleString()}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                <span className="text-slate-400 block text-[11px]">Cost Value</span>
                <strong className="text-base font-bold text-slate-700 dark:text-slate-200">₹{warehouseDetail.total_cost_value?.toLocaleString()}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                <span className="text-slate-400 block text-[11px]">Capacity Used</span>
                <strong className="text-base font-bold text-brand-600">{warehouseDetail.utilization_rate}%</strong>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 dark:text-white mb-2">Stored Product Inventory</h5>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-navy-800 border border-slate-200 dark:border-navy-800 rounded-xl">
                {warehouseDetail.inventory?.map((item) => (
                  <div key={item.inventory_id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{item.product_name}</span>
                      <span className="text-brand-600 font-mono ml-2 font-medium">{item.sku}</span>
                    </div>
                    <span className="font-bold text-navy-900 dark:text-white">{item.quantity} units</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
