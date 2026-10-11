const API_URL = "http://127.0.0.1:8000";

function logoutUser() {
    localStorage.removeItem("access_token");
    location.href = "index.html";
}

async function apiRequest(path, options = {}) {
    const headers = { Accept: "application/json", ...options.headers };
    const token = localStorage.getItem("access_token");
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body) headers["Content-Type"] = "application/json";

    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.detail || `Request failed (${response.status})`);
    }
    return data;
}

function setOptions(select, items, label, valueKey, nameKey, optional = false) {
    select.replaceChildren(new Option(label, ""));
    for (const item of items) {
        select.add(new Option(item[nameKey], item[valueKey]));
    }
    select.required = !optional;
}

function renderProducts(products) {
    const body = document.getElementById("productTableBody");
    body.replaceChildren();
    if (!products.length) {
        const row = body.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7;
        cell.textContent = "No products found.";
        return;
    }

    for (const product of products) {
        const row = body.insertRow();
        for (const value of [
            product.sku || "—",
            product.name,
            product.category_name || "—",
            product.supplier_name || "—",
            Number(product.unit_price).toFixed(2),
            product.total_stock,
            product.stock_status
        ]) {
            row.insertCell().textContent = value ?? "—";
        }
    }
}

async function loadProducts() {
    const message = document.getElementById("productMessage");
    message.textContent = "Loading product catalog...";
    try {
        const [products, categories, suppliers, warehouses] = await Promise.all([
            apiRequest("/products"),
            apiRequest("/categories"),
            apiRequest("/suppliers"),
            localStorage.getItem("access_token")
                ? apiRequest("/warehouses")
                : Promise.resolve([])
        ]);
        renderProducts(products);
        document.getElementById("productCount").textContent = `${products.length} products`;
        setOptions(document.getElementById("productCategory"), categories, "Select category", "category_id", "name");
        setOptions(document.getElementById("productSupplier"), suppliers, "Select supplier", "supplier_id", "name");
        setOptions(document.getElementById("initialWarehouse"), warehouses, "No opening warehouse", "warehouse_id", "name", true);
        message.textContent = localStorage.getItem("access_token")
            ? ""
            : "Catalog is read-only. Log in to create products.";
    } catch (error) {
        message.textContent = `Could not load products: ${error.message}`;
        document.getElementById("productCount").textContent = "Unavailable";
    }
}

document.getElementById("productForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("productMessage");
    const initialStock = Number(document.getElementById("initialStock").value);
    const warehouseValue = document.getElementById("initialWarehouse").value;

    if (!localStorage.getItem("access_token")) {
        message.textContent = "Log in with an inventory-manager or admin account to create products.";
        return;
    }
    if (initialStock > 0 && !warehouseValue) {
        message.textContent = "Select a warehouse when opening stock is greater than zero.";
        return;
    }

    const costValue = document.getElementById("costPrice").value;
    const payload = {
        name: document.getElementById("productName").value.trim(),
        sku: document.getElementById("productSku").value.trim() || null,
        description: document.getElementById("productDescription").value.trim() || null,
        category_id: Number(document.getElementById("productCategory").value),
        supplier_id: Number(document.getElementById("productSupplier").value),
        unit_price: Number(document.getElementById("unitPrice").value),
        cost_price: costValue ? Number(costValue) : null,
        initial_stock: initialStock,
        initial_warehouse_id: warehouseValue ? Number(warehouseValue) : null,
        reorder_level: Number(document.getElementById("reorderLevel").value)
    };

    const button = document.getElementById("createProductButton");
    button.disabled = true;
    message.textContent = "Creating product...";
    try {
        await apiRequest("/products", { method: "POST", body: JSON.stringify(payload) });
        document.getElementById("productForm").reset();
        document.getElementById("initialStock").value = "0";
        document.getElementById("reorderLevel").value = "10";
        await loadProducts();
        message.textContent = "Product created successfully.";
    } catch (error) {
        message.textContent = `Product was not created: ${error.message}`;
    } finally {
        button.disabled = false;
    }
});

loadProducts();
