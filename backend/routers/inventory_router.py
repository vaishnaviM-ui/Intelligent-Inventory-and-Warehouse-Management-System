from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from database import get_db
import models
import schemas
from dependencies import require_staff_or_admin, require_inventory_manager, log_audit, create_notification

router = APIRouter(prefix="", tags=["Inventory Operations & Stock Movements"])

@router.get("/inventory")
def get_inventory_records(
    warehouse_id: Optional[int] = Query(None),
    category_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, description="'healthy', 'low', 'out'"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    query = db.query(models.Inventory).join(models.Product).join(models.Warehouse)

    if warehouse_id:
        query = query.filter(models.Inventory.warehouse_id == warehouse_id)

    if category_id:
        query = query.filter(models.Product.category_id == category_id)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Product.name.ilike(search_term),
                models.Product.sku.ilike(search_term),
                models.Warehouse.name.ilike(search_term)
            )
        )

    records = query.order_by(models.Inventory.inventory_id).all()
    results = []

    for inv in records:
        prod = inv.product
        wh = inv.warehouse
        qty = inv.quantity
        reorder = inv.reorder_level

        if qty <= 0:
            stk_status = "Out of Stock"
        elif qty <= reorder:
            stk_status = "Low Stock"
        else:
            stk_status = "Healthy"

        if status_filter:
            sf = status_filter.lower()
            if sf == "healthy" and stk_status != "Healthy":
                continue
            elif sf == "low" and stk_status != "Low Stock":
                continue
            elif sf == "out" and stk_status != "Out of Stock":
                continue

        unit_p = float(prod.unit_price) if prod else 0.0
        cost_p = float(prod.cost_price or (unit_p * 0.7)) if prod else 0.0

        results.append({
            "inventory_id": inv.inventory_id,
            "product_id": inv.product_id,
            "product_name": prod.name if prod else "Unknown",
            "sku": prod.sku if prod else None,
            "category_name": prod.category.name if prod and prod.category else "Uncategorized",
            "warehouse_id": inv.warehouse_id,
            "warehouse_name": wh.name if wh else f"Warehouse {inv.warehouse_id}",
            "quantity": qty,
            "reorder_level": reorder,
            "unit_price": unit_p,
            "cost_price": cost_p,
            "total_value": round(qty * unit_p, 2),
            "stock_status": stk_status,
            "last_updated": inv.last_updated
        })

    return results

