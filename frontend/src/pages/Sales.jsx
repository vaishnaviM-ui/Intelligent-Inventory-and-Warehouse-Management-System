
import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customer, setCustomer] = useState("Walk-in Customer");
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [s, p, w] = await Promise.all([
        api.getSales(), api.getProducts(), api.getWarehouses()
      ]);
      setSales(Array.isArray(s) ? s : []);
      setProducts(Array.isArray(p) ? p : []);
      setWarehouses(Array.isArray(w) ? w : []);
      if (w?.length) setWarehouseId(String(w[0].warehouse_id));
      if (p?.length) setProductId(String(p[0].product_id));
    } catch (e) { setMessage(e.message); }
  }

  useEffect(() => { load(); }, []);

  async function createOrder(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api.createSale({
        customer_name: customer,
        warehouse_id: Number(warehouseId),
        items: [{ product_id: Number(productId), quantity: Number(quantity) }]
      });
      setMessage("Sales order created successfully.");
      await load();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Sales Orders</h1>
    {message && <p className="rounded-lg bg-slate-100 p-3">{message}</p>}
    <form onSubmit={createOrder} className="grid gap-3 rounded-xl border bg-white p-5 md:grid-cols-2">
      <input className="rounded-lg border p-3" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name" />
      <select className="rounded-lg border p-3" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
        <option value="">Select warehouse</option>
        {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name || w.warehouse_name || `Warehouse ${w.warehouse_id}`}</option>)}
      </select>
      <select className="rounded-lg border p-3" value={productId} onChange={e => setProductId(e.target.value)} required>
        <option value="">Select product</option>
        {products.map(p => <option key={p.product_id} value={p.product_id}>{p.name} — Stock: {p.total_stock ?? "—"}</option>)}
      </select>
      <input className="rounded-lg border p-3" type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} required />
      <button disabled={busy || !warehouseId || !productId} className="rounded-lg bg-blue-600 p-3 font-semibold text-white disabled:opacity-50 md:col-span-2">
        {busy ? "Creating..." : "Create Sales Order"}
      </button>
    </form>
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-100"><tr>{["Order ID","Customer","Warehouse","Date","Amount","Status"].map(x => <th key={x} className="p-3">{x}</th>)}</tr></thead>
        <tbody>{sales.map(s => <tr className="border-t" key={s.sale_id}>
          <td className="p-3">#{s.sale_id}</td><td className="p-3">{s.customer_name}</td>
          <td className="p-3">{s.warehouse_name || s.warehouse_id}</td><td className="p-3">{s.sale_date || "—"}</td>
          <td className="p-3">{Number(s.total_amount || 0).toFixed(2)}</td><td className="p-3">{s.status}</td>
        </tr>)}</tbody>
      </table>
      {!sales.length && <p className="p-5 text-slate-500">No sales orders found.</p>}
    </div>
  </div>;
}
