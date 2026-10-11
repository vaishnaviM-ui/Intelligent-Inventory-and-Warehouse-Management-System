import csv
import io
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from database import get_db
import models
from dependencies import require_staff_or_admin

router = APIRouter(prefix="", tags=["Reports & Analytics"])

@router.get("/reports/inventory/csv")
def export_inventory_report_csv(
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    query = db.query(models.Inventory).join(models.Product).join(models.Warehouse)
    if warehouse_id:
        query = query.filter(models.Inventory.warehouse_id == warehouse_id)

    records = query.all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["inventory_id", "product_name", "sku", "category", "warehouse", "quantity", "reorder_level", "unit_price", "cost_price", "total_valuation", "status"])

    for inv in records:
        prod = inv.product
        wh = inv.warehouse
        qty = inv.quantity
        reorder = inv.reorder_level
        status_str = "Out of Stock" if qty <= 0 else ("Low Stock" if qty <= reorder else "Healthy")
        unit_p = float(prod.unit_price) if prod else 0.0
        cost_p = float(prod.cost_price or (unit_p * 0.7)) if prod else 0.0

        writer.writerow([
            inv.inventory_id,
            prod.name if prod else "",
            prod.sku if prod else "",
            prod.category.name if prod and prod.category else "",
            wh.name if wh else "",
            qty,
            reorder,
            unit_p,
            cost_p,
            round(qty * unit_p, 2),
            status_str
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inventory_report.csv"}
    )

@router.get("/reports/movements/csv")
def export_movements_report_csv(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    movements = db.query(models.StockTransaction).join(models.Product).join(models.Warehouse)\
                  .order_by(desc(models.StockTransaction.transaction_date)).limit(500).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["transaction_id", "date", "product_name", "sku", "warehouse", "type", "quantity", "reference_id"])

    for m in movements:
        writer.writerow([
            m.transaction_id,
            m.transaction_date.strftime("%Y-%m-%d %H:%M:%S") if m.transaction_date else "",
            m.product.name if m.product else "",
            m.product.sku if m.product else "",
            m.warehouse.name if m.warehouse else "",
            m.transaction_type,
            m.quantity,
            m.reference_id or ""
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=stock_movements_report.csv"}
    )

@router.get("/reports/sales/csv")
def export_sales_report_csv(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    sales = db.query(models.Sale).join(models.Warehouse).order_by(desc(models.Sale.sale_date)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["sale_id", "sale_date", "customer_name", "warehouse", "status", "total_amount", "item_count"])

    for s in sales:
        writer.writerow([
            s.sale_id,
            s.sale_date.strftime("%Y-%m-%d") if s.sale_date else "",
            s.customer_name or "Walk-in Customer",
            s.warehouse.name if s.warehouse else "",
            s.status,
            float(s.total_amount or 0),
            len(s.items)
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sales_report.csv"}
    )