@router.get("/inventory/low-stock")
def get_low_stock_items(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    low_records = db.query(models.Inventory).join(models.Product).join(models.Warehouse).filter(
        models.Inventory.quantity <= models.Inventory.reorder_level
    ).order_by(models.Inventory.quantity.asc()).all()

    results = []
    for inv in low_records:
        prod = inv.product
        wh = inv.warehouse
        results.append({
            "inventory_id": inv.inventory_id,
            "product_id": inv.product_id,
            "product_name": prod.name if prod else "Unknown",
            "sku": prod.sku if prod else None,
            "warehouse_id": inv.warehouse_id,
            "warehouse_name": wh.name if wh else f"Warehouse {inv.warehouse_id}",
            "quantity": inv.quantity,
            "reorder_level": inv.reorder_level,
            "deficit": max(0, inv.reorder_level - inv.quantity),
            "status": "Out of Stock" if inv.quantity <= 0 else "Low Stock"
        })

    return results

# ==========================================
# ATOMIC STOCK IN / OUT / ADJUST
# ==========================================
@router.post("/inventory/stock-in")
def stock_in(
    transaction: schemas.StockTransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    if transaction.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    product = db.query(models.Product).filter(models.Product.product_id == transaction.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    warehouse = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == transaction.warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    # Lock or create inventory row
    inv = db.query(models.Inventory).filter(
        models.Inventory.product_id == transaction.product_id,
        models.Inventory.warehouse_id == transaction.warehouse_id
    ).with_for_update().first()

    if not inv:
        inv = models.Inventory(
            product_id=transaction.product_id,
            warehouse_id=transaction.warehouse_id,
            quantity=0,
            reorder_level=10
        )
        db.add(inv)
        db.flush()

    # Create transaction record (PostgreSQL trigger trg_update_inventory adjusts inventory.quantity)
    txn = models.StockTransaction(
        product_id=transaction.product_id,
        warehouse_id=transaction.warehouse_id,
        transaction_type="IN",
        quantity=transaction.quantity,
        reference_id=transaction.reference_id
    )
    db.add(txn)
    db.commit()
    db.refresh(inv)

    details_str = f"Stock IN: Added {transaction.quantity} units of {product.name} ({product.sku}) into {warehouse.name}. New total: {inv.quantity}"
    log_audit(db, current_user, "STOCK_IN", "stock_transactions", txn.transaction_id, details_str)

    return {
        "success": True,
        "message": details_str,
        "product_id": transaction.product_id,
        "warehouse_id": transaction.warehouse_id,
        "new_quantity": inv.quantity
    }

@router.post("/inventory/stock-out")
def stock_out(
    transaction: schemas.StockTransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    if transaction.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    product = db.query(models.Product).filter(models.Product.product_id == transaction.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    warehouse = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == transaction.warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    inv = db.query(models.Inventory).filter(
        models.Inventory.product_id == transaction.product_id,
        models.Inventory.warehouse_id == transaction.warehouse_id
    ).with_for_update().first()

    if not inv or inv.quantity < transaction.quantity:
        avail = inv.quantity if inv else 0
        raise HTTPException(
            status_code=400,
            detail=f"Cannot deduct {transaction.quantity} units. Available in {warehouse.name}: {avail} units."
        )

    # Create transaction record (PostgreSQL trigger trg_update_inventory adjusts inventory.quantity)
    txn = models.StockTransaction(
        product_id=transaction.product_id,
        warehouse_id=transaction.warehouse_id,
        transaction_type="OUT",
        quantity=transaction.quantity,
        reference_id=transaction.reference_id
    )
    db.add(txn)
    db.commit()
    db.refresh(inv)

    details_str = f"Stock OUT: Deducted {transaction.quantity} units of {product.name} ({product.sku}) from {warehouse.name}. Remaining: {inv.quantity}"
    log_audit(db, current_user, "STOCK_OUT", "stock_transactions", txn.transaction_id, details_str)

    # Trigger alert if dropped below reorder level
    if inv.quantity <= inv.reorder_level:
        status_text = "Out of Stock" if inv.quantity == 0 else "Low Stock"
        create_notification(
            db,
            user_id=current_user.user_id,
            title=f"{status_text} Alert: {product.name}",
            message=f"{product.name} at {warehouse.name} is now at {inv.quantity} units (reorder threshold: {inv.reorder_level}).",
            notification_type="low_stock" if inv.quantity > 0 else "out_of_stock"
        )

    return {
        "success": True,
        "message": details_str,
        "product_id": transaction.product_id,
        "warehouse_id": transaction.warehouse_id,
        "remaining_quantity": inv.quantity
    }

@router.post("/inventory/adjust")
def adjust_inventory(
    adjustment: schemas.StockAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    product = db.query(models.Product).filter(models.Product.product_id == adjustment.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    warehouse = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == adjustment.warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    inv = db.query(models.Inventory).filter(
        models.Inventory.product_id == adjustment.product_id,
        models.Inventory.warehouse_id == adjustment.warehouse_id
    ).with_for_update().first()

    old_qty = inv.quantity if inv else 0
    diff = adjustment.new_quantity - old_qty

    if not inv:
        inv = models.Inventory(
            product_id=adjustment.product_id,
            warehouse_id=adjustment.warehouse_id,
            quantity=0,
            reorder_level=10
        )
        db.add(inv)
        db.flush()

    if diff != 0:
        txn = models.StockTransaction(
            product_id=adjustment.product_id,
            warehouse_id=adjustment.warehouse_id,
            transaction_type="IN" if diff > 0 else "OUT",
            quantity=abs(diff),
            reference_id=inv.inventory_id
        )
        db.add(txn)
    db.commit()

    details_str = f"Adjusted stock for {product.name} at {warehouse.name} from {old_qty} to {adjustment.new_quantity}. Reason: {adjustment.reason}"
    log_audit(db, current_user, "STOCK_ADJUSTMENT", "inventory", inv.inventory_id, details_str)

    return {
        "success": True,
        "message": details_str,
        "old_quantity": old_qty,
        "new_quantity": adjustment.new_quantity,
        "difference": diff
    }

# Backward compatibility for POST /stock-transactions
@router.post("/stock-transactions")
def legacy_stock_transaction(
    transaction: schemas.StockTransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    if transaction.transaction_type.upper() in ["IN", "RECEIVED"]:
        return stock_in(transaction, db, current_user)
    elif transaction.transaction_type.upper() in ["OUT", "SOLD"]:
        return stock_out(transaction, db, current_user)
    else:
        raise HTTPException(status_code=400, detail="Invalid transaction_type. Use 'IN' or 'OUT'.")

@router.get("/inventory/movements", response_model=List[schemas.StockTransactionResponse])
def get_inventory_movements(
    product_id: Optional[int] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    transaction_type: Optional[str] = Query(None),
    limit: Optional[int] = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    query = db.query(models.StockTransaction).join(models.Product).join(models.Warehouse)

    if product_id:
        query = query.filter(models.StockTransaction.product_id == product_id)
    if warehouse_id:
        query = query.filter(models.StockTransaction.warehouse_id == warehouse_id)
    if transaction_type:
        query = query.filter(models.StockTransaction.transaction_type.ilike(transaction_type))

    movements = query.order_by(desc(models.StockTransaction.transaction_date)).limit(limit).all()

    results = []
    for m in movements:
        results.append(schemas.StockTransactionResponse(
            transaction_id=m.transaction_id,
            product_id=m.product_id,
            product_name=m.product.name if m.product else "Unknown",
            sku=m.product.sku if m.product else None,
            warehouse_id=m.warehouse_id,
            warehouse_name=m.warehouse.name if m.warehouse else f"Warehouse {m.warehouse_id}",
            transaction_type=m.transaction_type,
            quantity=m.quantity,
            reference_id=m.reference_id,
            transaction_date=m.transaction_date
        ))

    return results

@router.get("/inventory/valuation")
def get_inventory_valuation(
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    query = db.query(models.Inventory).join(models.Product)
    if warehouse_id:
        query = query.filter(models.Inventory.warehouse_id == warehouse_id)

    records = query.all()
    total_units = 0
    total_cost_val = 0.0
    total_retail_val = 0.0

    by_category = {}

    for inv in records:
        prod = inv.product
        qty = inv.quantity
        if qty <= 0:
            continue

        unit_p = float(prod.unit_price) if prod else 0.0
        cost_p = float(prod.cost_price or (unit_p * 0.7)) if prod else 0.0

        item_cost = qty * cost_p
        item_retail = qty * unit_p

        total_units += qty
        total_cost_val += item_cost
        total_retail_val += item_retail

        cat_name = prod.category.name if prod and prod.category else "Uncategorized"
        if cat_name not in by_category:
            by_category[cat_name] = {"units": 0, "cost_value": 0.0, "retail_value": 0.0}
        by_category[cat_name]["units"] += qty
        by_category[cat_name]["cost_value"] += item_cost
        by_category[cat_name]["retail_value"] += item_retail

    potential_margin = round(total_retail_val - total_cost_val, 2)
    margin_percent = round((potential_margin / total_retail_val) * 100, 1) if total_retail_val > 0 else 0.0

    return {
        "total_units": total_units,
        "total_cost_valuation": round(total_cost_val, 2),
        "total_retail_valuation": round(total_retail_val, 2),
        "potential_gross_margin": potential_margin,
        "potential_margin_percent": margin_percent,
        "valuation_by_category": [
            {
                "category": k,
                "units": v["units"],
                "cost_value": round(v["cost_value"], 2),
                "retail_value": round(v["retail_value"], 2)
            }
            for k, v in by_category.items()
        ]
    }
