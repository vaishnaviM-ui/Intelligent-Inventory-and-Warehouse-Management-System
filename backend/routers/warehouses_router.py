from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
import models
import schemas
from dependencies import require_admin, require_inventory_manager, require_staff_or_admin, log_audit, create_notification

router = APIRouter(prefix="", tags=["Warehouses & Multi-Warehouse Operations"])

@router.get("/warehouses", response_model=List[schemas.WarehouseResponse])
def get_warehouses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    warehouses = db.query(models.Warehouse).order_by(models.Warehouse.warehouse_id).all()
    results = []

    # Get stock counts per warehouse
    stock_counts = dict(
        db.query(
            models.Inventory.warehouse_id,
            func.coalesce(func.sum(models.Inventory.quantity), 0)
        ).group_by(models.Inventory.warehouse_id).all()
    )

    for w in warehouses:
        total_stk = int(stock_counts.get(w.warehouse_id, 0))
        cap = w.capacity or 10000
        utilization = round((total_stk / cap) * 100, 1) if cap > 0 else 0.0

        results.append(schemas.WarehouseResponse(
            warehouse_id=w.warehouse_id,
            name=w.name,
            location=w.location,
            manager=w.manager,
            capacity=w.capacity,
            total_stock=total_stk,
            utilization_rate=min(100.0, utilization)
        ))

    return results

