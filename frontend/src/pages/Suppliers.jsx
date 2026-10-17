
import React, { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Truck,
  Mail,
  Phone,
  MapPin,
  X,
  RefreshCw,
} from "lucide-react";
import { api } from "../services/api";

const emptyForm = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSuppliers = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await api.getSuppliers();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Could not load suppliers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const openAddForm = () => {
    setEditingSupplier(null);
    setForm({ ...emptyForm });
    setError("");
    setNotice("");
    setShowForm(true);
  };

  const openEditForm = (supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name || "",
      contact_person: supplier.contact_person || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
    });
    setError("");
    setNotice("");
    setShowForm(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      name: form.name.trim(),
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
    };

    if (!payload.name) {
      setError("Supplier name is required.");
      setSaving(false);
      return;
    }

    try {
      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.supplier_id, payload);
        setNotice("Supplier updated successfully.");
      } else {
        await api.createSupplier(payload);
        setNotice("Supplier added successfully.");
      }

      setShowForm(false);
      setForm({ ...emptyForm });
      setEditingSupplier(null);
      await loadSuppliers();
    } catch (err) {
      setError(err.message || "Unable to save supplier.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier) => {
    const confirmed = window.confirm(
      `Delete supplier "${supplier.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await api.deleteSupplier(supplier.supplier_id);
      setNotice("Supplier deleted successfully.");
      await loadSuppliers();
    } catch (err) {
      setError(err.message || "Unable to delete supplier.");
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const text = search.toLowerCase();

    return [
      supplier.name,
      supplier.contact_person,
      supplier.email,
      supplier.phone,
      supplier.address,
    ].some((value) => String(value || "").toLowerCase().includes(text));
  });

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-indigo-600">
            COMMERCE / SUPPLIER MANAGEMENT
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
            Suppliers
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage supplier contacts and supplier records.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus size={18} />
          Add Supplier
        </button>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {error && !showForm && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Total Suppliers</p>
          <div className="mt-3 flex items-center justify-between">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              {suppliers.length}
            </h2>
            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <Truck size={23} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Search Results</p>
          <div className="mt-3 flex items-center justify-between">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              {filteredSuppliers.length}
            </h2>
            <button
              onClick={loadSuppliers}
              title="Refresh suppliers"
              className="rounded-xl bg-slate-100 p-3 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              <RefreshCw size={21} />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, contact, email or phone..."
            className={`${inputClass} pl-10`}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Supplier Directory
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            Loading suppliers...
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="mx-auto mb-3 text-slate-400" size={38} />
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              No suppliers found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Add a supplier or change your search.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-5 py-4">Supplier</th>
                  <th className="px-5 py-4">Contact Person</th>
                  <th className="px-5 py-4">Contact Details</th>
                  <th className="px-5 py-4">Address</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.supplier_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {supplier.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        ID: {supplier.supplier_id}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {supplier.contact_person || "—"}
                    </td>

                    <td className="px-5 py-4">
                      {supplier.email && (
                        <div className="mb-1 flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          <Mail size={14} />
                          {supplier.email}
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          <Phone size={14} />
                          {supplier.phone}
                        </div>
                      )}
                      {!supplier.email && !supplier.phone && "—"}
                    </td>

                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      <div className="flex items-start gap-2">
                        {supplier.address && <MapPin size={15} className="mt-0.5 shrink-0" />}
                        <span>{supplier.address || "—"}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditForm(supplier)}
                          title="Edit supplier"
                          className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                        >
                          <Edit2 size={17} />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier)}
                          title="Delete supplier (admin only)"
                          className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="my-auto w-full max-w-xl rounded-2xl bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingSupplier ? "Edit Supplier" : "Add Supplier"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the supplier's contact information.
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              {error && (
                <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Supplier Name *
                </label>
                <input
                  required
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Enter supplier name"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Contact Person
                </label>
                <input
                  name="contact_person"
                  value={form.contact_person}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Enter contact person's name"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Phone
                  </label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="supplier@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Address
                </label>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows={3}
                  className={inputClass}
                  placeholder="Supplier address"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : editingSupplier ? "Save Changes" : "Add Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
