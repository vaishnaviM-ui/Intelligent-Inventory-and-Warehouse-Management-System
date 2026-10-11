import os
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score

# Load .env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODEL_DIR, "demand_models.pkl")
METRICS_PATH = os.path.join(MODEL_DIR, "model_metrics.pkl")

def train_all_models():
    if not DATABASE_URL:
        print("DATABASE_URL is not set.")
        return {"error": "DATABASE_URL is not set."}

    engine = create_engine(DATABASE_URL)

    query = """
    SELECT
        p.product_id,
        p.name AS product_name,
        s.sale_date,
        si.quantity
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.sale_id
    JOIN products p ON si.product_id = p.product_id
    WHERE s.status IN ('Completed', 'Confirmed')
    ORDER BY p.product_id, s.sale_date ASC;
    """

    with engine.connect() as conn:
        df = pd.read_sql(text(query), conn)

    if df.empty:
        print("No historical sales data found.")
        return {"trained_count": 0, "metrics": {}}

    df["sale_date"] = pd.to_datetime(df["sale_date"])
    # Aggregate duplicate sales on the same date for the same product
    daily_sales = df.groupby(["product_id", "product_name", "sale_date"], as_index=False)["quantity"].sum()

    models = {}
    metrics_summary = {}

    for product_id in daily_sales["product_id"].unique():
        prod_data = daily_sales[daily_sales["product_id"] == product_id].copy().sort_values("sale_date")
        prod_name = prod_data["product_name"].iloc[0]

        # Calculate time reference
        min_date = prod_data["sale_date"].min()
        prod_data["day_number"] = (prod_data["sale_date"] - min_date).dt.days

        n_records = len(prod_data)
        avg_daily = float(prod_data["quantity"].mean())

        if n_records < 3:
            # Insufficient records for chronological split
            metrics_summary[int(product_id)] = {
                "product_name": prod_name,
                "n_samples": n_records,
                "model_type": "Baseline Only (Insufficient History)",
                "avg_daily_sales": round(avg_daily, 2),
                "mae": None,
                "rmse": None,
                "r2": None,
                "baseline_mae": None,
                "baseline_rmse": None,
                "baseline_model_type": "Historical Mean",
                "baseline_comparison_available": False
            }
            print(f"Product {product_id} ({prod_name}): Insufficient points ({n_records}), using baseline model.")
            continue

        # Chronological train/test split (80% train, 20% test)
        split_idx = max(2, int(n_records * 0.8))
        train_data = prod_data.iloc[:split_idx]
        test_data = prod_data.iloc[split_idx:]

        X_train = train_data[["day_number"]]
        y_train = train_data["quantity"]

        model = Ridge(alpha=1.0)
        model.fit(X_train, y_train)

        # Evaluate on test set (or train if test is empty)
        eval_set = test_data if len(test_data) > 0 else train_data
        X_eval = eval_set[["day_number"]]
        y_eval = eval_set["quantity"]
        y_pred = model.predict(X_eval)
        baseline_pred = np.full(len(y_eval), float(y_train.mean()))

        mae = float(mean_absolute_error(y_eval, y_pred))
        rmse = float(root_mean_squared_error(y_eval, y_pred))
        baseline_mae = float(mean_absolute_error(y_eval, baseline_pred))
        baseline_rmse = float(root_mean_squared_error(y_eval, baseline_pred))
        r2_val = float(r2_score(y_eval, y_pred)) if len(y_eval) > 1 else None

        last_day_num = int(prod_data["day_number"].max())

        models[int(product_id)] = {
            "model": model,
            "last_day_num": last_day_num,
            "reference_date": min_date,
            "product_name": prod_name
        }

        metrics_summary[int(product_id)] = {
            "product_name": prod_name,
            "n_samples": n_records,
            "model_type": "Ridge Linear Regression",
            "avg_daily_sales": round(avg_daily, 2),
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "r2": round(r2_val, 2) if r2_val is not None and np.isfinite(r2_val) else None,
            "baseline_mae": round(baseline_mae, 2),
            "baseline_rmse": round(baseline_rmse, 2),
            "baseline_model_type": "Training Mean",
            "baseline_comparison_available": True
        }

        print(
            f"Product {product_id} ({prod_name}): Trained. "
            f"MAE: {mae:.2f} (baseline {baseline_mae:.2f}), "
            f"RMSE: {rmse:.2f} (baseline {baseline_rmse:.2f})"
        )

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(models, MODEL_PATH)
    joblib.dump(metrics_summary, METRICS_PATH)
    print(f"\nSaved {len(models)} trained models and {len(metrics_summary)} metric records successfully!")

    return {
        "trained_count": len(models),
        "total_catalog_evaluated": len(metrics_summary),
        "metrics": metrics_summary
    }

if __name__ == "__main__":
    train_all_models()