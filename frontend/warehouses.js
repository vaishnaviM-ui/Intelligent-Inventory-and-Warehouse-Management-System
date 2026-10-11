const API_URL =
    "http://127.0.0.1:8000";

let warehouseBarChart = null;
let warehousePieChart = null;


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
   LOAD WAREHOUSE DATA
========================================== */

async function loadWarehouses() {

    try {

        const response =
            await fetch(
                `${API_URL}/analytics`,
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
                "Unable to load warehouse data"
            );

        }


        const data =
            await response.json();


        const warehouses =
            data.warehouse_inventory
            || [];


        updateWarehouseKPIs(
            warehouses
        );


        createWarehouseBarChart(
            warehouses
        );


        createWarehousePieChart(
            warehouses
        );


        renderWarehouseCards(
            warehouses
        );


        generateWarehouseInsight(
            warehouses
        );


    }
    catch (error) {

        console.error(
            "Warehouse Error:",
            error
        );


        document.getElementById(
            "warehouseCards"
        ).innerHTML = `

            <div class="warehouse-loading">

                ⚠️ Unable to load warehouse data.

            </div>

        `;

    }

}


/* ==========================================
   UPDATE KPI
========================================== */

function updateWarehouseKPIs(
    warehouses
) {

    const count =
        warehouses.length;


    const total =
        warehouses.reduce(
            (sum, warehouse) =>
                sum +
                Number(
                    warehouse.total_inventory
                    || 0
                ),
            0
        );


    const largest =
        warehouses.length
        ? warehouses[0]
        : null;


    const average =
        count > 0
        ? Math.round(
            total / count
        )
        : 0;


    document.getElementById(
        "warehouseCount"
    ).textContent =
        count;


    document.getElementById(
        "totalWarehouseStock"
    ).textContent =
        total.toLocaleString();


    document.getElementById(
        "largestWarehouse"
    ).textContent =
        largest
        ? largest.name
        : "--";


    document.getElementById(
        "averageWarehouseStock"
    ).textContent =
        average.toLocaleString();

}


/* ==========================================
   BAR CHART
========================================== */

function createWarehouseBarChart(
    warehouses
) {

    const labels =
        warehouses.map(
            warehouse =>
                warehouse.name
        );


    const values =
        warehouses.map(
            warehouse =>
                Number(
                    warehouse.total_inventory
                    || 0
                )
        );


    if (warehouseBarChart) {

        warehouseBarChart.destroy();

    }


    warehouseBarChart =
        new Chart(

            document.getElementById(
                "warehouseBarChart"
            ),

            {

                type: "bar",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            label:
                                "Inventory Units",

                            data: values,

                            borderWidth: 1,

                            borderRadius: 8

                        }

                    ]

                },


                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {

                            display: false

                        }

                    },


                    scales: {

                        y: {

                            beginAtZero: true,

                            title: {

                                display: true,

                                text:
                                    "Inventory Units"

                            }

                        }

                    }

                }

            }

        );

}


/* ==========================================
   PIE CHART
========================================== */

function createWarehousePieChart(
    warehouses
) {

    const labels =
        warehouses.map(
            warehouse =>
                warehouse.name
        );


    const values =
        warehouses.map(
            warehouse =>
                Number(
                    warehouse.total_inventory
                    || 0
                )
        );


    if (warehousePieChart) {

        warehousePieChart.destroy();

    }


    warehousePieChart =
        new Chart(

            document.getElementById(
                "warehousePieChart"
            ),

            {

                type: "doughnut",

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

                    maintainAspectRatio:
                        false,

                    cutout: "62%",

                    plugins: {

                        legend: {

                            position:
                                "bottom"

                        }

                    }

                }

            }

        );

}


/* ==========================================
   WAREHOUSE CARDS
========================================== */

function renderWarehouseCards(
    warehouses
) {

    const container =
        document.getElementById(
            "warehouseCards"
        );


    if (!warehouses.length) {

        container.innerHTML = `

            <div class="warehouse-loading">

                No warehouse data available.

            </div>

        `;

        return;

    }


    const total =
        warehouses.reduce(
            (sum, warehouse) =>
                sum +
                Number(
                    warehouse.total_inventory
                    || 0
                ),
            0
        );


    container.innerHTML =
        warehouses.map(
            warehouse => {

                const stock =
                    Number(
                        warehouse.total_inventory
                        || 0
                    );


                const percentage =
                    total > 0
                    ? (
                        stock / total
                    ) * 100
                    : 0;


                return `

                    <div
                        class="warehouse-detail-card"
                    >

                        <div
                            class="warehouse-detail-top"
                        >

                            <div
                                class="warehouse-detail-icon"
                            >
                                🏭
                            </div>


                            <div>

                                <h3>
                                    ${
                                        warehouse.name
                                    }
                                </h3>

                                <span>
                                    Warehouse
                                </span>

                            </div>


                            <div
                                class="warehouse-status"
                            >
                                ● Active
                            </div>

                        </div>


                        <div
                            class="warehouse-detail-value"
                        >

                            <strong>
                                ${
                                    stock.toLocaleString()
                                }
                            </strong>

                            <span>
                                units
                            </span>

                        </div>


                        <div
                            class="warehouse-progress"
                        >

                            <div
                                class="warehouse-progress-fill"
                                style="
                                    width:
                                    ${percentage}%;
                                "
                            ></div>

                        </div>


                        <div
                            class="warehouse-detail-footer"
                        >

                            <span>
                                Inventory Share
                            </span>

                            <strong>
                                ${
                                    percentage.toFixed(1)
                                }%
                            </strong>

                        </div>

                    </div>

                `;

            }
        ).join("");

}


/* ==========================================
   INTELLIGENT INSIGHT
========================================== */

function generateWarehouseInsight(
    warehouses
) {

    const element =
        document.getElementById(
            "warehouseInsight"
        );


    if (!warehouses.length) {

        element.textContent =
            "No warehouse information is currently available.";

        return;

    }


    const largest =
        warehouses[0];


    const total =
        warehouses.reduce(
            (sum, warehouse) =>
                sum +
                Number(
                    warehouse.total_inventory
                    || 0
                ),
            0
        );


    const share =
        total > 0
        ? (
            Number(
                largest.total_inventory
                || 0
            ) / total
        ) * 100
        : 0;


    element.textContent =
        `${largest.name} currently holds the largest share of inventory at ${share.toFixed(1)}% of total warehouse stock.`;

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

loadWarehouses();