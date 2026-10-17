
import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function DemandForecast() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [days, setDays] = useState(30);
  const [forecast, setForecast] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getProducts().then(p => {
      setProducts(Array.isArray(p) ? p : []);
      if (p?.length) setProductId(String(p[0].product_id));
    }).catch(e => setMessage(e.message));
  }, []);

  async function train() {
    setBusy(true); setMessage("");
    try {
      const result = await api.trainAI();
      setMessage(typeof result === "string" ? result : JSON.stringify(result));
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function predict(e) {
    e.preventDefault(); setBusy(true); setMessage(""); setForecast(null);
    try { setForecast(await api.getForecast(Number(productId), Number(days))); }
    catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">AI Demand Forecast</h1>
    <div className="rounded-xl border bg-white p-5">
      <p className="mb-3 text-slate-600">Train the existing AI model using available historical sales data.</p>
      <button onClick={train} disabled={busy} className="rounded-lg bg-violet-600 px-5 py-3 text-white disabled:opacity-50">
        Train AI Model
      </button>
    </div>
    <form onSubmit={predict} className="grid gap-3 rounded-xl border bg-white p-5 md:grid-cols-3">
      <select className="rounded-lg border p-3" value={productId} onChange={e => setProductId(e.target.value)} required>
        {products.map(p => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
      </select>
      <select className="rounded-lg border p-3" value={days} onChange={e => setDays(e.target.value)}>
        <option value="7">Next 7 days</option><option value="30">Next 30 days</option><option value="90">Next 90 days</option>
      </select>
      <button disabled={busy || !productId} className="rounded-lg bg-blue-600 p-3 text-white disabled:opacity-50">Generate Forecast</button>
    </form>
    {message && <p className="break-words rounded-lg bg-slate-100 p-3">{message}</p>}
    {forecast && <div className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">{forecast.product_name}</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-4"><p className="text-sm text-slate-500">Predicted demand</p><p className="text-2xl font-bold">{forecast.total_predicted_demand}</p></div>
        <div className="rounded-lg bg-slate-50 p-4"><p className="text-sm text-slate-500">Current stock</p><p className="text-2xl font-bold">{forecast.current_stock}</p></div>
        <div className="rounded-lg bg-slate-50 p-4"><p className="text-sm text-slate-500">Risk level</p><p className="text-xl font-bold">{forecast.risk_level}</p></div>
      </div>
      <p>Model: {forecast.model_used} {forecast.is_baseline_model ? "(baseline)" : ""}</p>
      <p>{forecast.explanation}</p>
      <h3 className="font-semibold">Daily predictions</h3>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr className="bg-slate-100"><th className="p-2">Day</th><th className="p-2">Date</th><th className="p-2">Predicted quantity</th></tr></thead>
        <tbody>{(forecast.daily_predictions || []).map((d, i) => <tr className="border-t" key={i}><td className="p-2">{d.day}</td><td className="p-2">{d.date}</td><td className="p-2">{d.predicted_demand ?? d.predicted_quantity ?? d.quantity ?? "—"}</td></tr>)}</tbody>
      </table></div>
    </div>}
  </div>;
}
