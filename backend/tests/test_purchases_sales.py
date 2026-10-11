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
    uname = f"mgr_{int(time.time())}"
    client.post("/register", json={"username": uname, "email": f"{uname}@test.com", "password": "Password123!", "role": "admin"})
    login_res = client.post("/login", data={"username": uname, "password": "Password123!"})
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_purchase_order_lifecycle_and_receiving(auth_headers):
    # 1. Create PO
    po_payload = {
        "supplier_id": 1,
        "warehouse_id": 1,
        "items": [
            {"product_id": 1, "quantity": 30, "unit_price": 450.00}
        ]
    }
    po_res = client.post("/purchases", json=po_payload, headers=auth_headers)
    assert po_res.status_code == 200
    po_data = po_res.json()
    po_id = po_data["purchase_id"]
    assert po_data["status"] == "Pending"
    assert po_data["total_amount"] == 30 * 450.00

    # 2. Approve PO
    status_res = client.put(f"/purchases/{po_id}/status", json={"status": "Approved"}, headers=auth_headers)
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "Approved"

    # 3. Receive Goods into Warehouse 1
    recv_res = client.post(f"/purchases/{po_id}/receive", headers=auth_headers)
    assert recv_res.status_code == 200
    assert recv_res.json()["success"] is True
    assert recv_res.json()["status"] == "Completed"

    # 4. Reject duplicate receiving
    dup_recv = client.post(f"/purchases/{po_id}/receive", headers=auth_headers)
    assert dup_recv.status_code == 400

def test_sales_order_and_return_lifecycle(auth_headers):
    # Ensure inventory has at least 15 units of product 1 in warehouse 1
    client.post("/inventory/stock-in", json={
        "product_id": 1,
        "warehouse_id": 1,
        "transaction_type": "IN",
        "quantity": 15
    }, headers=auth_headers)

    # 1. Create and Fulfill Sale
    sale_payload = {
        "customer_name": "Test Client Corp",
        "warehouse_id": 1,
        "items": [
            {"product_id": 1, "quantity": 5}
        ]
    }
    sale_res = client.post("/sales", json=sale_payload, headers=auth_headers)
    assert sale_res.status_code == 200
    sale_data = sale_res.json()
    sale_id = sale_data["sale_id"]
    assert sale_data["status"] == "Completed"
    assert len(sale_data["items"]) == 1

    # 2. Process Return
    return_res = client.post(f"/sales/{sale_id}/return", json={"reason": "Customer cancellation"}, headers=auth_headers)
    assert return_res.status_code == 200
    assert return_res.json()["status"] == "Returned"
