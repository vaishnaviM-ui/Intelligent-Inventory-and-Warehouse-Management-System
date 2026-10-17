
import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function Restock() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      const [r, w] = await Promise.all([api.getRestockRecommendations(warehouseId || undefined), api.getWarehouses()]);
      setItems(Array.isArray(r) ? r : []);
      setWarehouses(Array.isArray(w) ? w : []);
    } catch (e) { setMessage(e.message); }
  }
  useEffect(() => { load(); }, [warehouseId]);

  async function convert(item) {
    if (!warehouseId) {
      setMessage("Select a warehouse first.");
      return;
    }
    setBusyId(item.product_id); setMessage("");
    try {
      await api.convertRecommendationToPO({
        product_id: item.product_id,
        warehouse_id: Number(warehouseId),
        quantity: item.recommended_order_quantity,
        supplier_id: item.suggested_supplier_id
      });
      setMessage(`Purchase order request submitted for ${item.product_name}.`);
      await load();
    } catch (e) { setMessage(`Could not create purchase order: ${e.message}. Check the backend request schema.`); }
    finally { setBusyId(null); }
  }

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">AI Restock Engine</h1>
    {message && <p className="break-words rounded-lg bg-slate-100 p-3">{message}</p>}
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
      <label className="font-medium">Warehouse</label>
      <select className="rounded-lg border p-3" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
        <option value="">All warehouses</option>
        {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name || w.warehouse_name || `Warehouse ${w.warehouse_id}`}</option>)}
      </select>
      <button onClick={load} className="rounded-lg bg-blue-600 px-4 py-3 text-white">Refresh</button>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {items.map(item => <div key={item.product_id} className="space-y-3 rounded-xl border bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="font-bold">{item.product_name}</h2><p className="text-sm text-slate-500">SKU: {item.sku || "—"} · {item.category_name || "Uncategorized"}</p></div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm">{item.urgency}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <p>Current stock: <b>{item.current_stock}</b></p>
          <p>Reorder level: <b>{item.reorder_level}</b></p>
          <p>Predicted 30-day demand: <b>{item.predicted_demand_30d}</b></p>
          <p>Pending PO units: <b>{item.pending_po_units}</b></p>
          <p>Recommended quantity: <b>{item.recommended_order_quantity}</b></p>
          <p>Estimated cost: <b>{Number(item.estimated_cost || 0).toFixed(2)}</b></p>
          <p>Suggested supplier: <b>{item.suggested_supplier_name || "Not specified"}</b></p>
          <p>Days until stockout: <b>{item.days_until_stockout ?? "Unknown"}</b></p>
        </div>
        <p className="text-sm text-slate-600">{item.explanation}</p>
        <button disabled={busyId === item.product_id} onClick={() => convert(item)} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {busyId === item.product_id ? "Submitting..." : "Convert to Purchase Order"}
        </button>
      </div>)}
    </div>
    {!items.length && <p className="rounded-xl border bg-white p-5 text-slate-500">No restock recommendations returned.</p>}
  </div>;
}
