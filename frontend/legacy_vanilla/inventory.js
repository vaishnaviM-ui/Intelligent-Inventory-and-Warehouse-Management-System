const API_URL = "http://127.0.0.1:8000";

let inventoryData = [];


/* ==========================================
   AUTHENTICATION
========================================== */

function getToken() {

    return localStorage.getItem(
        "access_token"
    );

}


function authHeaders() {

    return {

        "Content-Type":
            "application/json",

        "Authorization":
            `Bearer ${getToken()}`

    };

}


/* ==========================================
   LOGIN CHECK
========================================== */

if (!getToken()) {

    window.location.href =
        "index.html";

}


/* ==========================================
   LOAD INVENTORY
========================================== */

async function loadInventory() {

    try {

        const response =
            await fetch(
                `${API_URL}/inventory`,
                {
                    headers:
                        authHeaders()
                }
            );


        if (response.status === 401) {

            logoutUser();

            return;

        }


        if (!response.ok) {

            throw new Error(
                "Unable to load inventory"
            );

        }


        inventoryData =
            await response.json();


        renderInventory(
            inventoryData
        );


        updateSummary(
            inventoryData
        );


        generateInventoryInsight(
            inventoryData
        );


    }
    catch (error) {

        console.error(
            "Inventory Error:",
            error
        );


        document.getElementById(
            "inventoryTableBody"
        ).innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="table-loading"
                >
                    Failed to load inventory.

                </td>

            </tr>

        `;

    }

}


/* ==========================================
   RENDER TABLE
========================================== */

function renderInventory(data) {

    const tableBody =
        document.getElementById(
            "inventoryTableBody"
        );


    if (!data.length) {

        tableBody.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="table-loading"
                >
                    No inventory records found.

                </td>

            </tr>

        `;

        return;

    }


    tableBody.innerHTML =
        data.map(item => {

            const quantity =
                Number(
                    item.quantity ?? 0
                );


            const reorder =
                Number(
                    item.reorder_level ?? 0
                );


            const isLow =
                quantity <= reorder;


            return `

                <tr>

                    <td>

                        <div class="product-cell">

                            <div class="product-mini-icon">
                                📦
                            </div>

                            <div>

                                <strong>
                                    ${
                                        item.product_name
                                        ??
                                        item.name
                                        ??
                                        "Unknown Product"
                                    }
                                </strong>

                                <small>
                                    Product ID:
                                    ${
                                        item.product_id
                                        ?? "-"
                                    }
                                </small>

                            </div>

                        </div>

                    </td>


                    <td>

                        <span class="warehouse-name">

                            ${
                                item.warehouse_name
                                ??
                                item.warehouse
                                ??
                                "Warehouse"
                            }

                        </span>

                    </td>


                    <td>

                        <strong
                            class="${
                                isLow
                                ? "stock-low"
                                : "stock-healthy"
                            }"
                        >

                            ${
                                quantity.toLocaleString()
                            }

                        </strong>

                        units

                    </td>


                    <td>

                        ${
                            reorder.toLocaleString()
                        }

                        units

                    </td>


                    <td>

                        <span
                            class="${
                                isLow
                                ? "status-low"
                                : "status-healthy"
                            }"
                        >

                            ${
                                isLow
                                ? "⚠ Low Stock"
                                : "✓ Healthy"
                            }

                        </span>

                    </td>

                </tr>

            `;

        }).join("");


    document.getElementById(
        "inventoryCount"
    ).textContent =
        `${data.length} records`;

}


/* ==========================================
   UPDATE SUMMARY
========================================== */

function updateSummary(data) {

    let totalUnits = 0;

    let healthy = 0;

    let low = 0;


    data.forEach(item => {

        const quantity =
            Number(
                item.quantity ?? 0
            );


        const reorder =
            Number(
                item.reorder_level ?? 0
            );


        totalUnits += quantity;


        if (quantity <= reorder) {

            low++;

        }
        else {

            healthy++;

        }

    });


    document.getElementById(
        "totalUnits"
    ).textContent =
        totalUnits.toLocaleString();


    document.getElementById(
        "totalRecords"
    ).textContent =
        data.length;


    document.getElementById(
        "healthyRecords"
    ).textContent =
        healthy;


    document.getElementById(
        "lowStockRecords"
    ).textContent =
        low;

}


/* ==========================================
   SEARCH + FILTER
========================================== */

function filterInventory() {

    const search =
        document.getElementById(
            "inventorySearch"
        )
        .value
        .toLowerCase();


    const filter =
        document.getElementById(
            "stockFilter"
        )
        .value;


    const filtered =
        inventoryData.filter(item => {

            const product =
                String(
                    item.product_name
                    ??
                    item.name
                    ??
                    ""
                )
                .toLowerCase();


            const warehouse =
                String(
                    item.warehouse_name
                    ??
                    item.warehouse
                    ??
                    ""
                )
                .toLowerCase();


            const quantity =
                Number(
                    item.quantity ?? 0
                );


            const reorder =
                Number(
                    item.reorder_level ?? 0
                );


            const isLow =
                quantity <= reorder;


            const matchesSearch =
                product.includes(search)
                ||
                warehouse.includes(search);


            const matchesFilter =
                filter === "all"
                ||
                (filter === "low" && isLow)
                ||
                (filter === "healthy" && !isLow);


            return (
                matchesSearch &&
                matchesFilter
            );

        });


    renderInventory(
        filtered
    );

}


/* ==========================================
   INTELLIGENT INSIGHT
========================================== */

function generateInventoryInsight(data) {

    let low = 0;

    let totalUnits = 0;


    data.forEach(item => {

        const quantity =
            Number(
                item.quantity ?? 0
            );


        const reorder =
            Number(
                item.reorder_level ?? 0
            );


        totalUnits += quantity;


        if (quantity <= reorder) {

            low++;

        }

    });


    const insight =
        document.getElementById(
            "inventoryInsight"
        );


    if (low > 0) {

        insight.textContent =
            `${low} stock record(s) require attention. Review low-stock products and initiate replenishment.`;

    }
    else {

        insight.textContent =
            `All ${data.length} inventory records are currently above their reorder levels with ${totalUnits.toLocaleString()} units in stock.`;

    }

}


/* ==========================================
   LOGOUT
========================================== */

function logoutUser() {

    localStorage.removeItem(
        "access_token"
    );


    window.location.href =
        "index.html";

}


/* ==========================================
   INITIAL LOAD
========================================== */

loadInventory();


