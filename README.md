# Intelligent Inventory and Warehouse Management System

Inventory and warehouse management application with a React/Vite frontend, FastAPI backend, PostgreSQL database, and optional demand forecasting.

## Deploy frontend and backend together

The React build and FastAPI API are served by the same Render web service, so the application uses one public URL and the frontend calls the API on that same origin. PostgreSQL remains a separate managed database service.

### One-time deployment

1. Create or select a PostgreSQL database that Render can reach. Get its connection string; do not share or commit it.
2. Select **[Deploy to Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2FvaishnaviM-ui%2FIntelligent-Inventory-and-Warehouse-Management-System)** and authorize Render to access this repository.
3. Render reads [`render.yaml`](./render.yaml) and builds the app using the root [`Dockerfile`](./Dockerfile). When prompted, set `DATABASE_URL` to your hosted PostgreSQL connection string. Render generates `SECRET_KEY` for the web service.
4. Deploy the Blueprint. Wait for the service health check at `/health` to pass.
5. Open the `onrender.com` URL shown on the Render service. Sign in there; the API docs are at the same host's `/docs`.

The root URL is the frontend and API requests go to that same URL. After the initial deployment, pushes to the connected branch trigger automatic redeploys. You do not need to start a local frontend or backend server to use the hosted app.

The included Blueprint uses Render's free web-service plan, which may spin down when idle. Availability and database pricing depend on the PostgreSQL provider and its plan. Keep production database credentials and secrets in Render's environment settings. Do not point the application at a database containing important data until you have verified the connection and backup.

The backend currently uses SQLAlchemy `create_all` to create missing mapped tables; it does not migrate or remove existing tables. Ensure the database schema is compatible before using an existing database.

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
