const API_URL = "http://127.0.0.1:8000";


/* ==========================================
   AUTH
========================================== */

function getToken() {

    return localStorage.getItem("access_token");

}


function authHeaders() {

    return {

        "Content-Type": "application/json",

        "Authorization":
            `Bearer ${getToken()}`

    };

}


/* ==========================================
   LOGIN CHECK
========================================== */

if (!getToken()) {

    window.location.href = "index.html";

}


/* ==========================================
   GENERATE PREDICTION
========================================== */

async function generatePrediction() {

    const productId =
        document.getElementById("productId").value;


    if (!productId) {

        alert("Please enter a Product ID.");

        return;

    }


    const predictionElement =
        document.getElementById("predictedDemand");


    predictionElement.textContent =
        "Loading...";


    try {

        /* ======================================
           GENERATE PREDICTION
        ====================================== */

        const predictionResponse =
            await fetch(
                `${API_URL}/predictions/${productId}`,
                {
                    method: "POST",
                    headers: authHeaders()
                }
            );


        if (predictionResponse.status === 401) {

            logoutUser();

            return;

        }


        const prediction =
            await predictionResponse.json();


        if (!predictionResponse.ok) {

            throw new Error(
                prediction.detail ||
                "Prediction failed"
            );

        }


        /* ======================================
           PREDICTED DEMAND
        ====================================== */

        const demand =
            Number(
                prediction.predicted_demand ??
                prediction.predicted_quantity ??
                0
            );


        document.getElementById(
            "predictedDemand"
        ).textContent =
            demand.toLocaleString();


        /* ======================================
           CREATE 30-DAY CHART
        ====================================== */

        if (
            Array.isArray(
                prediction.daily_predictions
            ) &&
            prediction.daily_predictions.length > 0
        ) {

            createForecastChart(
                prediction.daily_predictions
            );

        }
        else {

            showChartMessage(
                "No daily forecast data available."
            );

        }


        /* ======================================
           RESTOCK
        ====================================== */

        await loadRestock(productId);


        /* ======================================
           CURRENT STOCK
        ====================================== */

        await loadCurrentStock(productId);


    }
    catch (error) {

        console.error(
            "AI Error:",
            error
        );


        document.getElementById(
            "predictedDemand"
        ).textContent =
            "--";


        showChartMessage(
            "Unable to generate forecast."
        );


        document.getElementById(
            "restockResult"
        ).innerHTML = `

            <div class="restock-error">

                ⚠️ ${error.message}

            </div>

        `;

    }

}


/* ==========================================
   CREATE 30-DAY BAR CHART
========================================== */

function createForecastChart(predictions) {

    const chart =
        document.getElementById(
            "forecastChart"
        );


    if (!chart) {

        console.error(
            "Forecast chart container not found."
        );

        return;

    }


    chart.innerHTML = "";


    const values =
        predictions.map(
            value =>
                Number(value) || 0
        );


    const maxValue =
        Math.max(...values, 1);


    /* ======================================
       CHART HEADER
    ====================================== */

    const chartTitle =
        document.createElement("div");

    chartTitle.className =
        "forecast-chart-title";

    chartTitle.innerHTML = `
        <span>Daily predicted demand</span>
        <span>${values.length} days</span>
    `;


    chart.appendChild(chartTitle);


    /* ======================================
       CHART AREA
    ====================================== */

    const chartArea =
        document.createElement("div");

    chartArea.className =
        "forecast-bars";


    values.forEach(
        (value, index) => {

            const column =
                document.createElement("div");

            column.className =
                "forecast-column";


            /* -------------------------------
               VALUE
            ------------------------------- */

            const valueLabel =
                document.createElement("div");

            valueLabel.className =
                "forecast-value";

            valueLabel.textContent =
                Number(value).toLocaleString();


            /* -------------------------------
               BAR AREA
            ------------------------------- */

            const barArea =
                document.createElement("div");

            barArea.className =
                "forecast-bar-area";


            /* -------------------------------
               BAR
            ------------------------------- */

            const bar =
                document.createElement("div");

            bar.className =
                "forecast-bar";


            const percentage =
                (value / maxValue) * 100;


            bar.style.height =
                `${Math.max(percentage, 3)}%`;


            bar.title =
                `Day ${index + 1}: ${Number(value).toLocaleString()} units`;


            /* -------------------------------
               DAY LABEL
            ------------------------------- */

            const dayLabel =
                document.createElement("div");

            dayLabel.className =
                "forecast-day";


            dayLabel.textContent =
                `D${index + 1}`;


            /* -------------------------------
               BUILD COLUMN
            ------------------------------- */

            barArea.appendChild(bar);

            column.appendChild(valueLabel);

            column.appendChild(barArea);

            column.appendChild(dayLabel);

            chartArea.appendChild(column);

        }
    );


    chart.appendChild(chartArea);


    /* ======================================
       X / Y INFORMATION
    ====================================== */

    const chartFooter =
        document.createElement("div");

    chartFooter.className =
        "forecast-footer";

    chartFooter.innerHTML = `
        <span>← Forecast period →</span>
        <span>Units</span>
    `;


    chart.appendChild(chartFooter);

}


