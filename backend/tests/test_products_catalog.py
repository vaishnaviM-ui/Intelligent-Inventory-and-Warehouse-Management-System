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
def admin_token():
    # Login as admin user
    login_res = client.post("/login", data={"username": "admin", "password": "Password123!"})
    if login_res.status_code != 200:
        # Create or login testadmin
        login_res = client.post("/login", data={"username": "testadmin", "password": "Password123!"})
    if login_res.status_code == 200:
        return login_res.json()["access_token"]
    
    # Register admin if neither exists
    uname = f"adm_{int(time.time())}"
    client.post("/register", json={"username": uname, "email": f"{uname}@test.com", "password": "Password123!", "role": "admin"})
    login_res = client.post("/login", data={"username": uname, "password": "Password123!"})
    return login_res.json()["access_token"]

def test_product_lifecycle_and_duplicate_sku(admin_token):
    unique_num = int(time.time() * 1000) % 10000
    sku = f"TEST-SKU-{unique_num}"
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create Product
    prod_payload = {
        "sku": sku,
        "name": f"Test Item {unique_num}",
        "description": "High performance test product",
        "category_id": 1,
        "supplier_id": 1,
        "unit_price": 499.50,
        "cost_price": 320.00,
        "initial_stock": 25,
        "initial_warehouse_id": 1,
        "reorder_level": 15
    }
    create_res = client.post("/products", json=prod_payload, headers=headers)
    assert create_res.status_code == 200
    prod = create_res.json()
    assert prod["sku"] == sku
    assert prod["name"] == prod_payload["name"]
    assert prod["unit_price"] == 499.50
    assert prod["cost_price"] == 320.00
    prod_id = prod["product_id"]

    # 2. Duplicate SKU rejection
    dup_res = client.post("/products", json=prod_payload, headers=headers)
    assert dup_res.status_code == 400
    assert "Duplicate SKU" in dup_res.json()["detail"]

    # 3. Product detail view
    detail_res = client.get(f"/products/{prod_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["product_id"] == prod_id
    assert detail["total_stock"] == 25
    assert len(detail["warehouse_stocks"]) >= 1

    # 4. Update Product
    update_res = client.put(f"/products/{prod_id}", json={
        "name": f"Updated Item {unique_num}",
        "unit_price": 549.00
    }, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["name"] == f"Updated Item {unique_num}"
    assert update_res.json()["unit_price"] == 549.00

    # 5. Search products by SKU
    search_res = client.get(f"/products?search={sku}")
    assert search_res.status_code == 200
    items = search_res.json()
    assert any(p["sku"] == sku for p in items)

def test_csv_product_export(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/products/export/csv", headers=headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "product_id,sku,name" in res.text
