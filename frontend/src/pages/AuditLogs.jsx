import { useCallback, useEffect, useState } from "react";
import { RefreshCw, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { api } from "../services/api";

function formatTimestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async ({ search: searchFilter = "", entityType: entityTypeFilter = "" } = {}) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.getAuditLogs({
        search: searchFilter.trim(),
        entity_type: entityTypeFilter.trim(),
        limit: 100,
      });
      setLogs(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || "Unable to load audit logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetFilters() {
    setSearch("");
    setEntityType("");
    load({ search: "", entityType: "" });
  }

  function refresh() {
    load({ search, entityType });
  }

  const isForbidden = error.toLowerCase().includes("admin access required");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Security &amp; governance</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Audit Logs</h1>
          <p className="mt-1 text-sm text-slate-500">Review recorded user and system activity. Showing the latest 100 matching events.</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          refresh();
        }}
        className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row"
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search audit logs</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full py-3 pl-9 pr-3"
            placeholder="Search user, action, or details"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="min-w-0 sm:w-56">
          <span className="sr-only">Filter by entity type</span>
          <input
            className="w-full p-3"
            placeholder="Entity type"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
        <button
          type="button"
          onClick={resetFilters}
          disabled={loading && !search && !entityType}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </form>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{isForbidden ? "Administrator access required" : "Could not load audit logs"}</p>
            <p className="mt-1">{isForbidden ? "Sign in with an administrator account to view the audit trail." : error}</p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Activity trail</h2>
            {!loading && !error && <p className="mt-1 text-xs text-slate-500">{logs.length} event{logs.length === 1 ? "" : "s"}</p>}
          </div>
          {loading && <span className="text-sm text-slate-500">Loading…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Time", "User", "Action", "Entity", "Details"].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr className="border-t border-slate-100" key={log.log_id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatTimestamp(log.timestamp)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{log.username || (log.user_id ? `User #${log.user_id}` : "System")}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{log.action}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {log.entity_type || "—"}{log.entity_id != null ? ` #${log.entity_id}` : ""}
                  </td>
                  <td className="max-w-md whitespace-pre-wrap break-words px-4 py-3 text-slate-600">{log.details || "—"}</td>
                </tr>
              ))}
              {!loading && !error && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <p className="font-medium text-slate-700">No audit events found</p>
                    <p className="mt-1 text-sm text-slate-500">Try adjusting the search or entity type filter.</p>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">Loading audit events…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