@router.get("/warehouses/{warehouse_id}")
def get_warehouse_detail(
    warehouse_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    warehouse = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    items = db.query(models.Inventory).filter(models.Inventory.warehouse_id == warehouse_id).all()
    inventory_list = []
    total_qty = 0
    total_cost_val = 0.0
    total_retail_val = 0.0

    for item in items:
        prod = item.product
        qty = item.quantity
        unit_price = float(prod.unit_price) if prod else 0.0
        cost_price = float(prod.cost_price or (unit_price * 0.7)) if prod else 0.0

        total_qty += qty
        total_cost_val += qty * cost_price
        total_retail_val += qty * unit_price

        inventory_list.append({
            "inventory_id": item.inventory_id,
            "product_id": item.product_id,
            "product_name": prod.name if prod else "Unknown",
            "sku": prod.sku if prod else None,
            "category_name": prod.category.name if prod and prod.category else None,
            "quantity": qty,
            "reorder_level": item.reorder_level,
            "unit_price": unit_price,
            "cost_price": cost_price,
            "last_updated": item.last_updated
        })

    cap = warehouse.capacity or 10000
    utilization = round((total_qty / cap) * 100, 1) if cap > 0 else 0.0

    return {
        "warehouse_id": warehouse.warehouse_id,
        "name": warehouse.name,
        "location": warehouse.location,
        "manager": warehouse.manager,
        "capacity": warehouse.capacity,
        "total_units": total_qty,
        "total_cost_value": round(total_cost_val, 2),
        "total_retail_value": round(total_retail_val, 2),
        "utilization_rate": min(100.0, utilization),
        "inventory": inventory_list
    }

@router.post("/warehouses", response_model=schemas.WarehouseResponse)
def create_warehouse(
    wh: schemas.WarehouseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    existing = db.query(models.Warehouse).filter(models.Warehouse.name.ilike(wh.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Warehouse with this name already exists")

    new_wh = models.Warehouse(
        name=wh.name,
        location=wh.location,
        manager=wh.manager,
        capacity=wh.capacity or 5000
    )
    db.add(new_wh)
    db.commit()
    db.refresh(new_wh)

    log_audit(db, current_user, "WAREHOUSE_CREATED", "warehouses", new_wh.warehouse_id, f"Created warehouse {new_wh.name}")

    return schemas.WarehouseResponse(
        warehouse_id=new_wh.warehouse_id,
        name=new_wh.name,
        location=new_wh.location,
        manager=new_wh.manager,
        capacity=new_wh.capacity,
        total_stock=0,
        utilization_rate=0.0
    )

@router.put("/warehouses/{warehouse_id}", response_model=schemas.WarehouseResponse)
def update_warehouse(
    warehouse_id: int,
    wh_update: schemas.WarehouseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    wh = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    if wh_update.name:
        existing = db.query(models.Warehouse).filter(
            models.Warehouse.name.ilike(wh_update.name),
            models.Warehouse.warehouse_id != warehouse_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Another warehouse already has this name")
        wh.name = wh_update.name

    if wh_update.location is not None:
        wh.location = wh_update.location
    if wh_update.manager is not None:
        wh.manager = wh_update.manager
    if wh_update.capacity is not None:
        wh.capacity = wh_update.capacity

    db.commit()
    db.refresh(wh)

    total_stk = db.query(func.coalesce(func.sum(models.Inventory.quantity), 0)).filter(
        models.Inventory.warehouse_id == warehouse_id
    ).scalar() or 0
    cap = wh.capacity or 10000
    utilization = round((total_stk / cap) * 100, 1) if cap > 0 else 0.0

    log_audit(db, current_user, "WAREHOUSE_UPDATED", "warehouses", wh.warehouse_id, f"Updated warehouse {wh.name}")

    return schemas.WarehouseResponse(
        warehouse_id=wh.warehouse_id,
        name=wh.name,
        location=wh.location,
        manager=wh.manager,
        capacity=wh.capacity,
        total_stock=total_stk,
        utilization_rate=min(100.0, utilization)
    )

@router.delete("/warehouses/{warehouse_id}")
def delete_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    wh = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    # Check if stock exists
    stock_count = db.query(func.coalesce(func.sum(models.Inventory.quantity), 0)).filter(
        models.Inventory.warehouse_id == warehouse_id
    ).scalar() or 0
    if stock_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete warehouse with {stock_count} units of active stock. Transfer or remove stock first."
        )

    db.delete(wh)
    db.commit()
    log_audit(db, current_user, "WAREHOUSE_DELETED", "warehouses", warehouse_id, f"Deleted warehouse {wh.name}")
    return {"message": f"Warehouse '{wh.name}' deleted successfully"}


# ==========================================
# MULTI-WAREHOUSE STOCK TRANSFER
# ==========================================
@router.post("/warehouses/transfer")
def transfer_stock(
    transfer: schemas.StockTransferCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    if transfer.from_warehouse_id == transfer.to_warehouse_id:
        raise HTTPException(status_code=400, detail="Source and destination warehouses cannot be the same")

    if transfer.quantity <= 0:
        raise HTTPException(status_code=400, detail="Transfer quantity must be greater than zero")

    product = db.query(models.Product).filter(models.Product.product_id == transfer.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    from_wh = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == transfer.from_warehouse_id).first()
    to_wh = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == transfer.to_warehouse_id).first()
    if not from_wh or not to_wh:
        raise HTTPException(status_code=404, detail="One or both warehouses do not exist")

    # Transaction begins: check source inventory
    source_inv = db.query(models.Inventory).filter(
        models.Inventory.product_id == transfer.product_id,
        models.Inventory.warehouse_id == transfer.from_warehouse_id
    ).with_for_update().first()

    if not source_inv or source_inv.quantity < transfer.quantity:
        avail = source_inv.quantity if source_inv else 0
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock in {from_wh.name}. Available: {avail}, requested: {transfer.quantity}"
        )

    # Destination inventory (create row if not existing)
    dest_inv = db.query(models.Inventory).filter(
        models.Inventory.product_id == transfer.product_id,
        models.Inventory.warehouse_id == transfer.to_warehouse_id
    ).with_for_update().first()

    if not dest_inv:
        dest_inv = models.Inventory(
            product_id=transfer.product_id,
            warehouse_id=transfer.to_warehouse_id,
            quantity=0,
            reorder_level=source_inv.reorder_level
        )
        db.add(dest_inv)
        db.flush()

    # Record movement in stock_transactions using valid types 'OUT' and 'IN'
    # PostgreSQL trigger trg_update_inventory automatically deducts from source and adds to dest
    txn_out = models.StockTransaction(
        product_id=transfer.product_id,
        warehouse_id=transfer.from_warehouse_id,
        transaction_type="OUT",
        quantity=transfer.quantity,
        reference_id=transfer.to_warehouse_id
    )
    txn_in = models.StockTransaction(
        product_id=transfer.product_id,
        warehouse_id=transfer.to_warehouse_id,
        transaction_type="IN",
        quantity=transfer.quantity,
        reference_id=transfer.from_warehouse_id
    )
    db.add(txn_out)
    db.add(txn_in)
    db.commit()
    db.refresh(source_inv)
    db.refresh(dest_inv)

    # Log audit and trigger notification
    details_str = f"Transferred {transfer.quantity} units of {product.name} ({product.sku}) from {from_wh.name} to {to_wh.name}"
    log_audit(db, current_user, "STOCK_TRANSFER", "stock_transactions", txn_out.transaction_id, details_str)
    create_notification(
        db,
        user_id=current_user.user_id,
        title="Stock Transfer Completed",
        message=details_str,
        notification_type="transfer"
    )

    return {
        "success": True,
        "message": details_str,
        "product_id": transfer.product_id,
        "from_warehouse": from_wh.name,
        "from_remaining_quantity": source_inv.quantity,
        "to_warehouse": to_wh.name,
        "to_new_quantity": dest_inv.quantity
    }

@router.get("/warehouses/transfers/history")
def get_transfer_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    transfers = db.query(models.StockTransaction).filter(
        models.StockTransaction.transaction_type == "OUT",
        models.StockTransaction.reference_id != None
    ).order_by(models.StockTransaction.transaction_date.desc()).limit(50).all()

    results = []
    for t in transfers:
        prod = t.product
        from_wh = t.warehouse
        to_wh = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == t.reference_id).first() if t.reference_id else None

        results.append({
            "transaction_id": t.transaction_id,
            "product_id": t.product_id,
            "product_name": prod.name if prod else "Unknown",
            "sku": prod.sku if prod else None,
            "from_warehouse": from_wh.name if from_wh else f"Warehouse {t.warehouse_id}",
            "to_warehouse": to_wh.name if to_wh else f"Warehouse {t.reference_id}",
            "quantity": t.quantity,
            "date": t.transaction_date
        })

    return results
