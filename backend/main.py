from pathlib import Path
from dotenv import load_dotenv

# Ensure environment is loaded first
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, engine, Base
import models

# Import modular routers
from routers import (
    auth_router,
    products_router,
    warehouses_router,
    inventory_router,
    purchases_router,
    sales_router,
    ai_router,
    dashboard_router,
    notifications_router,
    reports_router
)

frontend_dist = Path(__file__).resolve().parent / "static"

# Initialize FastAPI application
app = FastAPI(
    title="Intelligent Inventory & Warehouse Management API",
    description="Enterprise API for inventory control, multi-warehouse stock management, purchase & sales lifecycles, and explainable AI demand forecasting.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration supporting both local Vite frontend and static servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include modular routers
app.include_router(auth_router.router)
app.include_router(products_router.router)
app.include_router(warehouses_router.router)
app.include_router(inventory_router.router)
app.include_router(purchases_router.router)
app.include_router(sales_router.router)
app.include_router(ai_router.router)
app.include_router(dashboard_router.router)
app.include_router(notifications_router.router)
app.include_router(reports_router.router)

@app.get("/")
def home():
    index_file = frontend_dist / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {
        "title": "Intelligent Inventory and Warehouse Management System",
        "status": "Online",
        "version": "2.0.0",
        "docs": "/docs"
    }

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "PostgreSQL",
            "connection": "successful",
            "version": "2.0.0"
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database connection failed: {str(e)}"
        )

# In production, serve the Vite build and API from the same origin.
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

# Make sure tables exist if running fresh
@app.on_event("startup")
def on_startup():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Startup metadata notice: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)