const API_URL = "http://127.0.0.1:8000";

// ================================
// GET CURRENT TOKEN
// ================================
function getToken() {
    return localStorage.getItem("access_token");
}

// ================================
// AUTH HEADERS
// ================================
function authHeaders() {
    const currentToken = getToken();

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken}`
    };
}

// ================================
// LOGIN
// ================================

document
    .getElementById("loginForm")
    .addEventListener("submit", async function(event) {

        event.preventDefault();

        const username =
            document.getElementById("username").value;

        const password =
            document.getElementById("password").value;

        const message =
            document.getElementById("loginMessage");

        message.textContent = "Logging in...";

        try {

            const formData = new URLSearchParams();

            formData.append("username", username);
            formData.append("password", password);

            const response = await fetch(
                `${API_URL}/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    },
                    body: formData
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail || "Login failed"
                );
            }

            // Save JWT token
            localStorage.setItem(
                "access_token",
                data.access_token
            );

            // Show dashboard
            document
                .getElementById("loginScreen")
                .classList.add("hidden");

            document
                .getElementById("dashboardScreen")
                .classList.remove("hidden");

            // Reload page data
            loadDashboard();

        } catch (error) {

            console.error("Login error:", error);

            message.textContent =
                error.message || "Login failed.";
        }

    });


// ================================
// LOGOUT
// ================================

function logout() {

    localStorage.removeItem("access_token");

    location.reload();
}

// ================================
// LOAD DASHBOARD
// ================================
async function loadDashboard() {

    try {

        if (!getToken()) {
    console.log("No authentication token found.");
    return;
}

        const response = await fetch(
            `${API_URL}/dashboard`,
            {
                headers: authHeaders()
            }
        );

        if (!response.ok) {
            throw new Error(`Dashboard error: ${response.status}`);
        }

        const data = await response.json();

        document.getElementById("products").textContent =
            data.total_products ?? "N/A";

        document.getElementById("warehouses").textContent =
            data.total_warehouses ?? "N/A";

        document.getElementById("suppliers").textContent =
            data.total_suppliers ?? "N/A";

        document.getElementById("inventory").textContent =
            data.total_stock_units ?? "N/A";

        document.getElementById("lowStock").textContent =
            data.low_stock_items ?? "N/A";

        document.getElementById("sales").textContent =
            data.total_sales_amount ?? "N/A";

    } catch (error) {

        console.error("Dashboard error:", error);

        document.getElementById("products").textContent = "N/A";
        document.getElementById("warehouses").textContent = "N/A";
        document.getElementById("suppliers").textContent = "N/A";
        document.getElementById("inventory").textContent = "N/A";
        document.getElementById("lowStock").textContent = "N/A";
        document.getElementById("sales").textContent = "N/A";
    }
}


