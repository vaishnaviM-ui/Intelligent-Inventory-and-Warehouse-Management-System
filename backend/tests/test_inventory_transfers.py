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
    uname = f"staff_{int(time.time())}"
    client.post("/register", json={"username": uname, "email": f"{uname}@test.com", "password": "Password123!", "role": "staff"})
    login_res = client.post("/login", data={"username": uname, "password": "Password123!"})
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_stock_in_and_stock_out(auth_headers):
    # Product 1 at Warehouse 1
    # 1. Stock In 20 units
    in_res = client.post("/inventory/stock-in", json={
        "product_id": 1,
        "warehouse_id": 1,
        "transaction_type": "IN",
        "quantity": 20
    }, headers=auth_headers)
    assert in_res.status_code == 200
    assert in_res.json()["success"] is True
    qty_after_in = in_res.json()["new_quantity"]

    # 2. Stock Out 5 units
    out_res = client.post("/inventory/stock-out", json={
        "product_id": 1,
        "warehouse_id": 1,
        "transaction_type": "OUT",
        "quantity": 5
    }, headers=auth_headers)
    assert out_res.status_code == 200
    assert out_res.json()["remaining_quantity"] == qty_after_in - 5

def test_prevent_negative_stock(auth_headers):
    # Attempting to deduct an impossible quantity (e.g. 999,999 units)
    res = client.post("/inventory/stock-out", json={
        "product_id": 1,
        "warehouse_id": 1,
        "transaction_type": "OUT",
        "quantity": 999999
    }, headers=auth_headers)
    assert res.status_code == 400
    assert "Insufficient stock" in res.json()["detail"] or "Cannot deduct" in res.json()["detail"]

def test_atomic_warehouse_transfer(auth_headers):
    # 1. Stock In 15 units into Warehouse 1 first
    client.post("/inventory/stock-in", json={
        "product_id": 2,
        "warehouse_id": 1,
        "transaction_type": "IN",
        "quantity": 15
    }, headers=auth_headers)

    # 2. Transfer 10 units from Warehouse 1 to Warehouse 2
    transfer_res = client.post("/warehouses/transfer", json={
        "product_id": 2,
        "from_warehouse_id": 1,
        "to_warehouse_id": 2,
        "quantity": 10
    }, headers=auth_headers)
    assert transfer_res.status_code == 200
    assert transfer_res.json()["success"] is True

    # 3. Check transfer history
    history_res = client.get("/warehouses/transfers/history", headers=auth_headers)
    assert history_res.status_code == 200
    assert len(history_res.json()) >= 1
