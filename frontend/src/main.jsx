
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import Warehouses from "./pages/Warehouses";
import Auth from "./pages/Auth";
import Suppliers from "./pages/Suppliers";
import Sales from "./pages/Sales";
import DemandForecast from "./pages/DemandForecast";
import Restock from "./pages/Restock";
import Reports from "./pages/Reports";
import AuditLogs from "./pages/AuditLogs";
import {
  getToken,
  getUser,
  setToken,
  setUser,
} from "./services/api";
import "./index.css";

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [token, setCurrentToken] = useState(() => getToken());
  const [currentUser, setCurrentUser] = useState(() => getUser());

  useEffect(() => {
    function handleUnauthorized() {
      setCurrentToken(null);
      setCurrentUser(null);
    }

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  function handleAuthenticated(user) {
    setCurrentToken(getToken());
    setCurrentUser(user);
    setActiveTab("dashboard");
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    setCurrentToken(null);
    setCurrentUser(null);
    setActiveTab("dashboard");
  }

  function renderPage() {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard setActiveTab={setActiveTab} />;
      case "products":
        return <Products />;
      case "inventory":
        return <Inventory />;
      case "warehouses":
        return <Warehouses />;
      case "purchases":
        return <Suppliers />;
      case "sales":
        return <Sales />;
      case "ai_demand":
        return <DemandForecast />;
      case "restock":
        return <Restock />;
      case "reports":
        return <Reports />;
      case "audit_logs":
        return <AuditLogs />;
      default:
        return (
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <h1 className="text-2xl font-bold text-slate-900">
              {activeTab
                .replaceAll("_", " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </h1>
            <p className="mt-2 text-slate-500">
              This module will be connected to the backend in the next step.
            </p>
          </div>
        );
    }
  }

  if (!token || !currentUser) {
    return <Auth onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main
        className={`min-h-screen p-4 pt-20 transition-all duration-300 sm:p-6 sm:pt-6 ${
          isCollapsed ? "md:ml-20" : "md:ml-64"
        }`}
      >
        {renderPage()}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
