# Intelligent Inventory and Warehouse Management System

Inventory and warehouse management application with a React/Vite frontend, FastAPI backend, PostgreSQL database, and optional demand forecasting.

## Deployment

The React frontend is published as a static site on GitHub Pages:

- **Frontend:** [GitHub Pages](https://vaishnaviM-ui.github.io/Intelligent-Inventory-and-Warehouse-Management-System/)

### GitHub Pages frontend

The [`Deploy frontend to GitHub Pages`](./.github/workflows/deploy-pages.yml) workflow builds and deploys the frontend on pushes to `main`. In repository **Settings → Pages**, set the build and deployment source to **GitHub Actions**. After that one-time setting, deployments run automatically; you do not need to start the frontend locally.

The Pages build is frontend-only and does not connect to Render or any other backend. GitHub Pages cannot run the FastAPI server or host the database, so sign-in and data-backed features require a separately configured backend and are unavailable in this deployment for now.

To connect a backend later, configure a repository variable named `VITE_API_URL` under **Settings → Secrets and variables → Actions → Variables**, then update the workflow to use that variable. This URL is embedded in the public frontend bundle; never put credentials or secrets in it.

## Run locally for development

### Requirements

- Python 3.11 or newer
- PostgreSQL with an existing, compatible application database
- Node.js 20 or newer and npm

1. Configure the backend:

   ```powershell
   cd backend
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   Copy-Item .env.example .env
   ```

   Set `DATABASE_URL` and a unique, random `SECRET_KEY` in `backend/.env`. Keep `.env` local; it is ignored by Git.

2. Start the API in a terminal from the `backend` directory:

   ```powershell
   python -m uvicorn main:app --host 127.0.0.1 --port 8001
   ```

3. Start the React development server in a second terminal:

   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```

4. Open `http://localhost:5173/`. During local development, the frontend sends API requests to `http://127.0.0.1:8001` by default.

To use a different API while developing, set `VITE_API_URL` in `frontend/.env.local`.

## Demand model training

Training is optional. Once the database connection is configured and historical sales are available, run from `backend`:

```powershell
python ai/train_model.py
```

Generated model and metrics files are local artifacts and are intentionally excluded from Git. Do not run `seed_data.py` against a database containing real or historical records; it can insert synthetic sales.
