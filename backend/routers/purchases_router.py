from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
import models
import schemas
from dependencies import require_admin, require_inventory_manager, require_staff_or_admin, log_audit, create_notification

router = APIRouter(prefix="", tags=["Suppliers & Purchasing"])

# ==========================================
# SUPPLIERS
# ==========================================
@router.get("/suppliers", response_model=List[schemas.SupplierResponse])
def get_suppliers(db: Session = Depends(get_db)):
    suppliers = db.query(models.Supplier).order_by(models.Supplier.supplier_id).all()
    return [schemas.SupplierResponse.model_validate(s) for s in suppliers]

@router.get("/suppliers/{supplier_id}")
def get_supplier_detail(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    supplier = db.query(models.Supplier).filter(models.Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    products = db.query(models.Product).filter(models.Product.supplier_id == supplier_id).all()
    purchases = db.query(models.Purchase).filter(models.Purchase.supplier_id == supplier_id).order_by(desc(models.Purchase.purchase_date)).limit(10).all()

    return {
        "supplier_id": supplier.supplier_id,
        "name": supplier.name,
        "contact_person": supplier.contact_person,
        "phone": supplier.phone,
        "email": supplier.email,
        "address": supplier.address,
        "products_count": len(products),
        "products": [
            {
                "product_id": p.product_id,
                "name": p.name,
                "sku": p.sku,
                "unit_price": float(p.unit_price)
            }
            for p in products
        ],
        "recent_purchases": [
            {
                "purchase_id": po.purchase_id,
                "purchase_date": po.purchase_date,
                "total_amount": float(po.total_amount or 0),
                "status": po.status
            }
            for po in purchases
        ]
    }

@router.post("/suppliers", response_model=schemas.SupplierResponse)
def create_supplier(
    sup: schemas.SupplierCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    existing = db.query(models.Supplier).filter(models.Supplier.name.ilike(sup.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Supplier name already exists")

    new_sup = models.Supplier(
        name=sup.name,
        contact_person=sup.contact_person,
        phone=sup.phone,
        email=sup.email,
        address=sup.address
    )
    db.add(new_sup)
    db.commit()
    db.refresh(new_sup)

    log_audit(db, current_user, "SUPPLIER_CREATED", "suppliers", new_sup.supplier_id, f"Created supplier {new_sup.name}")
    return schemas.SupplierResponse.model_validate(new_sup)

@router.put("/suppliers/{supplier_id}", response_model=schemas.SupplierResponse)
def update_supplier(
    supplier_id: int,
    sup_update: schemas.SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    supplier = db.query(models.Supplier).filter(models.Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    if sup_update.name:
        supplier.name = sup_update.name
    if sup_update.contact_person is not None:
        supplier.contact_person = sup_update.contact_person
    if sup_update.phone is not None:
        supplier.phone = sup_update.phone
    if sup_update.email is not None:
        supplier.email = sup_update.email
    if sup_update.address is not None:
        supplier.address = sup_update.address

    db.commit()
    db.refresh(supplier)
    log_audit(db, current_user, "SUPPLIER_UPDATED", "suppliers", supplier.supplier_id, f"Updated supplier {supplier.name}")
    return schemas.SupplierResponse.model_validate(supplier)

@router.delete("/suppliers/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    supplier = db.query(models.Supplier).filter(models.Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    prod_count = db.query(models.Product).filter(models.Product.supplier_id == supplier_id).count()
    po_count = db.query(models.Purchase).filter(models.Purchase.supplier_id == supplier_id).count()
    if prod_count > 0 or po_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete supplier with linked products ({prod_count}) or purchase orders ({po_count})."
        )

    db.delete(supplier)
    db.commit()
    log_audit(db, current_user, "SUPPLIER_DELETED", "suppliers", supplier_id, f"Deleted supplier {supplier.name}")
    return {"message": "Supplier deleted successfully"}


# ==========================================
# PURCHASE ORDERS
# ==========================================
@router.get("/purchases", response_model=List[schemas.PurchaseResponse])
def get_purchases(
    status_filter: Optional[str] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    supplier_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    query = db.query(models.Purchase)

    if status_filter:
        query = query.filter(models.Purchase.status.ilike(status_filter))
    if warehouse_id:
        query = query.filter(models.Purchase.warehouse_id == warehouse_id)
    if supplier_id:
        query = query.filter(models.Purchase.supplier_id == supplier_id)

    purchases = query.order_by(desc(models.Purchase.purchase_id)).all()

    results = []
    for po in purchases:
        items = []
        for it in po.items:
            items.append(schemas.PurchaseItemResponse(
                item_id=it.item_id,
                product_id=it.product_id,
                product_name=it.product.name if it.product else "Unknown",
                sku=it.product.sku if it.product else None,
                quantity=it.quantity,
                unit_price=float(it.unit_price),
                total_price=float(it.total_price or (it.quantity * it.unit_price))
            ))

        results.append(schemas.PurchaseResponse(
            purchase_id=po.purchase_id,
            supplier_id=po.supplier_id,
            supplier_name=po.supplier.name if po.supplier else None,
            warehouse_id=po.warehouse_id,
            warehouse_name=po.warehouse.name if po.warehouse else None,
            purchase_date=po.purchase_date,
            total_amount=float(po.total_amount or 0),
            status=po.status or "Pending",
            items=items
        ))

    return results

@router.get("/purchases/{purchase_id}", response_model=schemas.PurchaseResponse)
def get_purchase_detail(
    purchase_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    po = db.query(models.Purchase).filter(models.Purchase.purchase_id == purchase_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    items = []
    for it in po.items:
        items.append(schemas.PurchaseItemResponse(
            item_id=it.item_id,
            product_id=it.product_id,
            product_name=it.product.name if it.product else "Unknown",
            sku=it.product.sku if it.product else None,
            quantity=it.quantity,
            unit_price=float(it.unit_price),
            total_price=float(it.total_price or (it.quantity * it.unit_price))
        ))

    return schemas.PurchaseResponse(
        purchase_id=po.purchase_id,
        supplier_id=po.supplier_id,
        supplier_name=po.supplier.name if po.supplier else None,
        warehouse_id=po.warehouse_id,
        warehouse_name=po.warehouse.name if po.warehouse else None,
        purchase_date=po.purchase_date,
        total_amount=float(po.total_amount or 0),
        status=po.status or "Pending",
        items=items
    )

@router.post("/purchases", response_model=schemas.PurchaseResponse)
def create_purchase_order(
    po_create: schemas.PurchaseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    supplier = db.query(models.Supplier).filter(models.Supplier.supplier_id == po_create.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=400, detail="Invalid supplier_id")

    warehouse = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == po_create.warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=400, detail="Invalid warehouse_id")

    if not po_create.items:
        raise HTTPException(status_code=400, detail="Purchase order must contain at least one item")

    total_amount = 0.0
    po = models.Purchase(
        supplier_id=po_create.supplier_id,
        warehouse_id=po_create.warehouse_id,
        status="Pending",
        total_amount=0.0
    )
    db.add(po)
    db.flush()  # Generate purchase_id

    response_items = []
    for item in po_create.items:
        product = db.query(models.Product).filter(models.Product.product_id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=400, detail=f"Product ID {item.product_id} not found")

        item_total = float(item.quantity) * float(item.unit_price)
        total_amount += item_total

        po_item = models.PurchaseItem(
            purchase_id=po.purchase_id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price
        )
        db.add(po_item)
        db.flush()

        response_items.append(schemas.PurchaseItemResponse(
            item_id=po_item.item_id,
            product_id=product.product_id,
            product_name=product.name,
            sku=product.sku,
            quantity=item.quantity,
            unit_price=float(item.unit_price),
            total_price=item_total
        ))

    po.total_amount = total_amount
    db.commit()
    db.refresh(po)

    details_str = f"Created Purchase Order #{po.purchase_id} for supplier {supplier.name} totaling ₹{total_amount:.2f}"
    log_audit(db, current_user, "PO_CREATED", "purchases", po.purchase_id, details_str)
    create_notification(
        db,
        user_id=current_user.user_id,
        title=f"New Purchase Order #{po.purchase_id}",
        message=details_str,
        notification_type="info"
    )

    return schemas.PurchaseResponse(
        purchase_id=po.purchase_id,
        supplier_id=po.supplier_id,
        supplier_name=supplier.name,
        warehouse_id=po.warehouse_id,
        warehouse_name=warehouse.name,
        purchase_date=po.purchase_date,
        total_amount=total_amount,
        status=po.status,
        items=response_items
    )

@router.put("/purchases/{purchase_id}/status")
def update_purchase_status(
    purchase_id: int,
    status_update: schemas.PurchaseStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    po = db.query(models.Purchase).filter(models.Purchase.purchase_id == purchase_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    allowed_statuses = ["Draft", "Pending", "Approved", "Cancelled"]
    new_status = status_update.status.capitalize()
    if new_status not in allowed_statuses and new_status != "Completed":
        raise HTTPException(status_code=400, detail=f"Status must be one of {allowed_statuses}")

    if po.status == "Completed":
        raise HTTPException(status_code=400, detail="Cannot alter status of a Completed purchase order")

    old_status = po.status
    po.status = new_status
    db.commit()

    log_audit(db, current_user, "PO_STATUS_UPDATED", "purchases", po.purchase_id, f"Changed status from {old_status} to {po.status}")
    return {"message": f"Purchase Order #{purchase_id} status updated to {po.status}", "status": po.status}

@router.post("/purchases/{purchase_id}/receive")
def receive_purchase_goods(
    purchase_id: int,
    receive_payload: Optional[schemas.PurchaseReceiveCreate] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    po = db.query(models.Purchase).filter(models.Purchase.purchase_id == purchase_id).with_for_update().first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if po.status in ["Completed", "Cancelled"]:
        raise HTTPException(status_code=400, detail=f"Cannot receive goods for an order with status '{po.status}'")

    warehouse_id = po.warehouse_id
    warehouse = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == warehouse_id).first()

    if receive_payload and receive_payload.items is not None:
        ordered_quantities = {}
        received_quantities = {}
        for item in po.items:
            ordered_quantities[item.product_id] = ordered_quantities.get(item.product_id, 0) + item.quantity
        for item in receive_payload.items:
            received_quantities[item.product_id] = received_quantities.get(item.product_id, 0) + item.received_quantity
        if received_quantities != ordered_quantities:
            raise HTTPException(
                status_code=400,
                detail="Partial purchase-order receiving is not supported by the current database schema. Receive all ordered quantities together."
            )

    received_summary = []
    items_to_receive = po.items

    for item in items_to_receive:
        product_id = item.product_id
        qty = item.quantity

        inv = db.query(models.Inventory).filter(
            models.Inventory.product_id == product_id,
            models.Inventory.warehouse_id == warehouse_id
        ).with_for_update().first()

        if not inv:
            inv = models.Inventory(
                product_id=product_id,
                warehouse_id=warehouse_id,
                quantity=0,
                reorder_level=10
            )
            db.add(inv)
            db.flush()

        # Record IN transaction (trigger adds qty to inventory.quantity)
        txn = models.StockTransaction(
            product_id=product_id,
            warehouse_id=warehouse_id,
            transaction_type="IN",
            quantity=qty,
            reference_id=po.purchase_id
        )
        db.add(txn)

        product = db.query(models.Product).filter(models.Product.product_id == product_id).first()
        prod_name = product.name if product else f"Product {product_id}"
        received_summary.append(f"{qty} units of {prod_name}")

    po.status = "Completed"
    db.commit()

    details_str = f"Received Goods for PO #{po.purchase_id} into {warehouse.name if warehouse else f'Warehouse {warehouse_id}'}: {', '.join(received_summary)}"
    log_audit(db, current_user, "PO_GOODS_RECEIVED", "purchases", po.purchase_id, details_str)
    create_notification(
        db,
        user_id=current_user.user_id,
        title=f"Goods Received for PO #{po.purchase_id}",
        message=details_str,
        notification_type="po_received"
    )

    return {
        "success": True,
        "message": details_str,
        "purchase_id": po.purchase_id,
        "status": po.status,
        "warehouse_id": warehouse_id
    }
