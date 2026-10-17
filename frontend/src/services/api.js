const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

export function getToken() {
  return localStorage.getItem("access_token");
}

export function setToken(token) {
  if (token) {
    localStorage.setItem("access_token", token);
  } else {
    localStorage.removeItem("access_token");
  }
}

export function getUser() {
  const userStr = localStorage.getItem("auth_user");
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (user) {
    localStorage.setItem("auth_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("auth_user");
  }
}

export async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    "Accept": "application/json",
    ...options.headers,
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    setToken(null);
    setUser(null);
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    throw new Error("Session expired. Please log in again.");
  }

  if (response.headers.get("content-type")?.includes("text/csv")) {
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.detail || response.statusText || "Request failed";
    throw new Error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
  }

  return data;
}

export const api = {
  // Auth
  login: async (username, password) => {
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");
    return data;
  },
  register: (payload) => request("/register", { method: "POST", body: JSON.stringify(payload) }),
  getMe: () => request("/me"),
  getUsers: () => request("/users"),
  updateUserRole: (id, role) => request(`/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) }),

  // Dashboard
  getDashboardSummary: (warehouseId) => request(`/dashboard/summary${warehouseId ? `?warehouse_id=${warehouseId}` : ""}`),
  getDashboardCharts: (warehouseId) => request(`/dashboard/charts${warehouseId ? `?warehouse_id=${warehouseId}` : ""}`),

  // Products
  getProducts: (params = {}) => {
    const q = buildQuery(params);
    return request(`/products${q ? `?${q}` : ""}`);
  },
  getProduct: (id) => request(`/products/${id}`),
  createProduct: (payload) => request("/products", { method: "POST", body: JSON.stringify(payload) }),
  updateProduct: (id, payload) => request(`/products/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
  exportProductsCsv: () => `${API_BASE_URL}/products/export/csv`,
  importProductsCsv: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/products/import/csv", { method: "POST", body: formData });
  },

  // Categories
  getCategories: () => request("/categories"),
  createCategory: (payload) => request("/categories", { method: "POST", body: JSON.stringify(payload) }),
  updateCategory: (id, payload) => request(`/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: "DELETE" }),

  // Warehouses
  getWarehouses: () => request("/warehouses"),
  getWarehouse: (id) => request(`/warehouses/${id}`),
  createWarehouse: (payload) => request("/warehouses", { method: "POST", body: JSON.stringify(payload) }),
  updateWarehouse: (id, payload) => request(`/warehouses/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteWarehouse: (id) => request(`/warehouses/${id}`, { method: "DELETE" }),
  transferStock: (payload) => request("/warehouses/transfer", { method: "POST", body: JSON.stringify(payload) }),
  getTransferHistory: () => request("/warehouses/transfers/history"),

  // Inventory
  getInventory: (params = {}) => {
    const q = buildQuery(params);
    return request(`/inventory${q ? `?${q}` : ""}`);
  },
  getLowStock: () => request("/inventory/low-stock"),
  stockIn: (payload) => request("/inventory/stock-in", { method: "POST", body: JSON.stringify(payload) }),
  stockOut: (payload) => request("/inventory/stock-out", { method: "POST", body: JSON.stringify(payload) }),
  adjustStock: (payload) => request("/inventory/adjust", { method: "POST", body: JSON.stringify(payload) }),
  getMovements: (params = {}) => {
    const q = buildQuery(params);
    return request(`/inventory/movements${q ? `?${q}` : ""}`);
  },
  getValuation: (warehouseId) => request(`/inventory/valuation${warehouseId ? `?warehouse_id=${warehouseId}` : ""}`),

  // Suppliers & Purchases
  getSuppliers: () => request("/suppliers"),
  getSupplier: (id) => request(`/suppliers/${id}`),
  createSupplier: (payload) => request("/suppliers", { method: "POST", body: JSON.stringify(payload) }),
  updateSupplier: (id, payload) => request(`/suppliers/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteSupplier: (id) => request(`/suppliers/${id}`, { method: "DELETE" }),

  getPurchases: (params = {}) => {
    const q = buildQuery(params);
    return request(`/purchases${q ? `?${q}` : ""}`);
  },
  getPurchase: (id) => request(`/purchases/${id}`),
  createPurchase: (payload) => request("/purchases", { method: "POST", body: JSON.stringify(payload) }),
  updatePurchaseStatus: (id, status) => request(`/purchases/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  receivePurchaseGoods: (id) => request(`/purchases/${id}/receive`, { method: "POST" }),

  // Sales
  getSales: (params = {}) => {
    const q = buildQuery(params);
    return request(`/sales${q ? `?${q}` : ""}`);
  },
  getSale: (id) => request(`/sales/${id}`),
  createSale: (payload) => request("/sales", { method: "POST", body: JSON.stringify(payload) }),
  returnSale: (id, payload = {}) => request(`/sales/${id}/return`, { method: "POST", body: JSON.stringify(payload) }),

  // AI & Restock
  trainAI: () => request("/ai/train", { method: "POST" }),
  getForecast: (productId, days = 30) => request(`/ai/forecast/${productId}?days=${days}`),
  getRestockRecommendations: (warehouseId) => request(`/ai/restock-recommendations${warehouseId ? `?warehouse_id=${warehouseId}` : ""}`),
  convertRecommendationToPO: (payload) => request("/ai/convert-recommendation-to-po", { method: "POST", body: JSON.stringify(payload) }),

  // Notifications & Audit
  getNotifications: () => request("/notifications"),
  getUnreadCount: () => request("/notifications/unread-count"),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: "PUT" }),
  markAllNotificationsRead: () => request("/notifications/read-all", { method: "PUT" }),
  getAuditLogs: (params = {}) => {
    const q = buildQuery(params);
    return request(`/audit-logs${q ? `?${q}` : ""}`);
  },

  // Reports
  exportInventoryCsv: () => request("/reports/inventory/csv"),
  exportMovementsCsv: () => request("/reports/movements/csv"),
  exportSalesCsv: () => request("/reports/sales/csv"),
};