// ================================
// AI DEMAND PREDICTION
// ================================
async function getPrediction() {

    const productId =
        document.getElementById("productId").value;

    const result =
        document.getElementById("predictionResult");

    try {

        if (!getToken()) {
    result.textContent = "Please login first.";
    return;
}

        result.textContent = "Generating prediction...";

        const response = await fetch(
            `${API_URL}/predictions/${productId}`,
            {
                headers: authHeaders()
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Prediction failed");
        }

        if (data.predicted_demand !== undefined) {

            result.innerHTML = `
                <strong>Product ID:</strong>
                ${data.product_id}<br>

                <strong>Prediction Period:</strong>
                ${data.days_ahead} days<br>

                <strong>Predicted Demand:</strong>
                ${data.predicted_demand} units
            `;

        } else {

            result.textContent =
                data.message || "Prediction unavailable.";
        }

    } catch (error) {

        console.error("Prediction error:", error);

        result.textContent =
            error.message || "Unable to connect to FastAPI.";
    }
}


// ================================
// INTELLIGENT RESTOCKING
// ================================
async function getRestock() {

    const productId =
        document.getElementById("productId").value;

    const result =
        document.getElementById("restockResult");

    try {

        if (!getToken()) {
    result.textContent = "Please login first.";
    return;
}

        result.textContent =
            "Calculating intelligent restocking...";

        const response = await fetch(
            `${API_URL}/restock/${productId}`,
            {
                headers: authHeaders()
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Restock calculation failed");
        }

        if (
            data.recommended_restock_quantity !== undefined
        ) {

            result.innerHTML = `
                <strong>Predicted Demand:</strong>
                ${data.predicted_demand} units<br>

                <strong>Current Stock:</strong>
                ${data.current_stock} units<br>

                <strong>Recommended Restock:</strong>
                ${data.recommended_restock_quantity} units<br>

                <strong>Recommendation:</strong>
                ${data.recommendation}
            `;

        } else {

            result.textContent =
                data.message ||
                "Recommendation unavailable.";
        }

    } catch (error) {

        console.error("Restock error:", error);

        result.textContent =
            error.message ||
            "Unable to connect to FastAPI.";
    }
}


// ================================
// START DASHBOARD
// ================================
// Load dashboard only if already logged in
if (getToken()) {
    document
        .getElementById("loginScreen")
        .classList.add("hidden");

    document
        .getElementById("dashboardScreen")
        .classList.remove("hidden");

    loadDashboard();
   loadAnalytics();
loadSystemStatus();
}

/* =========================================================
   ANALYTICS DASHBOARD
   ========================================================= */

async function loadAnalytics() {

    const token = getToken();

    if (!token) {
        return;
    }

    try {

        const response = await fetch(`${API_URL}/analytics`, {
            method: "GET",
            headers: authHeaders()
        });

        if (!response.ok) {
            throw new Error("Failed to load analytics");
        }

        const data = await response.json();

        /* ---------------- Inventory Health ---------------- */

        const health = data.inventory_health;

        document.getElementById("totalInventoryItems").textContent =
            health.total_items ?? 0;

        document.getElementById("healthyStock").textContent =
            health.healthy_stock ?? 0;

        document.getElementById("analyticsLowStock").textContent =
            health.low_stock ?? 0;


        /* ---------------- Warehouse Analytics ---------------- */

        const warehouseContainer =
            document.getElementById("warehouseAnalytics");

        warehouseContainer.innerHTML = "";

        const warehouses = data.warehouse_inventory || [];

        const maxWarehouseInventory = Math.max(
            ...warehouses.map(w => Number(w.total_inventory)),
            1
        );

        warehouses.forEach(warehouse => {

            const quantity = Number(warehouse.total_inventory);

            const percentage =
                Math.min((quantity / maxWarehouseInventory) * 100, 100);

            const item = document.createElement("div");

            item.className = "analytics-item";

            item.innerHTML = `
                <div class="analytics-item-header">
                    <span>${warehouse.name}</span>
                    <span>${quantity.toLocaleString()} units</span>
                </div>

                <div class="analytics-bar">
                    <div
                        class="analytics-bar-fill"
                        style="--bar-width: ${percentage}%">
                    </div>
                </div>
            `;

            warehouseContainer.appendChild(item);
        });


        /* ---------------- Top Products ---------------- */

        const productsContainer =
            document.getElementById("topProductsAnalytics");

        productsContainer.innerHTML = "";

        const products = data.top_products || [];

        products.forEach((product, index) => {

            const sales = Number(product.total_sold);

            const item = document.createElement("div");

            item.className = "top-product";

            item.innerHTML = `
                <div class="top-product-rank">
                    #${index + 1}
                </div>

                <div class="top-product-name">
                    <strong>${product.name}</strong>
                    <span>Recorded sales quantity</span>
                </div>

                <div class="top-product-sales">
                    ${sales.toLocaleString()} units
                </div>
            `;

            productsContainer.appendChild(item);
        });


    } catch (error) {

        console.error("Analytics error:", error);

        document.getElementById("warehouseAnalytics").innerHTML =
            `<div class="analytics-loading">
                Unable to load warehouse analytics.
            </div>`;

        document.getElementById("topProductsAnalytics").innerHTML =
            `<div class="analytics-loading">
                Unable to load product analytics.
            </div>`;
    }
}


/* =========================================================
   SYSTEM STATUS
   ========================================================= */

async function loadSystemStatus() {

    try {

        const response = await fetch(`${API_URL}/health`);

        const data = await response.json();

        if (response.ok) {

            document.getElementById("apiStatus").textContent =
                "Online";

            document.getElementById("databaseStatus").textContent =
                "Connected";

        } else {

            document.getElementById("apiStatus").textContent =
                "Unavailable";

            document.getElementById("databaseStatus").textContent =
                "Unavailable";
        }

    } catch (error) {

        document.getElementById("apiStatus").textContent =
            "Offline";

        document.getElementById("databaseStatus").textContent =
            "Unavailable";
    }
}

async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`);
        const categories = await response.json();

        const select = document.getElementById("categorySelect");

        categories.forEach(category => {
            const option = document.createElement("option");
            option.value = category.category_id;
            option.textContent = category.name;
            select.appendChild(option);
        });

    } catch (error) {
        console.error("Category loading error:", error);
    }
}


async function loadSuppliers() {
    try {
        const response = await fetch(`${API_URL}/suppliers`);
        const suppliers = await response.json();

        const select = document.getElementById("supplierSelect");

        suppliers.forEach(supplier => {
            const option = document.createElement("option");
            option.value = supplier.supplier_id;
            option.textContent = supplier.name;
            select.appendChild(option);
        });

    } catch (error) {
        console.error("Supplier loading error:", error);
    }
}


async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        const products = await response.json();

        const tableBody = document.getElementById("productTableBody");

        tableBody.innerHTML = "";

        products.forEach(product => {

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${product.product_id}</td>
                <td>${product.name}</td>
                <td>${product.category_id}</td>
                <td>${product.supplier_id}</td>
                <td>₹${product.unit_price}</td>
            `;

            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Product loading error:", error);
    }
}


async function addProduct() {

    const name = document.getElementById("productName").value;
    const description = document.getElementById("productDescription").value;
    const categoryId = document.getElementById("categorySelect").value;
    const supplierId = document.getElementById("supplierSelect").value;
    const unitPrice = document.getElementById("unitPrice").value;

    const message = document.getElementById("productMessage");

    if (!name || !categoryId || !supplierId || !unitPrice) {
        message.textContent = "Please fill all required fields.";
        return;
    }

    const token = localStorage.getItem("access_token");

    try {

        const response = await fetch(`${API_URL}/products`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },

            body: JSON.stringify({
                name: name,
                description: description,
                category_id: Number(categoryId),
                supplier_id: Number(supplierId),
                unit_price: Number(unitPrice)
            })
        });

        const data = await response.json();

        if (response.ok) {

            message.textContent = "Product added successfully!";

            document.getElementById("productName").value = "";
            document.getElementById("productDescription").value = "";
            document.getElementById("categorySelect").value = "";
            document.getElementById("supplierSelect").value = "";
            document.getElementById("unitPrice").value = "";

            loadProducts();

        } else {

            message.textContent =
                data.detail || "Failed to add product.";
        }

    } catch (error) {

        message.textContent =
            "Unable to connect to FastAPI.";

        console.error(error);
    }
}

