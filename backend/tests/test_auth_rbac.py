import pytest
import time
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "PostgreSQL"

def test_user_registration_and_login():
    unique_suffix = int(time.time() * 1000)
    username = f"user_{unique_suffix}"
    email = f"user_{unique_suffix}@test.com"
    password = "TestPassword123!"

    # 1. Register new user
    reg_res = client.post("/register", json={
        "username": username,
        "email": email,
        "password": password,
        "role": "staff"
    })
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["user"]["name"] == username
    assert reg_data["user"]["email"] == email

    # 2. Reject duplicate registration
    dup_res = client.post("/register", json={
        "username": username,
        "email": email,
        "password": password
    })
    assert dup_res.status_code == 400

    # 3. Login with credentials
    login_res = client.post("/login", data={
        "username": username,
        "password": password
    })
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    token = token_data["access_token"]

    # 4. Access /me profile
    me_res = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["name"] == username

def test_rbac_admin_vs_staff():
    unique_suffix = int(time.time() * 1000) + 1
    username = f"staff_{unique_suffix}"
    email = f"staff_{unique_suffix}@test.com"
    password = "StaffPassword123!"

    client.post("/register", json={
        "username": username,
        "email": email,
        "password": password,
        "role": "staff"
    })

    login_res = client.post("/login", data={"username": username, "password": password})
    token = login_res.json()["access_token"]

    # Staff user attempting admin-only endpoint: /users list
    forbidden_res = client.get("/users", headers={"Authorization": f"Bearer {token}"})
    assert forbidden_res.status_code == 403
