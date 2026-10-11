import pytest
import time
import sys
from pathlib import Path

backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def auth_headers():
    uname = f"aimgr_{int(time.time())}"
    client.post("/register", json={"username": uname, "email": f"{uname}@test.com", "password": "Password123!", "role": "admin"})
    login_res = client.post("/login", data={"username": uname, "password": "Password123!"})
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_ai_demand_forecast(auth_headers):
    # Forecast for product 1 for 30 days
    res = client.get("/ai/forecast/1?days=30", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["product_id"] == 1
    assert data["days_ahead"] == 30
    assert data["total_predicted_demand"] > 0
    assert len(data["daily_predictions"]) == 30
    assert "mae" in data["evaluation_metrics"]
    assert "rmse" in data["evaluation_metrics"]
    assert "explanation" in data
    assert data["risk_level"] in ["Critical Out-of-Stock", "Shortage Risk", "Excess Stock", "Balanced"]

def test_restock_recommendations_and_conversion(auth_headers):
    # 1. Fetch catalog recommendations
    res = client.get("/ai/restock-recommendations", headers=auth_headers)
    assert res.status_code == 200
    recs = res.json()
    assert len(recs) > 0

    first_rec = recs[0]
    assert "recommended_order_quantity" in first_rec
    assert "urgency" in first_rec
    assert "daily_sales_velocity" in first_rec

    # 2. Convert recommendation to draft Purchase Order
    po_res = client.post("/ai/convert-recommendation-to-po", json={
        "product_id": first_rec["product_id"],
        "quantity": max(10, first_rec["recommended_order_quantity"]),
        "warehouse_id": 1,
        "supplier_id": first_rec["suggested_supplier_id"] or 1
    }, headers=auth_headers)
    assert po_res.status_code == 200
    po_data = po_res.json()
    assert po_data["success"] is True
    assert "purchase_id" in po_data
