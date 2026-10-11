from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text, desc
from database import get_db
import models
import schemas
from dependencies import require_staff_or_admin

router = APIRouter(prefix="", tags=["Dashboard & Executive KPIs"])

@router.get("/dashboard/summary", response_model=schemas.DashboardMetrics)
@router.get("/dashboard")  # Backward compatibility
def get_dashboard_summary(
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    # Total Products
    total_products = db.query(models.Product).count()

    # Total Warehouses & Suppliers
    total_warehouses = db.query(models.Warehouse).count()
    total_suppliers = db.query(models.Supplier).count()

    # Stock Units & Valuation
    inv_query = db.query(models.Inventory).join(models.Product)
    if warehouse_id:
        inv_query = inv_query.filter(models.Inventory.warehouse_id == warehouse_id)

    records = inv_query.all()
    total_units = 0
    total_cost = 0.0
    total_retail = 0.0
    low_stock = 0
    out_of_stock = 0

    for inv in records:
        qty = inv.quantity
        prod = inv.product
        total_units += qty

        unit_p = float(prod.unit_price) if prod else 0.0
        cost_p = float(prod.cost_price or (unit_p * 0.7)) if prod else 0.0

        total_cost += qty * cost_p
        total_retail += qty * unit_p

        if qty <= 0:
            out_of_stock += 1
            low_stock += 1
        elif qty <= inv.reorder_level:
            low_stock += 1

    # Pending POs
    po_query = db.query(models.Purchase).filter(models.Purchase.status.in_(["Pending", "Approved"]))
    if warehouse_id:
        po_query = po_query.filter(models.Purchase.warehouse_id == warehouse_id)
    pending_pos = po_query.count()

    # Completed Sales
    sale_query = db.query(models.Sale).filter(models.Sale.status.in_(["Completed", "Confirmed"]))
    if warehouse_id:
        sale_query = sale_query.filter(models.Sale.warehouse_id == warehouse_id)
    total_sales_amount = float(
        db.query(func.coalesce(func.sum(models.Sale.total_amount), 0)).filter(
            models.Sale.status.in_(["Completed", "Confirmed"])
        ).scalar() or 0
    )
    total_completed_orders = sale_query.count()

    return schemas.DashboardMetrics(
        total_products=total_products,
        total_stock_units=total_units,
        inventory_valuation_cost=round(total_cost, 2),
        inventory_valuation_retail=round(total_retail, 2),
        low_stock_items=low_stock,
        out_of_stock_items=out_of_stock,
        total_warehouses=total_warehouses,
        total_suppliers=total_suppliers,
        pending_purchase_orders=pending_pos,
        total_sales_amount=round(total_sales_amount, 2),
        total_completed_orders=total_completed_orders
    )

@router.get("/dashboard/charts")
def get_dashboard_charts(
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    # 1. Sales Trend over time (monthly)
    sales = db.query(models.Sale).filter(models.Sale.status.in_(["Completed", "Confirmed"])).all()
    monthly_sales = {}
    for s in sales:
        if s.sale_date:
            m_key = s.sale_date.strftime("%b %Y")
            monthly_sales[m_key] = monthly_sales.get(m_key, 0.0) + float(s.total_amount or 0)

    sales_trend_data = [
        {"month": k, "revenue": round(v, 2)}
        for k, v in monthly_sales.items()
    ]

    # 2. Stock Distribution by Category
    cat_query = db.query(
        models.Category.name.label("category"),
        func.coalesce(func.sum(models.Inventory.quantity), 0).label("stock")
    ).join(models.Product, models.Category.category_id == models.Product.category_id)\
     .join(models.Inventory, models.Product.product_id == models.Inventory.product_id)

    if warehouse_id:
        cat_query = cat_query.filter(models.Inventory.warehouse_id == warehouse_id)

    category_stock = [
        {"name": row.category, "value": int(row.stock)}
        for row in cat_query.group_by(models.Category.name).all()
    ]

    # 3. Warehouse Distribution (stock vs capacity)
    warehouses = db.query(models.Warehouse).all()
    warehouse_dist = []
    for wh in warehouses:
        current_stk = db.query(func.coalesce(func.sum(models.Inventory.quantity), 0)).filter(
            models.Inventory.warehouse_id == wh.warehouse_id
        ).scalar() or 0

        warehouse_dist.append({
            "name": wh.name,
            "stock": int(current_stk),
            "capacity": wh.capacity or 10000,
            "utilization": round((int(current_stk) / (wh.capacity or 10000)) * 100, 1)
        })

    # 4. Fast-moving vs Slow-moving Products
    product_sales = db.query(
        models.Product.name,
        func.coalesce(func.sum(models.SaleItem.quantity), 0).label("units_sold"),
        func.coalesce(func.sum(models.SaleItem.total_price), 0).label("revenue")
    ).outerjoin(models.SaleItem, models.Product.product_id == models.SaleItem.product_id)\
     .group_by(models.Product.name)\
     .order_by(desc("units_sold")).all()

    fast_moving = [
        {"name": row.name, "units_sold": int(row.units_sold), "revenue": float(row.revenue)}
        for row in product_sales[:5]
    ]

    slow_moving = [
        {"name": row.name, "units_sold": int(row.units_sold), "revenue": float(row.revenue)}
        for row in reversed(product_sales[-5:])
    ]

    return {
        "sales_trends": sales_trend_data,
        "category_distribution": category_stock,
        "warehouse_distribution": warehouse_dist,
        "fast_moving": fast_moving,
        "slow_moving": slow_moving
    }

# Backward compatibility /analytics endpoint
@router.get("/analytics")
def legacy_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    charts = get_dashboard_charts(None, db, current_user)
    summary = get_dashboard_summary(None, db, current_user)

    return {
        "top_products": [
            {"name": p["name"], "total_sold": p["units_sold"]}
            for p in charts["fast_moving"]
        ],
        "warehouse_inventory": [
            {"name": w["name"], "total_inventory": w["stock"]}
            for w in charts["warehouse_distribution"]
        ],
        "inventory_health": {
            "total_items": summary.total_stock_units,
            "healthy_stock": max(0, summary.total_stock_units - summary.low_stock_items),
            "low_stock": summary.low_stock_items
        },
        "monthly_sales": [
            {"month": m["month"], "total_sales": m["revenue"]}
            for m in charts["sales_trends"]
        ],
        "category_inventory": [
            {"category": c["name"], "total_inventory": c["value"]}
            for c in charts["category_distribution"]
        ]
    }
