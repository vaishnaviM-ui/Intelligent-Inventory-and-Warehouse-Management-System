const API_URL = "http://127.0.0.1:8001";


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
                `${API_URL}/ai/forecast/${productId}?days=30`,
                {
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
                prediction.total_predicted_demand ??
                0
            );


        document.getElementById(
            "predictedDemand"
        ).textContent =
            demand.toLocaleString(undefined, {
                maximumFractionDigits: 2
            });

        document.getElementById(
            "currentStock"
        ).textContent =
            Number(prediction.current_stock).toLocaleString();


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

        document.getElementById("currentStock").textContent = "--";
        document.getElementById("recommendedRestock").textContent = "--";
        document.getElementById("aiDecision").textContent = "--";

        showChartMessage(
            `Unable to generate forecast: ${error.message}`
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


    const values = predictions.map(point =>
        Number(typeof point === "number" ? point : point.predicted_units)
    );
    if (values.some(value => !Number.isFinite(value))) {
        showChartMessage("Forecast data contains invalid daily values.");
        return;
    }


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
                Number(value).toLocaleString(undefined, {
                    maximumFractionDigits: 2
                });


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
                `${predictions[index].date || `Day ${index + 1}`}: ${Number(value).toLocaleString(undefined, {
                    maximumFractionDigits: 2
                })} units`;


            /* -------------------------------
               DAY LABEL
            ------------------------------- */

            const dayLabel =
                document.createElement("div");

            dayLabel.className =
                "forecast-day";


            dayLabel.textContent =
                `D${predictions[index].day || index + 1}`;


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
                data.recommended_restock_quantity ?? 0
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