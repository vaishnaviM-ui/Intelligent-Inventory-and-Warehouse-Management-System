# Intelligent Inventory and Warehouse Management System

Inventory and warehouse management application with a React/Vite frontend, FastAPI backend, PostgreSQL database, and optional demand-forecasting pipeline.

## Open the frontend

The public frontend is published with GitHub Pages:

**https://vaishnaviM-ui.github.io/Intelligent-Inventory-and-Warehouse-Management-System/**

The GitHub Pages deployment runs automatically whenever changes are pushed to `main`. To enable it the first time, open the repository's **Settings → Pages** and select **GitHub Actions** as the build and deployment source. After the first successful **Deploy frontend to GitHub Pages** workflow, the link above opens the app directly; you do not need to start a local frontend server.

> GitHub Pages hosts the frontend only. Sign-in, inventory data, reports, and other API-backed features require a separately hosted FastAPI backend and PostgreSQL database. Until that backend is deployed and configured, the frontend displays a message that API access is unavailable.

### Connect the hosted frontend to the backend

1. Deploy the FastAPI backend and PostgreSQL database to a hosting provider. The API must be reachable over HTTPS from a browser.
2. In this repository, open **Settings → Secrets and variables → Actions → Variables**.
3. Add a repository variable named `VITE_API_URL` with the backend base URL, for example `https://your-api.example.com` (do not add `/docs`).
4. Push a commit to `main`, or manually run **Deploy frontend to GitHub Pages** from the **Actions** tab. The workflow builds the frontend with that API URL.

Do not put database credentials, JWT secrets, or other private values in `VITE_API_URL`; it is embedded in the public frontend bundle. Keep backend secrets in the backend hosting provider's environment configuration.

## Run locally

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

3. Start the React frontend in a second terminal:

   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```

4. Open the Vite URL shown in the terminal (normally `http://localhost:5173/`) and sign in with an existing account.

For local development, the frontend uses `http://127.0.0.1:8001` by default. To use another local or hosted API, set `VITE_API_URL` in a `frontend/.env.local` file before starting Vite.

The backend expects an already provisioned PostgreSQL database. Startup uses SQLAlchemy `create_all` to create missing mapped tables; it does not migrate or remove existing tables. Do not point it at a database whose schema or data you need to protect until you have verified the configuration.

## API and database checks

- API documentation: `http://127.0.0.1:8001/docs`
- Database health: `http://127.0.0.1:8001/health`

## Demand model training

Training is optional and is not required to start the API. Once the database connection is configured and historical sales are available, run from `backend`:

```powershell
python ai/train_model.py
```

The generated model and metrics files are local artifacts and are intentionally excluded from Git. Do not run `seed_data.py` against a database containing real or historical records; that script can insert synthetic sales.
