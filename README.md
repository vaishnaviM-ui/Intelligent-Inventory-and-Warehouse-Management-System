# Intelligent Inventory and Warehouse Management System

Inventory and warehouse management application with a FastAPI backend, PostgreSQL database, SQLAlchemy models, a legacy HTML/JavaScript frontend, and an optional demand-forecasting pipeline.

## Current application entry points

- Dashboard: `http://127.0.0.1:5500/legacy_vanilla/index.html`
- Inventory: `http://127.0.0.1:5500/legacy_vanilla/inventory.html`
- Products: `http://127.0.0.1:5500/legacy_vanilla/products.html`
- API documentation: `http://127.0.0.1:8000/docs`
- Database health: `http://127.0.0.1:8000/health`

The static legacy frontend is the working UI. The React/Vite migration is incomplete and is not the application entry point yet.

## Requirements

- Python 3.11 or newer
- PostgreSQL with an existing, compatible application database
- Node.js is not required for the legacy frontend

## Local setup

1. Create a virtual environment and install backend dependencies:

   ```powershell
   cd backend
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   ```

2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` and a unique, random `SECRET_KEY`. Keep `.env` local; it is ignored by Git.

3. Start the API in a terminal from the `backend` directory:

   ```powershell
   python -m uvicorn main:app --host 127.0.0.1 --port 8000
   ```

4. Start the static frontend in a second terminal from the project root:

   ```powershell
   python -m http.server 5500 --bind 127.0.0.1 --directory frontend
   ```

5. Open the dashboard URL above and sign in with an existing account.

The app expects an already provisioned PostgreSQL database. Startup uses SQLAlchemy `create_all` to create missing mapped tables; it does not migrate or remove existing tables. Do not point it at a database whose schema/data you need to protect until you have verified the configuration.

## Demand model training

Training is optional and is not required to start the API. Once the database connection is configured and historical sales are available, run from `backend`:

```powershell
python ai/train_model.py
```

The generated model and metrics files are local artifacts and are intentionally excluded from Git. Do not run `seed_data.py` against a database containing real or historical records; that script can insert synthetic sales.

## GitHub and hosting

This repository contains the application source. GitHub does not run the FastAPI service or PostgreSQL database. A public deployment needs a separately hosted FastAPI service and PostgreSQL database, plus a frontend configured to call that deployed API instead of `127.0.0.1`. Do not publish database credentials, JWT secrets, database dumps, or production data.
