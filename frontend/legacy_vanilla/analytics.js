const API_URL = "http://127.0.0.1:8000";


function getToken() {
    return localStorage.getItem("access_token");
}


function authHeaders() {

    const token = getToken();

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };

}


/* ==========================================
   CHECK LOGIN
========================================== */

if (!getToken()) {

    window.location.href = "index.html";

}


/* ==========================================
   LOAD ANALYTICS
========================================== */

async function loadAnalytics() {

    try {

        const response = await fetch(
            `${API_URL}/analytics`,
            {
                headers: authHeaders()
            }
        );


        if (response.status === 401) {

            logoutUser();
            return;

        }


        if (!response.ok) {

            throw new Error(
                "Failed to load analytics"
            );

        }


        const data = await response.json();


        /* =====================================
           KPI DATA
        ===================================== */

        document.getElementById(
            "totalItems"
        ).textContent =
            data.inventory_health.total_items;


        document.getElementById(
            "healthyStock"
        ).textContent =
            data.inventory_health.healthy_stock;


        document.getElementById(
            "lowStock"
        ).textContent =
            data.inventory_health.low_stock;


        document.getElementById(
            "productsTracked"
        ).textContent =
            data.top_products.length;


        /* =====================================
           CREATE CHARTS
        ===================================== */

        createSalesChart(
            data.monthly_sales
        );


        createHealthChart(
            data.inventory_health
        );


        createWarehouseChart(
            data.warehouse_inventory
        );


        createCategoryChart(
            data.category_inventory
        );


        createProductsChart(
            data.top_products
        );


        generateInsight(data);


    } catch (error) {

        console.error(
            "Analytics Error:",
            error
        );

        document.getElementById(
            "analyticsInsight"
        ).textContent =
            "Unable to load analytics data.";

    }

}


/* ==========================================
   MONTHLY SALES CHART
========================================== */

function createSalesChart(data) {

    const labels = data.map(
        item => item.month
    );

    const values = data.map(
        item => Number(item.total_sales)
    );


    new Chart(
        document.getElementById("salesChart"),
        {

            type: "line",

            data: {

                labels: labels,

                datasets: [

                    {
                        label: "Sales",

                        data: values,

                        tension: 0.4,

                        fill: true,

                        borderWidth: 3,

                        pointRadius: 5
                    }

                ]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: true
                    }

                },

                scales: {

                    y: {

                        beginAtZero: true,

                        ticks: {

                            callback: function(value) {

                                return "₹" +
                                    Number(value)
                                    .toLocaleString();

                            }

                        }

                    }

                }

            }

        }
    );

}


/* ==========================================
   INVENTORY HEALTH
========================================== */

function createHealthChart(data) {

    new Chart(
        document.getElementById("healthChart"),
        {

            type: "doughnut",

            data: {

                labels: [
                    "Healthy Stock",
                    "Low Stock"
                ],

                datasets: [

                    {

                        data: [

                            Number(
                                data.healthy_stock
                            ),

                            Number(
                                data.low_stock
                            )

                        ],

                        borderWidth: 2

                    }

                ]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                cutout: "68%",

                plugins: {

                    legend: {
                        position: "bottom"
                    }

                }

            }

        }
    );

}


/* ==========================================
   WAREHOUSE CHART
========================================== */

function createWarehouseChart(data) {

    const labels = data.map(
        item => item.name
    );

    const values = data.map(
        item => Number(item.total_inventory)
    );


    new Chart(
        document.getElementById(
            "warehouseChart"
        ),
        {

            type: "bar",

            data: {

                labels: labels,

                datasets: [

                    {

                        label: "Inventory Units",

                        data: values,

                        borderWidth: 1,

                        borderRadius: 8

                    }

                ]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: false
                    }

                },

                scales: {

                    y: {
                        beginAtZero: true
                    }

                }

            }

        }
    );

}


/* ==========================================
   CATEGORY CHART
========================================== */

function createCategoryChart(data) {

    const labels = data.map(
        item => item.category
    );

    const values = data.map(
        item => Number(
            item.total_inventory
        )
    );


    new Chart(
        document.getElementById(
            "categoryChart"
        ),
        {

            type: "pie",

            data: {

                labels: labels,

                datasets: [

                    {

                        data: values,

                        borderWidth: 2

                    }

                ]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        position: "bottom"
                    }

                }

            }

        }
    );

}


/* ==========================================
   TOP PRODUCTS
========================================== */

function createProductsChart(data) {

    const labels = data.map(
        item => item.name
    );

    const values = data.map(
        item => Number(
            item.total_sold
        )
    );


    new Chart(
        document.getElementById(
            "productsChart"
        ),
        {

            type: "bar",

            data: {

                labels: labels,

                datasets: [

                    {

                        label: "Units Sold",

                        data: values,

                        borderWidth: 1,

                        borderRadius: 8

                    }

                ]

            },

            options: {

                indexAxis: "y",

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: false
                    }

                },

                scales: {

                    x: {

                        beginAtZero: true

                    }

                }

            }

        }

    );

}


/* ==========================================
   INTELLIGENT INSIGHT
========================================== */

function generateInsight(data) {

    const lowStock =
        Number(
            data.inventory_health.low_stock
        );


    const healthy =
        Number(
            data.inventory_health.healthy_stock
        );


    const warehouses =
        data.warehouse_inventory;


    if (lowStock > 0) {

        document.getElementById(
            "analyticsInsight"
        ).textContent =
            `${lowStock} inventory record(s) require attention because stock is at or below the reorder level.`;

        return;

    }


    if (warehouses.length > 0) {

        const highestWarehouse =
            warehouses[0];


        document.getElementById(
            "analyticsInsight"
        ).textContent =
            `${highestWarehouse.name} currently holds the highest inventory volume with ${highestWarehouse.total_inventory} units.`;

        return;

    }


    document.getElementById(
        "analyticsInsight"
    ).textContent =
        `${healthy} inventory records are currently above their reorder levels.`;

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
   START
========================================== */

loadAnalytics();