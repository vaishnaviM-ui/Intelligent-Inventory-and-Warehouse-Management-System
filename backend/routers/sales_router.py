from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
import models
import schemas
from dependencies import require_staff_or_admin, require_inventory_manager, log_audit, create_notification

router = APIRouter(prefix="", tags=["Sales & Order Management"])

@router.get("/sales", response_model=List[schemas.SaleResponse])
def get_sales(
    status_filter: Optional[str] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    limit: Optional[int] = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    query = db.query(models.Sale)
    if status_filter:
        query = query.filter(models.Sale.status.ilike(status_filter))
    if warehouse_id:
        query = query.filter(models.Sale.warehouse_id == warehouse_id)

    sales = query.order_by(desc(models.Sale.sale_date), desc(models.Sale.sale_id)).limit(limit).all()

    results = []
    for s in sales:
        items = []
        for it in s.items:
            items.append(schemas.SaleItemResponse(
                item_id=it.item_id,
                product_id=it.product_id,
                product_name=it.product.name if it.product else "Unknown",
                sku=it.product.sku if it.product else None,
                quantity=it.quantity,
                unit_price=float(it.unit_price),
                total_price=float(it.total_price or (it.quantity * it.unit_price))
            ))

        results.append(schemas.SaleResponse(
            sale_id=s.sale_id,
            customer_name=s.customer_name or "Walk-in Customer",
            warehouse_id=s.warehouse_id,
            warehouse_name=s.warehouse.name if s.warehouse else f"Warehouse {s.warehouse_id}",
            sale_date=s.sale_date,
            total_amount=float(s.total_amount or 0),
            status=s.status or "Completed",
            items=items
        ))

    return results

@router.get("/sales/{sale_id}", response_model=schemas.SaleResponse)
def get_sale_detail(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    sale = db.query(models.Sale).filter(models.Sale.sale_id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale order not found")

    items = []
    for it in sale.items:
        items.append(schemas.SaleItemResponse(
            item_id=it.item_id,
            product_id=it.product_id,
            product_name=it.product.name if it.product else "Unknown",
            sku=it.product.sku if it.product else None,
            quantity=it.quantity,
            unit_price=float(it.unit_price),
            total_price=float(it.total_price or (it.quantity * it.unit_price))
        ))

    return schemas.SaleResponse(
        sale_id=sale.sale_id,
        customer_name=sale.customer_name,
        warehouse_id=sale.warehouse_id,
        warehouse_name=sale.warehouse.name if sale.warehouse else f"Warehouse {sale.warehouse_id}",
        sale_date=sale.sale_date,
        total_amount=float(sale.total_amount or 0),
        status=sale.status or "Completed",
        items=items
    )

@router.post("/sales", response_model=schemas.SaleResponse)
def create_sales_order(
    sale_data: schemas.SaleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    warehouse = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == sale_data.warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=400, detail="Invalid warehouse_id")

    if not sale_data.items:
        raise HTTPException(status_code=400, detail="Sale must contain at least one item")

    # Step 1: Validate stock availability for all items first
    for item in sale_data.items:
        inv = db.query(models.Inventory).filter(
            models.Inventory.product_id == item.product_id,
            models.Inventory.warehouse_id == sale_data.warehouse_id
        ).first()

        avail = inv.quantity if inv else 0
        if avail < item.quantity:
            product = db.query(models.Product).filter(models.Product.product_id == item.product_id).first()
            p_name = product.name if product else f"Product {item.product_id}"
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{p_name}' at {warehouse.name}. Available: {avail}, requested: {item.quantity}"
            )

    # Step 2: Create Sale and line items, deduct stock atomically
    total_amount = 0.0
    sale = models.Sale(
        customer_name=sale_data.customer_name or "Walk-in Customer",
        warehouse_id=sale_data.warehouse_id,
        status="Completed",
        total_amount=0.0
    )
    db.add(sale)
    db.flush()

    response_items = []
    for item in sale_data.items:
        product = db.query(models.Product).filter(models.Product.product_id == item.product_id).first()
        unit_price = item.unit_price if item.unit_price is not None else float(product.unit_price)
        item_total = float(item.quantity) * unit_price
        total_amount += item_total

        # Add SaleItem
        si = models.SaleItem(
            sale_id=sale.sale_id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=unit_price
        )
        db.add(si)
        db.flush()

        # Record stock OUT transaction (trigger deducts from inventory.quantity)
        txn = models.StockTransaction(
            product_id=item.product_id,
            warehouse_id=sale_data.warehouse_id,
            transaction_type="OUT",
            quantity=item.quantity,
            reference_id=sale.sale_id
        )
        db.add(txn)

        response_items.append(schemas.SaleItemResponse(
            item_id=si.item_id,
            product_id=product.product_id,
            product_name=product.name,
            sku=product.sku,
            quantity=item.quantity,
            unit_price=unit_price,
            total_price=item_total
        ))

        # Check for low-stock condition
        if inv.quantity <= inv.reorder_level:
            create_notification(
                db,
                user_id=current_user.user_id,
                title=f"Low Stock Alert: {product.name}",
                message=f"{product.name} at {warehouse.name} is now down to {inv.quantity} units.",
                notification_type="low_stock"
            )

    sale.total_amount = total_amount
    db.commit()
    db.refresh(sale)

    details_str = f"Completed Sale #{sale.sale_id} for {sale.customer_name} totaling ₹{total_amount:.2f} ({len(response_items)} items)"
    log_audit(db, current_user, "SALE_COMPLETED", "sales", sale.sale_id, details_str)

    return schemas.SaleResponse(
        sale_id=sale.sale_id,
        customer_name=sale.customer_name,
        warehouse_id=sale.warehouse_id,
        warehouse_name=warehouse.name,
        sale_date=sale.sale_date,
        total_amount=total_amount,
        status=sale.status,
        items=response_items
    )

@router.post("/sales/{sale_id}/return")
def process_sale_return(
    sale_id: int,
    return_data: schemas.SaleReturnCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    sale = db.query(models.Sale).filter(models.Sale.sale_id == sale_id).with_for_update().first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale order not found")

    if sale.status == "Returned":
        raise HTTPException(status_code=400, detail="This sale order has already been marked as Returned")

    # Restore inventory
    for item in sale.items:
        inv = db.query(models.Inventory).filter(
            models.Inventory.product_id == item.product_id,
            models.Inventory.warehouse_id == sale.warehouse_id
        ).with_for_update().first()

        if not inv:
            inv = models.Inventory(
                product_id=item.product_id,
                warehouse_id=sale.warehouse_id,
                quantity=0,
                reorder_level=10
            )
            db.add(inv)
            db.flush()

        # Record return stock IN transaction (trigger adds to inventory.quantity)
        txn = models.StockTransaction(
            product_id=item.product_id,
            warehouse_id=sale.warehouse_id,
            transaction_type="IN",
            quantity=item.quantity,
            reference_id=sale.sale_id
        )
        db.add(txn)

    sale.status = "Returned"
    db.commit()

    details_str = f"Processed Return for Sale #{sale.sale_id}. Restored inventory to warehouse {sale.warehouse_id}. Reason: {return_data.reason}"
    log_audit(db, current_user, "SALE_RETURNED", "sales", sale.sale_id, details_str)

    return {
        "success": True,
        "message": details_str,
        "sale_id": sale.sale_id,
        "status": sale.status
    }
