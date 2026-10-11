import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Edit2, 
  Trash2, 
  Eye, 
  FolderPlus,
  AlertCircle,
  CheckCircle2,
  Package
} from 'lucide-react';
import { api } from '../services/api';
import Modal from '../components/Modal';

export default function Products({ currentUser }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productDetail, setProductDetail] = useState(null);

  // Forms
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    description: "",
    category_id: "",
    supplier_id: "",
    unit_price: "",
    cost_price: "",
    initial_stock: "0",
    initial_warehouse_id: "",
    reorder_level: "10"
  });
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [formError, setFormError] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, cats, sups, whs] = await Promise.all([
        api.getProducts({
          search: search || undefined,
          category_id: selectedCategory || undefined,
          stock_status: selectedStatus || undefined
        }),
        api.getCategories(),
        api.getSuppliers(),
        api.getWarehouses()
      ]);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(sups);
      setWarehouses(whs);
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedCategory, selectedStatus]);

  const handleOpenAdd = () => {
    setFormData({
      name: "",
      sku: "",
      description: "",
      category_id: categories[0]?.category_id || "",
      supplier_id: suppliers[0]?.supplier_id || "",
      unit_price: "",
      cost_price: "",
      initial_stock: "10",
      initial_warehouse_id: warehouses[0]?.warehouse_id || "",
      reorder_level: "10"
    });
    setFormError("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (p) => {
    setSelectedProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku || "",
      description: p.description || "",
      category_id: p.category_id,
      supplier_id: p.supplier_id,
      unit_price: p.unit_price,
      cost_price: p.cost_price || ""
    });
    setFormError("");
    setShowEditModal(true);
  };

  const handleOpenDetail = async (p) => {
    setSelectedProduct(p);
    try {
      const detail = await api.getProduct(p.product_id);
      setProductDetail(detail);
      setShowDetailModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await api.createProduct({
        ...formData,
        unit_price: parseFloat(formData.unit_price),
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : undefined,
        initial_stock: parseInt(formData.initial_stock || 0),
        reorder_level: parseInt(formData.reorder_level || 10),
        category_id: parseInt(formData.category_id),
        supplier_id: parseInt(formData.supplier_id),
        initial_warehouse_id: formData.initial_warehouse_id ? parseInt(formData.initial_warehouse_id) : undefined
      });
      setShowAddModal(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await api.updateProduct(selectedProduct.product_id, {
        name: formData.name,
        sku: formData.sku,
        description: formData.description,
        category_id: parseInt(formData.category_id),
        supplier_id: parseInt(formData.supplier_id),
        unit_price: parseFloat(formData.unit_price),
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : undefined
      });
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (p) => {
    if (!window.confirm(`Are you sure you want to delete '${p.name}' (${p.sku})? This cannot be undone.`)) return;
    try {
      await api.deleteProduct(p.product_id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      await api.createCategory({ name: newCategoryName, description: newCategoryDesc });
      setNewCategoryName("");
      setNewCategoryDesc("");
      const cats = await api.getCategories();
      setCategories(cats);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      await api.deleteCategory(catId);
      const cats = await api.getCategories();
      setCategories(cats);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) return;
    setSubmitting(true);
    try {
      const res = await api.importProductsCsv(importFile);
      setImportResult(res);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "In Stock":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "Low Stock":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "Out of Stock":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-navy-900 dark:text-white tracking-tight">Product Catalog</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage products, categories, SKU identification, and catalog records</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <a
            href={api.exportProductsCsv()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={() => { setShowImportModal(true); setImportResult(null); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => setShowCategoryModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Categories</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, or Product ID..."
            className="w-full bg-slate-50 dark:bg-navy-800 text-xs text-slate-900 dark:text-slate-100 rounded-xl pl-9 pr-4 py-2.5 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 dark:bg-navy-800 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 w-full md:w-44"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 dark:bg-navy-800 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 w-full md:w-40"
          >
            <option value="">All Stock Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-navy-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-navy-800">
              <tr>
                <th className="py-3.5 px-4">SKU / ID</th>
                <th className="py-3.5 px-4">Product Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4 text-right">Unit Price</th>
                <th className="py-3.5 px-4 text-right">Cost Price</th>
                <th className="py-3.5 px-4 text-center">Total Stock</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800 text-slate-700 dark:text-slate-200 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">Loading catalog items...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.product_id} className="hover:bg-slate-50/70 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-brand-600 dark:text-brand-400">
                      {p.sku || `ID-${p.product_id}`}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-navy-900 dark:text-white">{p.name}</div>
                      {p.description && <div className="text-[11px] text-slate-400 truncate max-w-xs">{p.description}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {p.category_name || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {p.supplier_name || "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-navy-900 dark:text-white">
                      ₹{Number(p.unit_price).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400 font-mono">
                      ₹{Number(p.cost_price || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold">
                      {p.total_stock}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(p.stock_status)}`}>
                        {p.stock_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => handleOpenDetail(p)}
                        title="View details"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(p)}
                        title="Edit product"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={() => handleDeleteProduct(p)}
                          title="Delete product"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Product to Catalog">
        <form onSubmit={handleCreateProduct} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Ergonomic Keyboard"
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">SKU (Leave blank to auto-generate)</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                placeholder="e.g. SKU-KEY-001"
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed specifications or notes"
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Category *</label>
              <select
                required
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              >
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Supplier *</label>
              <select
                required
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              >
                {suppliers.map((s) => (
                  <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Selling Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                placeholder="0.00"
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Cost Price (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                placeholder="Defaults to 70% of price"
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Initial Stock Units</label>
              <input
                type="number"
                min="0"
                value={formData.initial_stock}
                onChange={(e) => setFormData({ ...formData, initial_stock: e.target.value })}
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Destination Warehouse</label>
              <select
                value={formData.initial_warehouse_id}
                onChange={(e) => setFormData({ ...formData, initial_warehouse_id: e.target.value })}
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              >
                {warehouses.map((w) => (
                  <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-navy-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Product"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Product Details">
        <form onSubmit={handleUpdateProduct} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Product Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Selling Price (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Cost Price (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                className="w-full bg-slate-50 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-navy-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {submitting ? "Updating..." : "Update Product"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Product Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Product Inventory Specification">
        {productDetail && (
          <div className="space-y-6 text-xs">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-navy-800/60 border border-slate-200 dark:border-navy-700">
              <div>
                <h4 className="text-base font-bold text-navy-900 dark:text-white">{productDetail.name}</h4>
                <p className="font-mono text-brand-600 dark:text-brand-400 font-bold mt-0.5">{productDetail.sku || "N/A"}</p>
                <p className="text-slate-500 mt-1">{productDetail.description || "No description provided."}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-navy-900 dark:text-white">₹{productDetail.unit_price}</div>
                <div className="text-slate-400 font-mono">Cost: ₹{productDetail.cost_price}</div>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 dark:text-white mb-3">Warehouse Stock Distribution</h5>
              <div className="space-y-2">
                {productDetail.warehouse_stocks?.length === 0 ? (
                  <p className="text-slate-400 py-3">No stock allocated to any warehouse yet.</p>
                ) : (
                  productDetail.warehouse_stocks?.map((ws) => (
                    <div key={ws.warehouse_id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{ws.warehouse_name}</span>
                        <span className="text-slate-400 ml-2">Threshold: {ws.reorder_level}</span>
                      </div>
                      <span className="font-bold text-sm text-navy-900 dark:text-white">{ws.quantity} units</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Category Management Modal */}
      <Modal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Manage Categories">
        <div className="space-y-6 text-xs">
          <form onSubmit={handleCreateCategory} className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-navy-800/40 border border-slate-200 dark:border-navy-700">
            <h5 className="font-bold text-slate-900 dark:text-white">Create New Category</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category Name *"
                className="bg-white dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              />
              <input
                type="text"
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
                placeholder="Category Description"
                className="bg-white dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-brand-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition-colors"
            >
              Add Category
            </button>
          </form>

          <div>
            <h5 className="font-bold text-slate-900 dark:text-white mb-2">Existing Categories</h5>
            <div className="divide-y divide-slate-100 dark:divide-navy-800">
              {categories.map((c) => (
                <div key={c.category_id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{c.name}</span>
                    {c.description && <span className="text-slate-400 ml-2">({c.description})</span>}
                  </div>
                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => handleDeleteCategory(c.category_id)}
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* CSV Bulk Import Modal */}
      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Import Products from CSV">
        <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
          <p className="text-slate-500">
            Upload a CSV file with columns: <code className="font-mono text-brand-600 bg-slate-100 dark:bg-navy-800 px-1 py-0.5 rounded">name, sku, description, category, supplier, unit_price, cost_price</code>.
          </p>

          <input
            type="file"
            accept=".csv"
            required
            onChange={(e) => setImportFile(e.target.files[0])}
            className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
          />

          {importResult && (
            <div className={`p-3 rounded-xl ${importResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800'}`}>
              <p className="font-bold">Successfully imported {importResult.imported_count} products!</p>
              {importResult.errors?.length > 0 && (
                <ul className="list-disc pl-4 mt-2 space-y-1 text-[11px] text-rose-600">
                  {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 dark:border-navy-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowImportModal(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800 text-xs font-semibold"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting || !importFile}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {submitting ? "Uploading & Validating..." : "Import CSV File"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