/* ==========================================
   CHART MESSAGE
========================================== */

function showChartMessage(message) {

    const chart =
        document.getElementById(
            "forecastChart"
        );


    if (!chart) {

        return;

    }


    chart.innerHTML = `

        <div class="chart-placeholder">

            <div>
                📊
            </div>

            <p>
                ${message}
            </p>

        </div>

    `;

}


/* ==========================================
   RESTOCK
========================================== */

async function loadRestock(productId) {

    try {

        const response =
            await fetch(
                `${API_URL}/restock/${productId}`,
                {
                    headers: authHeaders()
                }
            );


        if (response.status === 401) {

            logoutUser();

            return;

        }


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                "Unable to calculate restock"
            );

        }


        const currentStock =
            Number(
                data.current_stock ?? 0
            );


        const predictedDemand =
            Number(
                data.predicted_demand ?? 0
            );


        const recommended =
            Number(
                data.recommended_restock ?? 0
            );


        document.getElementById(
            "recommendedRestock"
        ).textContent =
            recommended.toLocaleString();


        const decision =
            recommended > 0
                ? "RESTOCK"
                : "SUFFICIENT";


        const decisionElement =
            document.getElementById(
                "aiDecision"
            );


        decisionElement.textContent =
            decision;


        decisionElement.className =
            recommended > 0
                ? "ai-decision decision-restock"
                : "ai-decision decision-ok";


        document.getElementById(
            "restockResult"
        ).innerHTML = `

            <div class="restock-main">

                <div class="restock-status
                    ${
                        recommended > 0
                        ? "needs-restock"
                        : "stock-sufficient"
                    }">

                    ${
                        recommended > 0
                        ? "⚠ RESTOCK REQUIRED"
                        : "✓ STOCK SUFFICIENT"
                    }

                </div>


                <div class="restock-details">

                    <div>

                        <span>
                            Current Stock
                        </span>

                        <strong>
                            ${currentStock.toLocaleString()}
                        </strong>

                    </div>


                    <div>

                        <span>
                            Predicted Demand
                        </span>

                        <strong>
                            ${predictedDemand.toLocaleString()}
                        </strong>

                    </div>


                    <div>

                        <span>
                            Recommended
                        </span>

                        <strong>
                            ${recommended.toLocaleString()}
                        </strong>

                    </div>

                </div>


                <p class="restock-message">

                    ${
                        recommended > 0
                        ? `AI recommends replenishing approximately ${recommended.toLocaleString()} units to cover the predicted demand.`
                        : "Current inventory is sufficient for the predicted demand."
                    }

                </p>

            </div>

        `;

    }
    catch (error) {

        console.error(
            "Restock Error:",
            error
        );


        document.getElementById(
            "restockResult"
        ).innerHTML = `

            <div class="restock-error">

                ⚠️ ${error.message}

            </div>

        `;

    }

}


/* ==========================================
   CURRENT STOCK
========================================== */

async function loadCurrentStock(productId) {

    try {

        const response =
            await fetch(
                `${API_URL}/inventory`,
                {
                    headers: authHeaders()
                }
            );


        if (response.status === 401) {

            logoutUser();

            return;

        }


        const inventory =
            await response.json();


        const matching =
            inventory.filter(
                item =>
                    Number(
                        item.product_id
                    ) === Number(productId)
            );


        const stock =
            matching.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    Number(
                        item.quantity ?? 0
                    ),
                0
            );


        document.getElementById(
            "currentStock"
        ).textContent =
            stock.toLocaleString();

    }
    catch (error) {

        console.error(
            "Stock Error:",
            error
        );


        document.getElementById(
            "currentStock"
        ).textContent =
            "--";

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